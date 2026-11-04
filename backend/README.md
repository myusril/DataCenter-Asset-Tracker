# Backend — DataCenter Asset Tracker

REST API untuk inventaris aset data center: auth JWT, aset + lokasi, maintenance, informasi jaringan,
prediksi risiko hibrida, dan notifikasi.

- **Express 5 + TypeScript** (`module: node16`), runtime dev `tsx`
- **Prisma 6.19.3** + **PostgreSQL 16**
- Validasi **Zod**, password **bcryptjs**, token **jsonwebtoken**
- **42 endpoint** (Auth 3, Asset 6, Maintenance 9, Network 8, AI 6, Notification 9) — rincian di
  `../docs/API_CONTRACT.md`. Notifikasi in-app tetap sumber kebenaran; push FCM hanya cerminnya.

## Prasyarat

- Node.js **24.21.0** (dokumen sumber menulis Node 22; mesin ini tidak memiliki Node 22).
- PostgreSQL **16** yang berjalan di **port 5433** (bukan 5432 seperti dokumen sumber).
- Database dan role lokal milik Anda sendiri; jangan memakai password contoh dari dokumen.

## Setup

```bash
cd backend
npm install
cp .env.example .env
# isi variabel di bawah
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

Variabel `.env` (nama saja; file `.env` tidak di-commit):

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | `postgresql://<user>:<password>@localhost:5433/datacenter_tracker?schema=public` |
| `JWT_SECRET` | ya | Minimal 32 karakter |
| `JWT_EXPIRES_IN` | tidak | Default `7d` |
| `PORT` | tidak | Default `3000` |
| `NODE_ENV` | tidak | Default `development` |
| `CORS_ORIGIN` | tidak | Daftar origin dipisah koma. Kosong = pantulkan origin request (lokal); isi sebelum deploy |
| `SEED_ADMIN_PASSWORD` | untuk seed | Minimal 8 karakter; hanya dibaca `prisma db seed` |
| `SEED_TECH_PASSWORD` | untuk seed | Minimal 8 karakter; hanya dibaca `prisma db seed` |
| `REMINDER_JOB_ENABLED` | tidak | `true` mengaktifkan job pengingat harian 07.00; default `false` |
| `PUSH_ENABLED` | tidak | `true` mengaktifkan pengiriman FCM; default `false` (no-op) |
| `FIREBASE_SERVICE_ACCOUNT` | untuk push | Path absolut JSON service account di server (mode `600`, milik akun layanan); jangan di-commit |

`src/config/env.ts` memuat `.env` dengan `process.loadEnvFile`; variabel yang sudah diekspor di shell
menang, sehingga nilai sementara bisa diuji tanpa mengubah file (mis. memutar `JWT_SECRET`).

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan server dengan `tsx watch` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest: unit + integration test (butuh database test) |
| `npm run test:coverage` | Jest + coverage, threshold ditegakkan |
| `npm run test:db:prepare` | Buat/migrasi/kosongkan database `datacenter_tracker_test` |
| `npm run test:db:drop` | Hapus database test |
| `npm run build` | Kompilasi ke `dist/` |
| `npm start` | Jalankan hasil build (`dist/src/server.js`) |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:seed` | Isi data demo |

## Data demo (seed)

`npm run prisma:seed` membuat (idempoten per entitas, tidak menghapus data yang sudah ada):

- 2 user: `admin` (ADMIN) dan `teknisi1` (TECHNICIAN); password dari `SEED_*_PASSWORD`.
- 9 aset (server, switch, router, storage, firewall, rack, UPS) dengan lokasi aktif.
- 8 baris informasi jaringan dan 8 catatan maintenance. Pada kondisi seed, SRV-001 masih `ACTIVE`
  dengan jaringan `ONLINE` dan 2 catatan maintenance, sehingga skornya masih rendah.
- Tidak ada prediksi yang dibuat oleh seed. Skor awal terkumpul setelah prediksi dijalankan.

Kasus acuan dokumen `SRV-001 = 83.5 HIGH` **tidak** berasal dari seed. Kondisi tersebut disiapkan
lewat API oleh `docs/scripts/smoke.sh` (menambah maintenance, mengubah status dan jaringan, lalu
memprediksi). Untuk demo manual, kondisi serupa dibuat dengan menambah maintenance dan menjalankan
**Prediksi semua aset** di aplikasi.

## Struktur

```
backend/
├── prisma/
│   ├── schema.prisma        # 8 tabel + enum
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app.ts               # Express app, route mounting, error handler
│   ├── server.ts            # Entry point
│   ├── config/              # database.ts (Prisma), env.ts (validasi env)
│   ├── middlewares/         # auth.middleware.ts (JWT + role guard)
│   ├── modules/
│   │   ├── auth/            # schema, service, controller, routes (4 file + middleware)
│   │   ├── asset/           # 4 file
│   │   ├── maintenance/     # 4 file
│   │   ├── network/         # 4 file
│   │   ├── ai-prediction/   # 7 file (schema, statistical, pattern, explanation, service, controller, routes)
│   │   └── notification/    # 5 file (termasuk push.provider.ts)
│   └── utils/               # jwt, password, response, logger, serialize, validation
├── jest.config.mjs
├── jest.setup.cjs
├── scripts/test-db.sh       # prepare / truncate / drop database test
├── test/support/            # helper truncate + fixture (di luar cakupan coverage)
└── tsconfig.json
```

## Ringkasan endpoint

| Modul | Endpoint |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Asset | `GET /api/assets`, `GET /api/assets/statistics`, `GET /api/assets/:id`, `POST /api/assets`, `PUT /api/assets/:id`, `DELETE /api/assets/:id` |
| Maintenance | `GET /api/maintenance`, `GET /api/maintenance/statistics`, `GET /api/maintenance/asset/:assetId`, `GET /api/maintenance/:id`, `POST`, `PUT /:id`, `DELETE /:id` |
| Network | `GET /api/network`, `GET /api/network/statistics`, `GET /api/network/asset/:assetId`, `GET /api/network/:id`, `POST /api/network` (upsert), `PUT /:id`, `DELETE /:id`, `POST /api/network/:id/check` |
| AI | `GET /api/ai/predictions`, `GET /api/ai/predictions/asset/:assetId`, `GET /api/ai/risk-summary`, `GET /api/ai/explain/:assetId`, `POST /api/ai/predict/:assetId`, `POST /api/ai/predict-batch` |
| Notification | `GET /api/notifications`, `GET /api/notifications/unread-count`, `GET /api/notifications/:id`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all`, `DELETE /api/notifications/:id`, `DELETE /api/notifications/read`, `POST /api/notifications/device`, `DELETE /api/notifications/device` |
| Health | `GET /health` |

