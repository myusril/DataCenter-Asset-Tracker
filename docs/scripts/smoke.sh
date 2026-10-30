#!/usr/bin/env bash
# Section 8 smoke flow for the DataCenter Asset Tracker API.
#
# Prerequisites: PostgreSQL is seeded, the backend is running (npm run dev),
# and backend/.env contains SEED_ADMIN_PASSWORD / SEED_TECH_PASSWORD.
# The script never prints passwords or JWTs and never writes into the repo.
#
# Usage:
#   docs/scripts/smoke.sh
#   BASE_URL=http://localhost:3000 ENV_FILE=backend/.env docs/scripts/smoke.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/backend/.env}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
TECH_USERNAME="${TECH_USERNAME:-teknisi1}"

if [ -z "${ADMIN_PASSWORD:-}" ] || [ -z "${TECH_PASSWORD:-}" ]; then
  if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
    ADMIN_PASSWORD="${ADMIN_PASSWORD:-${SEED_ADMIN_PASSWORD:-}}"
    TECH_PASSWORD="${TECH_PASSWORD:-${SEED_TECH_PASSWORD:-}}"
  fi
fi

: "${ADMIN_PASSWORD:?Set ADMIN_PASSWORD or SEED_ADMIN_PASSWORD in $ENV_FILE}"
: "${TECH_PASSWORD:?Set TECH_PASSWORD or SEED_TECH_PASSWORD in $ENV_FILE}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

step() {
  printf '\n== %s ==\n' "$1"
}

api() {
  local method="$1" path="$2" token="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$BASE_URL$path" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      -d "$body"
  else
    curl -sS -X "$method" "$BASE_URL$path" -H "Authorization: Bearer $token"
  fi
}

status_of() {
  local method="$1" path="$2" token="$3"
  curl -sS -o "$TMP_DIR/body.json" -w '%{http_code}' -X "$method" \
    "$BASE_URL$path" -H "Authorization: Bearer $token"
}

login() {
  local username="$1" password="$2"
  curl -sS -X POST "$BASE_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$username\",\"password\":\"$password\"}"
}

step 'health'
HEALTH="$(curl -sS "$BASE_URL/health")"
python3 - "$HEALTH" <<'PY'
import json, sys
body = json.loads(sys.argv[1])
assert body['success'] is True, body
assert body['data']['status'] == 'ok', body
print('health:', body['data']['status'], body['data']['environment'])
PY

step 'login admin and technician'
ADMIN_LOGIN="$(login "$ADMIN_USERNAME" "$ADMIN_PASSWORD")"
TECH_LOGIN="$(login "$TECH_USERNAME" "$TECH_PASSWORD")"
ADMIN_TOKEN="$(python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["token"])' <<<"$ADMIN_LOGIN")"
TECH_TOKEN="$(python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["token"])' <<<"$TECH_LOGIN")"
python3 - "$ADMIN_LOGIN" "$TECH_LOGIN" <<'PY'
import json, sys
admin = json.loads(sys.argv[1])['data']['user']
tech = json.loads(sys.argv[2])['data']['user']
assert admin['role'] == 'ADMIN', admin
assert tech['role'] == 'TECHNICIAN', tech
print('admin user:', admin['username'], admin['role'])
print('technician user:', tech['username'], tech['role'])
PY
unset ADMIN_LOGIN TECH_LOGIN

step 'resolve SRV-001 through the API'
ASSETS="$(api GET '/api/assets?search=SRV-001' "$ADMIN_TOKEN")"
ASSET_ID="$(python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["items"][0]["id"])' <<<"$ASSETS")"
python3 - "$ASSETS" <<'PY'
import json, sys
items = json.loads(sys.argv[1])['data']['items']
assert len(items) == 1, items
assert items[0]['assetCode'] == 'SRV-001', items[0]
print('SRV-001 id:', items[0]['id'], '| status:', items[0]['status'])
PY

step 'prepare the 83.5 conditions through the API'
HISTORY="$(api GET "/api/maintenance/asset/$ASSET_ID" "$ADMIN_TOKEN")"
python3 - "$ASSET_ID" "$HISTORY" > "$TMP_DIR/maintenance-payloads.jsonl" <<'PY'
import datetime, json, sys
asset_id = int(sys.argv[1])
rows = json.loads(sys.argv[2])['data']['items']
today = datetime.datetime.now(datetime.timezone.utc).date()

