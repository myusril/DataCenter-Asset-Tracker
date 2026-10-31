# Handoff — DataCenter Asset Tracker

Dokumen ini mencatat status pekerjaan terakhir agar sesi berikutnya bisa melanjutkan tanpa menebak.

## Status

Brief 3 (mobile core) selesai pada branch `feat/mobile-core` (3 commit): fondasi Expo Router +
login/auto-login, dashboard + daftar aset, detail aset (4 tab) + profil. Backend tidak berubah;
tetap **37 endpoint** sesuai `docs/API_CONTRACT.md` dan tidak boleh diubah diam-diam oleh tahap
mobile.

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
- Aplikasi mobile di `mobile/`: Expo SDK 58 + Expo Router + TypeScript, Zustand/AsyncStorage untuk
  sesi, axios dengan interceptor JWT dan logout otomatis pada 401, login, dashboard (statistik +
  ringkasan risiko), daftar aset (cari/filter/pagination/pull-to-refresh/empty state), detail aset
  dengan tab Umum/Jaringan/Maintenance/AI, dan profil + logout.

Verifikasi mobile yang sudah dijalankan dicatat di `mobile/README.md` (emulator
`Medium_Phone_API_36.1` + web). Dashboard cocok dengan API: 9 aset (6 aktif, 2 maintenance,
1 nonaktif), risiko 7/1/1, `SRV-001` 83.5 HIGH di tab AI.

Contoh hasil yang sudah diverifikasi lewat API (bukan asumsi seed): `SRV-001` disiapkan dengan 5
maintenance dalam 90 hari (4 `REPAIR`), status `MAINTENANCE`, network `OFFLINE`, dan usia 1,5 tahun;
`POST /api/ai/predict/:id` menghasilkan **83.5 HIGH**, confidence 95, 15 hari, dengan
Layer 1 `69.5` + Layer 2 `+5` + Layer 3 `+9`.

Belum dikerjakan (brief 4): tab AI global, pusat notifikasi, layar daftar maintenance/jaringan,
form admin, tombol trigger prediksi, serta deployment/EAS, HTTPS, rate limiting, Sentry, Docker, CI,
push notification, offline SQLite, QR scanner, export PDF/Excel.

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

Mobile (Expo Go, tanpa EAS):

```bash
cd mobile
npm install
cp .env.example .env        # isi EXPO_PUBLIC_API_URL, jangan di-commit
npx tsc --noEmit
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npx expo start --android   # emulator
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web      # web
```

`EXPO_PUBLIC_API_URL` adalah satu-satunya sumber alamat API; `10.0.2.2` hanya dipakai untuk emulator
lewat env, bukan ditulis di kode. Detail alur verifikasi ada di `mobile/README.md`.

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
- Mobile berada langsung di `mobile/` (bukan `mobile/DataCenterTracker/`) dengan route
  `mobile/src/app/`, sesuai bagian route dokumen dan karena struktur proyek belum di-restructure.
- State mobile memakai Zustand + AsyncStorage (menyelesaikan konflik Redux vs Zustand di dokumen).
  Token tidak terenkripsi di perangkat karena hanya memakai Expo Go; produksi sebaiknya memakai
  `expo-secure-store`.
- Tab AI mengambil rincian layer lewat `GET /api/ai/explain/:id` (read-only) karena
  `ai_predictions` tidak menyimpan `layerBreakdown`; skor tersimpan tetap 83.5 sementara rincian
  dihitung ulang (83.51 pada saat verifikasi).
- Daftar aset memakai 6 item per halaman agar pagination teruji dengan 9 aset seed.
- Di Expo Go pada emulator, tombol back perangkat tidak memicu navigasi; tombol back header
  berfungsi. Tidak ada perubahan backend.
- Backend mobile memakai HTTP lokal tanpa TLS; hanya untuk pengembangan. HTTPS belum diimplementasikan.

## Resume protocol

Baca file ini, `mobile/README.md`, dan `docs/API_CONTRACT.md` sebelum mengubah backend. Brief 4
melanjutkan aplikasi mobile di atas 37 endpoint dan bentuk respons di kontrak: tab AI global, pusat
notifikasi, layar maintenance/jaringan, form admin, dan tombol trigger prediksi. Bila ada field yang
kurang, laporkan alih-alih mengarang field baru. Jangan menyebut mesin ini sebagai model ML yang
dilatih atau menambahkan klaim akurasi.