Semua endpoint selain health dan auth membutuhkan `Authorization: Bearer <token>`. Penulisan data
(asset, maintenance, network, AI predict) hanya untuk `ADMIN`. Notifikasi selalu dibatasi ke user yang
login; notifikasi milik user lain dijawab 404.

## Pengujian

Jest berjalan sebagai ESM (`NODE_OPTIONS=--experimental-vm-modules`) dengan dua lapis:

- **Unit test murni** (tidak menyentuh database): mesin risiko (batas level risiko, batas skor, dampak
  kondisi memburuk, reproduksi contoh SRV-001 = 83.5) dan penolakan token dengan algoritma lain
  (`none`, `HS512`) maupun secret yang salah.
- **Integration test HTTP** (`supertest` terhadap `createApp()` dan PostgreSQL khusus test): seluruh
  **42 endpoint** plus health, mencakup jalur error 400, 401, 403, 404, dan 409, termasuk
  upsert/pemindahan token perangkat, penolakan hapus token user lain, dan pemangkasan token FCM.

### Database test terpisah

Test tidak pernah memakai database demo. `npm run test:db:prepare` membuat database
`datacenter_tracker_test` pada host/port yang sama dengan `DATABASE_URL` di `backend/.env` (hanya nama
database yang diganti), menjalankan `prisma migrate deploy` (bukan `migrate reset`), lalu mengosongkan
tabel. `jest.setup.cjs` mengarahkan `DATABASE_URL` proses Jest ke database itu, dan setiap suite
melakukan `TRUNCATE` sebelum test. Setelah selesai, `npm run test:db:drop` menghapusnya.

| Perintah | Fungsi |
|---|---|
| `npm run test:db:prepare` | Buat database test bila belum ada, terapkan migrasi, kosongkan tabel |
| `npm test` | Jest tanpa laporan coverage (database test harus sudah disiapkan) |
| `npm run test:coverage` | Jest + coverage + threshold |
| `npm run test:db:drop` | Hapus database test (idempoten) |

### Hasil terukur

Diukur dengan `npm run test:coverage` pada 4 November 2026 (Node 24.21.0, PostgreSQL 16 port 5433):
**14 suite, 143 test, semuanya lulus**.

| Metrik | Hasil | Threshold |
|---|---|---|
| Statements | 955/1064 (**89.75%**) | 70% |
| Branches | 281/382 (**73.56%**) | 60% |
| Functions | 211/224 (**94.19%**) | 70% |
| Lines | 943/1051 (**89.72%**) | 70% |

`collectCoverageFrom` mencakup `src/**/*.ts` kecuali `src/server.ts` (entry point proses). Threshold
ditegakkan di `jest.config.mjs`, sehingga `npm run test:coverage` gagal bila turun di bawah nilai itu.
`src/config/env.ts` hanya 54.54% statements karena jalur `process.exit(1)` sengaja tidak dijalankan.

Suite integration: `auth.api` (17 test), `asset.api` (23), `maintenance.api` (18), `network.api`
(14), `ai.api` (15), `notification.api` (8), `push` (10), `profile.api` (17), `reminders` (5),
`schedule.api` (9), dan `app` (3), ditambah unit test mesin AI dan JWT.

- **Smoke alur API**: `bash docs/scripts/smoke.sh` (dari root) menjalankan health → login → aset →
  maintenance → jaringan → prediksi → notifikasi dengan `curl`; body JSON diolah memakai `python3`
  (bukan `jq`).
- Pengujian UI ada di aplikasi mobile; tidak ada test React Native di repository ini.

## Batasan

- Tidak ada rate limiting, HTTPS/TLS, Docker, atau CI di repository ini.
- Simulasi cek jaringan tidak mengirim ICMP; status diundi 80% Online / 20% Offline.
- Tidak ada endpoint daftar user; `technicianId` maintenance default ke user yang login.
- Z-score dan peer comparison membutuhkan minimal 3 peer agar aktif, supaya sampel kecil tidak
  menyesatkan.
- Skor maksimum yang dapat dicapai dengan bobot saat ini adalah 99; clamp 100 adalah pengaman.
- Mesin risiko deterministik dan tidak memanggil layanan AI eksternal; tidak ada klaim akurasi.
- Push memerlukan service account Firebase di server. Tanpa itu `PUSH_ENABLED` tetap `false` dan
  provider menjadi no-op; tidak ada pengiriman ke perangkat dan tidak ada kegagalan API.