def days_ago(row):
    return (today - datetime.date.fromisoformat(row['maintenanceDate'])).days

recent = [row for row in rows if days_ago(row) <= 90]
repairs = [row for row in recent if row['maintenanceType'] == 'REPAIR']
need_total = max(0, 5 - len(recent))
need_repairs = min(need_total, max(0, 4 - len(repairs)))
repair_days = [5, 20, 35, 85]
added = 0
for index in range(need_repairs):
    print(json.dumps({
        'assetId': asset_id,
        'maintenanceType': 'REPAIR',
        'maintenanceDate': (today - datetime.timedelta(days=repair_days[index])).isoformat(),
        'description': 'Perbaikan komponen server',
        'result': 'In progress - menunggu spare part',
    }))
    added += 1
for index in range(need_total - added):
    print(json.dumps({
        'assetId': asset_id,
        'maintenanceType': 'ROUTINE',
        'maintenanceDate': (today - datetime.timedelta(days=70 + index * 5)).isoformat(),
        'description': 'Pembersihan dan pengecekan rutin',
        'result': 'OK - pengecekan rutin',
    }))
PY
CREATED=0
while IFS= read -r payload; do
  RESPONSE="$(api POST '/api/maintenance' "$ADMIN_TOKEN" "$payload")"
  python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["success"] is True, d' <<<"$RESPONSE"
  CREATED=$((CREATED + 1))
done < "$TMP_DIR/maintenance-payloads.jsonl"
if [ "$CREATED" -eq 0 ]; then
  echo 'maintenance conditions already prepared; no rows added'
else
  printf 'created %s maintenance rows\n' "$CREATED"
fi

PURCHASE_DATE="$(python3 -c 'import datetime;print((datetime.datetime.now(datetime.timezone.utc).date()-datetime.timedelta(days=547)).isoformat())')"
UPDATED="$(api PUT "/api/assets/$ASSET_ID" "$ADMIN_TOKEN" "{\"purchaseDate\":\"$PURCHASE_DATE\",\"status\":\"MAINTENANCE\"}")"
python3 - "$UPDATED" "$PURCHASE_DATE" <<'PY'
import json, sys
asset = json.loads(sys.argv[1])['data']
assert asset['status'] == 'MAINTENANCE', asset
assert asset['purchaseDate'] == sys.argv[2], asset
print('asset status:', asset['status'], '| purchaseDate:', asset['purchaseDate'])
PY
NETWORK="$(api POST '/api/network' "$ADMIN_TOKEN" "{\"assetId\":$ASSET_ID,\"connectionStatus\":\"OFFLINE\"}")"
python3 - "$NETWORK" <<'PY'
import json, sys
row = json.loads(sys.argv[1])['data']
assert row['connectionStatus'] == 'OFFLINE', row
print('network status:', row['connectionStatus'])
PY

step 'predict twice and verify isActive versioning'
FIRST="$(api POST "/api/ai/predict/$ASSET_ID" "$ADMIN_TOKEN")"
SECOND="$(api POST "/api/ai/predict/$ASSET_ID" "$ADMIN_TOKEN")"
FIRST_ID="$(python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["id"])' <<<"$FIRST")"
SECOND_ID="$(python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["id"])' <<<"$SECOND")"
python3 - "$SECOND" <<'PY'
import json, sys
d = json.loads(sys.argv[1])['data']
layer = d['layerBreakdown']
assert d['riskScore'] == 83.5, d
assert d['riskLevel'] == 'HIGH', d
assert d['confidence'] == 95, d
assert d['predictedFailureDays'] == 15, d
assert d['modelVersion'] == 'v1.0', d
assert layer['layer1']['baseScore'] == 69.5, layer
assert layer['layer2']['total'] == 5, layer
assert layer['layer3']['total'] == 9, layer
assert layer['final'] == 83.5, layer
assert d['explanation'], d
assert d['alertsCreated'] >= 1, d
print('score:', d['riskScore'], d['riskLevel'], '| confidence:', d['confidence'], '| days:', d['predictedFailureDays'])
print('layer1 base:', layer['layer1']['baseScore'], '| layer2:', layer['layer2']['adjustments'], 'total', layer['layer2']['total'])
print('layer3:', layer['layer3']['boosts'], 'total', layer['layer3']['total'])
print('alerts created for this prediction:', d['alertsCreated'])
PY
HISTORY_AFTER="$(api GET "/api/ai/predictions/asset/$ASSET_ID" "$ADMIN_TOKEN")"
python3 - "$HISTORY_AFTER" "$FIRST_ID" "$SECOND_ID" <<'PY'
import json, sys
rows = json.loads(sys.argv[1])['data']['items']
first_id, second_id = int(sys.argv[2]), int(sys.argv[3])
assert rows[0]['id'] == second_id and rows[0]['isActive'] is True, rows[:2]
assert any(r['id'] == first_id and r['isActive'] is False for r in rows), rows
active = [r for r in rows if r['isActive']]
assert len(active) == 1, active
print('history rows:', len(rows), '| active row:', active[0]['id'])
PY

