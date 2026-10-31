#!/usr/bin/env bash
# Manage the dedicated Jest database for the backend.
#
# The URL is always derived from backend/.env: the DATABASE_URL value with the
# database name replaced by `datacenter_tracker_test`. The development database
# is never touched, and `prisma migrate reset` is never used.
#
# Usage: scripts/test-db.sh <prepare|truncate|drop>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"
TEST_DB_NAME="datacenter_tracker_test"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE is missing. Copy backend/.env.example and fill it in." >&2
  exit 1
fi

DEV_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
if [[ -z "$DEV_URL" ]]; then
  echo "ERROR: DATABASE_URL is not set in $ENV_FILE." >&2
  exit 1
fi

# Prisma keeps `?schema=public`; libpq rejects that query parameter.
url_parts() {
  DATABASE_URL_TO_PARSE="$DEV_URL" TEST_DB_NAME_TO_USE="$TEST_DB_NAME" node --input-type=module -e '
    let url;
    try {
      url = new URL(process.env.DATABASE_URL_TO_PARSE);
    } catch {
      throw new Error("DATABASE_URL in backend/.env is not a valid URL");
    }
    if (!/^postgres(ql)?:$/.test(url.protocol)) {
      throw new Error("DATABASE_URL must be a PostgreSQL URL");
    }
    if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
      throw new Error("The test database must run on localhost or 127.0.0.1");
    }
    const testDbName = process.env.TEST_DB_NAME_TO_USE;
    if (url.pathname.replace(/^\//, "") === testDbName) {
      throw new Error("DATABASE_URL already points at the test database");
    }

    const testUrl = new URL(url.toString());
    testUrl.pathname = "/" + testDbName;

    // libpq (psql) does not understand Prisma query parameters.
    const adminUrl = new URL(url.toString());
    adminUrl.pathname = "/postgres";
    adminUrl.search = "";

    const testAdminUrl = new URL(testUrl.toString());
    testAdminUrl.search = "";

    process.stdout.write(JSON.stringify({
      test: testUrl.toString(),
      admin: adminUrl.toString(),
      testAdmin: testAdminUrl.toString(),
    }));
  '
}

PARTS="$(url_parts)"
json_field() {
  printf '%s' "$PARTS" | node --input-type=module -e '
    let input = "";
    process.stdin.on("data", (chunk) => { input += chunk; })
      .on("end", () => process.stdout.write(JSON.parse(input)[process.argv[1]]));
  ' "$1"
}

TEST_URL="$(json_field test)"
ADMIN_URL="$(json_field admin)"
TEST_ADMIN_URL="$(json_field testAdmin)"

psql_admin() {
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 "$@"
}

psql_test() {
  psql "$TEST_ADMIN_URL" -v ON_ERROR_STOP=1 "$@"
}

case "${1:-}" in
  prepare)
    if [[ "$(psql_admin -Atc "SELECT 1 FROM pg_database WHERE datname = '$TEST_DB_NAME'")" != "1" ]]; then
      psql_admin -c "CREATE DATABASE \"$TEST_DB_NAME\""
      echo "Created database $TEST_DB_NAME"
    else
      echo "Database $TEST_DB_NAME already exists"
    fi
    (cd "$BACKEND_DIR" && DATABASE_URL="$TEST_URL" npx prisma migrate deploy)
    "$SCRIPT_DIR/test-db.sh" truncate
    echo "Test database ready (schema deployed, tables truncated)"
    ;;
  truncate)
    psql_test -c 'TRUNCATE TABLE notifications, ai_predictions, maintenance_history, network_information, asset_locations, assets, users RESTART IDENTITY CASCADE'
    ;;
  drop)
    psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TEST_DB_NAME' AND pid <> pg_backend_pid()" > /dev/null
    psql_admin -c "DROP DATABASE IF EXISTS \"$TEST_DB_NAME\""
    echo "Dropped database $TEST_DB_NAME (if it existed)"
    ;;
  *)
    echo "Usage: $0 <prepare|truncate|drop>" >&2
    exit 1
    ;;
esac
