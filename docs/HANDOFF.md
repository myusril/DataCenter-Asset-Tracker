# Handoff — DataCenter Asset Tracker

Dokumen ini mencatat status pekerjaan terakhir agar sesi berikutnya bisa melanjutkan tanpa menebak.

## Status

Fase backend AI + notification selesai pada branch `feat/ai-engine` (3 commit di atas
`merge: brief 1 backend core`). Total endpoint sekarang **37**:
Auth 3, Asset 6, Maintenance 7, Network 8, AI 6, Notification 7. Kontrak lengkap ada di
`docs/API_CONTRACT.md`; tahap mobile memakai dokumen itu dan tidak boleh mengubahnya diam-diam.

Sudah tersedia:

- Skema Prisma 7 tabel (tidak ada migrasi baru) dan seed demo (2 user, 9 aset, 8 maintenance,
  8 baris network).
- Auth JWT + bcrypt, role guard, aturan registrasi admin bootstrap.
- Modul asset, maintenance (sinkronisasi status), dan network.
- Mesin risiko hibrida deterministik (`src/modules/ai-prediction/`, 7 file): Layer 1 aturan berbobot,
  Layer 2 statistik, Layer 3 pola, narasi Indonesia. Bukan model ML yang dilatih dan tidak memanggil
  layanan eksternal.
- Penyimpanan prediksi dengan versioning `isActive` (prediksi lama dinonaktifkan dalam transaksi yang
  sama), `explain` yang tidak menulis baris, dan 6 endpoint AI.
- Modul notification (`src/modules/notification/`, 4 file) dengan scoping per user dan 7 endpoint.
  Prediksi HIGH otomatis membuat satu `AI_ALERT` untuk setiap user aktif, lengkap dengan
  `predictionId`.
- Unit test Jest untuk mesin AI (2 suite, 6 test) dan smoke flow API di `docs/scripts/smoke.sh`.

Contoh hasil yang sudah diverifikasi lewat API (bukan asumsi seed): `SRV-001` disiapkan dengan 5
maintenance dalam 90 hari (4 `REPAIR`), status `MAINTENANCE`, network `OFFLINE`, dan usia 1,5 tahun;
`POST /api/ai/predict/:id` menghasilkan **83.5 HIGH**, confidence 95, 15 hari, dengan
Layer 1 `69.5` + Layer 2 `+5` + Layer 3 `+9`.

Belum dikerjakan (brief berikutnya): aplikasi mobile, deployment/EAS, HTTPS, rate limiting, Sentry,
Docker, CI, push notification, offline SQLite, QR scanner, export PDF/Excel.

## Menjalankan

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev      # tidak ada migrasi baru; aman bila sudah pernah dijalankan
npx prisma db seed
npm run dev
```

Pemeriksaan:

```bash
cd backend
npx tsc --noEmit
npm test                    # Jest ESM; tidak membutuhkan database
cd ..
docs/scripts/smoke.sh       # backend harus berjalan; membaca kredensial seed dari backend/.env
```

`smoke.sh` tidak mencetak password atau token. Script menyiapkan kondisi 83.5 lewat API, memprediksi
dua kali, memeriksa `isActive`, `explain` tanpa menulis, `risk-summary`, alert per user, scoping
notifikasi, dan batch (termasuk id yang tidak ada).

Environment variable (nama saja): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`,
`NODE_ENV`, `SEED_ADMIN_PASSWORD`, `SEED_TECH_PASSWORD`. Nilai asli hanya ada di `backend/.env`
yang tidak di-commit.

## Catatan lingkungan

- Node.js 24.21.0 (dokumen sumber menulis Node 22).
- PostgreSQL 16 lokal pada port 5433 (dokumen sumber menulis 5432).
- Database/role lokal: `datacenter_tracker` / `dc_admin`; password tidak dicatat di repositori.
- Jest memakai `NODE_OPTIONS=--experimental-vm-modules` karena proyek ESM; `jest.setup.mjs`
  menyediakan env dummy agar unit test tidak membutuhkan database.

## Batasan dan deviasi

- Contoh kerja dokumen menulis sinyal interval `0` untuk 5 baris dalam 90 hari. Implementasi memakai
  interval maintenance terjadwal (selain `REPAIR`) dan mensyaratkan ≥3 baris; z-score dan peer
  membutuhkan ≥3 peer. Keputusan ini tercatat di §9 `docs/API_CONTRACT.md`.
- Skor maksimum yang dapat dicapai adalah 99 (bobot Layer 1 total 0.80 + cap Layer 2 `+10` + Layer 3
  `+9`); clamp 100 tetap ada sebagai pengaman.
- Prediksi batch diproses berurutan; kegagalan satu aset masuk `failed[]` dan tidak menggagalkan batch.
- Alert hanya in-app (tanpa push notification). Belum ada endpoint daftar user; `technicianId`
  maintenance tetap default ke user yang login.
- Notifikasi milik user lain dijawab 404 agar keberadaannya tidak bocor.

## Resume protocol

Baca file ini dan `docs/API_CONTRACT.md` sebelum mengubah backend. Brief 3 membangun mobile di atas
37 endpoint dan bentuk respons di kontrak; bila ada field yang kurang, laporkan alih-alih mengarang
field baru. Jangan menyebut mesin ini sebagai model ML yang dilatih atau menambahkan klaim akurasi.