step 'explain does not persist'
BEFORE_ROWS="$(api GET "/api/ai/predictions/asset/$ASSET_ID" "$ADMIN_TOKEN" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["data"]["items"]))')"
EXPLAIN="$(api GET "/api/ai/explain/$ASSET_ID" "$ADMIN_TOKEN")"
AFTER_ROWS="$(api GET "/api/ai/predictions/asset/$ASSET_ID" "$ADMIN_TOKEN" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["data"]["items"]))')"
python3 - "$EXPLAIN" "$SECOND" "$BEFORE_ROWS" "$AFTER_ROWS" <<'PY'
import json, sys
explain = json.loads(sys.argv[1])['data']
prediction = json.loads(sys.argv[2])['data']
for key in ('riskScore', 'riskLevel', 'confidence', 'predictedFailureDays'):
    assert explain[key] == prediction[key], (key, explain[key], prediction[key])
for layer in ('layer1', 'layer2', 'layer3', 'final'):
    assert explain['layerBreakdown'][layer] == prediction['layerBreakdown'][layer], layer
before, after = int(sys.argv[3]), int(sys.argv[4])
assert before == after, (before, after)
print('explain:', explain['riskScore'], explain['riskLevel'], '| prediction rows before/after:', before, after)
PY

step 'risk summary matches active predictions'
SUMMARY="$(api GET '/api/ai/risk-summary' "$ADMIN_TOKEN")"
ACTIVE_LIST="$(api GET '/api/ai/predictions?activeOnly=true&limit=100' "$ADMIN_TOKEN")"
python3 - "$SUMMARY" "$ACTIVE_LIST" <<'PY'
import json, sys
summary = json.loads(sys.argv[1])['data']
items = json.loads(sys.argv[2])['data']['items']
counts = {'LOW': 0, 'MEDIUM': 0, 'HIGH': 0}
for item in items:
    counts[item['riskLevel']] += 1
assert summary['counts'] == counts, (summary['counts'], counts)
assert summary['assetsWithoutPrediction'] >= 0, summary
print('counts:', summary['counts'], '| averageScore:', summary['averageScore'])
print('topRiskAssets:', len(summary['topRiskAssets']), '| assetsWithoutPrediction:', summary['assetsWithoutPrediction'])
PY

step 'notification fan-out and per-user scoping'
ADMIN_NOTIFICATIONS="$(api GET '/api/notifications?type=AI_ALERT&limit=100' "$ADMIN_TOKEN")"
TECH_NOTIFICATIONS="$(api GET '/api/notifications?type=AI_ALERT&limit=100' "$TECH_TOKEN")"
ADMIN_ALERT_ID="$(python3 - "$ADMIN_NOTIFICATIONS" "$SECOND_ID" <<'PY'
import json, sys
items = json.loads(sys.argv[1])['data']['items']
match = [i for i in items if i['predictionId'] == int(sys.argv[2])]
assert match, 'no admin alert for the latest prediction'
print(match[0]['id'])
PY
)"
python3 - "$TECH_NOTIFICATIONS" "$SECOND_ID" "$ADMIN_NOTIFICATIONS" <<'PY'
import json, sys
tech = json.loads(sys.argv[1])['data']['items']
admin = json.loads(sys.argv[3])['data']['items']
prediction_id = int(sys.argv[2])
assert any(i['predictionId'] == prediction_id for i in admin), 'admin alert missing'
assert any(i['predictionId'] == prediction_id for i in tech), 'technician alert missing'
print('admin alerts:', len(admin), '| technician alerts:', len(tech))
PY
UNREAD_BEFORE="$(api GET '/api/notifications/unread-count' "$ADMIN_TOKEN" | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["unreadCount"])')"
DETAIL="$(api GET "/api/notifications/$ADMIN_ALERT_ID" "$ADMIN_TOKEN")"
python3 - "$DETAIL" "$SECOND_ID" <<'PY'
import json, sys
row = json.loads(sys.argv[1])['data']
assert row['predictionId'] == int(sys.argv[2]), row
assert row['type'] == 'AI_ALERT', row
assert row['asset']['assetCode'] == 'SRV-001', row
print('alert detail:', row['id'], row['type'], '| asset:', row['asset']['assetCode'], '| isRead:', row['isRead'])
PY
MARK="$(api PUT "/api/notifications/$ADMIN_ALERT_ID/read" "$ADMIN_TOKEN")"
python3 - "$MARK" <<'PY'
import json, sys
row = json.loads(sys.argv[1])['data']
assert row['isRead'] is True and row['readAt'], row
print('marked read:', row['id'], '| readAt:', row['readAt'])
PY
UNREAD_AFTER="$(api GET '/api/notifications/unread-count' "$ADMIN_TOKEN" | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["unreadCount"])')"
[ "$UNREAD_AFTER" -eq $((UNREAD_BEFORE - 1)) ] || {
  echo "unread count mismatch: $UNREAD_BEFORE -> $UNREAD_AFTER" >&2
  exit 1
}
echo "unread count: $UNREAD_BEFORE -> $UNREAD_AFTER"
OWNERSHIP_STATUS="$(status_of GET "/api/notifications/$ADMIN_ALERT_ID" "$TECH_TOKEN")"
[ "$OWNERSHIP_STATUS" = '404' ] || {
  echo "expected 404 for another user's notification, got $OWNERSHIP_STATUS" >&2
  exit 1
}
echo 'technician reading admin notification: HTTP 404 (scoped)'
READ_ALL="$(api PUT '/api/notifications/read-all' "$ADMIN_TOKEN")"
python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["success"] is True,d;print("read-all updated:",d["data"]["updated"])' <<<"$READ_ALL"
DELETED="$(api DELETE "/api/notifications/$ADMIN_ALERT_ID" "$ADMIN_TOKEN")"
python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["success"] is True,d;print("deleted notification id:",'"$ADMIN_ALERT_ID"')' <<<"$DELETED"
DELETED_READ="$(api DELETE '/api/notifications/read' "$ADMIN_TOKEN")"
python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["success"] is True,d;print("deleted read rows:",d["data"]["deleted"])' <<<"$DELETED_READ"

step 'batch prediction'
TOTAL_ASSETS="$(api GET '/api/assets?limit=1' "$ADMIN_TOKEN" | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["pagination"]["total"])')"
BATCH_ALL="$(api POST '/api/ai/predict-batch' "$ADMIN_TOKEN" '{}')"
python3 - "$BATCH_ALL" "$TOTAL_ASSETS" <<'PY'
import json, sys
summary = json.loads(sys.argv[1])['data']
assert summary['processed'] == int(sys.argv[2]), (summary, sys.argv[2])
assert summary['failed'] == [], summary
assert summary['high'] + summary['medium'] + summary['low'] == summary['processed'], summary
print('batch all:', {k: summary[k] for k in ('processed', 'high', 'medium', 'low', 'alertsCreated')})
PY
BATCH_PARTIAL="$(api POST '/api/ai/predict-batch' "$ADMIN_TOKEN" "{\"assetIds\":[$ASSET_ID,999999]}")"
python3 - "$BATCH_PARTIAL" "$ASSET_ID" <<'PY'
import json, sys
summary = json.loads(sys.argv[1])['data']
assert summary['processed'] == 1, summary
assert len(summary['failed']) == 1, summary
assert summary['failed'][0]['assetId'] == 999999, summary
print('batch with bad id: processed', summary['processed'], '| failed:', summary['failed'])
PY

printf '\nSMOKE CHECK PASSED\n'
