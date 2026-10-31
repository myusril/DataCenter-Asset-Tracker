# Handoff — DataCenter Asset Tracker

Dokumen ini mencatat status pekerjaan terakhir agar sesi berikutnya bisa melanjutkan tanpa menebak.

## Status

Brief 5 (penguatan pengujian, di luar fase 1–4) selesai pada branch `test/backend-coverage`
(3 commit): integration suite untuk seluruh 37 endpoint, database test terpisah, threshold coverage,
dan dokumentasi. Backend tidak berubah perilaku; tetap **37 endpoint** sesuai `docs/API_CONTRACT.md`.
Branch belum di-merge ke `main`; mahasiswa yang melakukan merge.

Sudah tersedia:

- Skema Prisma 7 tabel + seed demo (2 user, 9 aset, 8 maintenance, 8 baris network).
- Auth JWT + bcrypt, role guard, aturan registrasi admin bootstrap.
- Modul asset, maintenance (sinkronisasi status), network (termasuk simulasi cek koneksi).
- Mesin risiko hibrida deterministik (`src/modules/ai-prediction/`, 7 file): Layer 1 aturan berbobot,
  Layer 2 statistik, Layer 3 pola, narasi Indonesia. Bukan model ML yang dilatih dan tidak memanggil
  layanan eksternal.
- Penyimpanan prediksi berversi (`isActive`), `explain` yang tidak menulis baris, dan 6 endpoint AI.
- Modul notification (4 file, 7 endpoint) dengan scoping per user; prediksi HIGH membuat satu
  `AI_ALERT` untuk setiap user aktif dalam transaksi yang sama.
- Pengujian backend: 10 suite / 108 test (`npm run test:coverage`) — unit test mesin AI + verifikasi
  token, dan integration test HTTP untuk 37 endpoint dengan database `datacenter_tracker_test`.
  Statements 91.08%, lines 91.08%, functions 95.00%, branches 75.08%; threshold di `jest.config.mjs`.
  Smoke flow API tetap ada di `docs/scripts/smoke.sh`.
- Aplikasi mobile lengkap: login/auto-login, dashboard, daftar aset, detail aset 4 tab, maintenance
  (daftar/detail/form), jaringan (daftar + cek), tab AI (ringkasan, top 5, dialog explain, prediksi
  batch), pusat notifikasi dengan badge, form tambah/ubah/hapus aset, profil, dan role gating.

## Inventaris layar mobile

| Route | Layar | Akses | Keterangan |
|---|---|---|---|
| `/(auth)/login` | Login | publik | Username + password, error inline |
| `/(tabs)` | Dashboard | semua role | Statistik, ringkasan risiko, kartu risiko tinggi, akses cepat |
| `/(tabs)/assets` | Daftar aset | semua role | Cari, filter, pagination, tarik-untuk-muat-ulang; tombol tambah (ADMIN) |
| `/(tabs)/ai` | Analisis risiko | semua role | Rata-rata, jumlah per level, top 5, explain; tombol prediksi batch (ADMIN) |
| `/(tabs)/notifications` | Notifikasi | semua role | Badge, mark read, mark all, hapus, ketuk alert → aset |
| `/(tabs)/profile` | Profil | semua role | Identitas, role, versi, logout |
| `/asset/[id]` | Detail aset | semua role | Tab Umum/Jaringan/Maintenance/AI; aksi tulis (ADMIN) |
| `/asset/new` | Tambah aset | ADMIN | Form Umum + Lokasi + Jaringan |
| `/asset/[id]/edit` | Ubah aset | ADMIN | Prefill dari detail |
| `/maintenance` | Daftar maintenance | semua role | Filter jenis, pagination; tombol catat (ADMIN) |
| `/maintenance/[id]` | Detail maintenance | semua role | Tanggal, teknisi, biaya, jadwal, uraian, hasil |
| `/maintenance/new` | Catat maintenance | ADMIN | Pemilih aset, jenis, tanggal, hasil, biaya, jadwal |
| `/network` | Daftar jaringan | semua role | Status koneksi, cari, filter; aksi cek (ADMIN) |

Teknisi tidak melihat kontrol tulis di layar mana pun; membuka rute admin langsung menampilkan
"Akses ditolak".

## Endpoint modul (37) + health (1)

| Modul | Jumlah | Path |
|---|---|---|
| Auth | 3 | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Asset | 6 | `GET /api/assets`, `GET /api/assets/statistics`, `GET /api/assets/:id`, `POST /api/assets`, `PUT /api/assets/:id`, `DELETE /api/assets/:id` |
| Maintenance | 7 | `GET /api/maintenance`, `GET /api/maintenance/statistics`, `GET /api/maintenance/asset/:assetId`, `GET /api/maintenance/:id`, `POST`, `PUT /:id`, `DELETE /:id` |
| Network | 8 | `GET /api/network`, `GET /api/network/statistics`, `GET /api/network/asset/:assetId`, `GET /api/network/:id`, `POST /api/network`, `PUT /:id`, `DELETE /:id`, `POST /api/network/:id/check` |
| AI | 6 | `GET /api/ai/predictions`, `GET /api/ai/predictions/asset/:assetId`, `GET /api/ai/risk-summary`, `GET /api/ai/explain/:assetId`, `POST /api/ai/predict/:assetId`, `POST /api/ai/predict-batch` |
| Notification | 7 | `GET /api/notifications`, `GET /api/notifications/unread-count`, `GET /api/notifications/:id`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all`, `DELETE /api/notifications/:id`, `DELETE /api/notifications/read` |
| Health (di luar 37) | 1 | `GET /health` |

Bentuk respons, status code, dan aturan tiap modul ada di `docs/API_CONTRACT.md`.

## Ringkasan rumus AI

- **Layer 1 (aturan berbobot):** frekuensi maintenance 90 hari × 0,25; insiden `REPAIR` 90 hari × 0,20;
  usia aset × 0,15; status aset × 0,15; kondisi jaringan × 0,05. Setiap faktor dinormalisasi 0–100.
- **Layer 2 (statistik, total ±10):** z-score interval terhadap peer satu tipe (±10, butuh ≥3 peer),
  tren 45 hari (±5), interval maintenance terjadwal (±5, butuh ≥3 baris), perbandingan peer (±5, butuh
  ≥3 peer).
- **Layer 3 (pola, maks +15):** jaringan offline +2,5; ≥3 perbaikan 90 hari +1,5; rasio perbaikan
  0…+5; jarak sejak maintenance terakhir 0…+5.
- `final = clamp(L1 + L2 + L3, 0, 100)`; level ≤30 Rendah, ≤60 Sedang, >60 Tinggi.
- `confidence = 50 + min(maintenance,5)×5 + jaringan(10) + purchaseDate(10) + usia≥90 hari(5)`, maks 95.
- `predictedFailureDays = clamp(round((100 − skor) × 0,9), 3, 365)`.
- Contoh SRV-001: `69,5 + 5 + 9 = 83,5` → Tinggi, confidence 95, 15 hari.

## Menjalankan dan memeriksa

```bash
# Backend (butuh backend/.env yang tidak di-commit)
cd backend
npx tsc --noEmit
npm run test:db:prepare     # buat + migrasi + kosongkan datacenter_tracker_test
npm run test:coverage       # 10 suite / 108 test + threshold
npm run test:db:drop        # hapus database test
npm run dev

# Smoke alur API (backend harus berjalan)
bash docs/scripts/smoke.sh

# Mobile
cd mobile
npx tsc --noEmit
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npx expo start --android   # emulator
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web      # web
```

Database test diturunkan dari `DATABASE_URL` di `backend/.env` dengan nama database diganti menjadi
`datacenter_tracker_test` pada host/port yang sama; database demo tidak pernah dipakai test dan tidak
diubah oleh gate (`users` 2, `assets` 9, `maintenance_history` 14, `ai_predictions` 70 sebelum dan
sesudah). `prisma migrate deploy` dipakai untuk database test, bukan `migrate reset`.

Environment variable (nama saja): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`,
`NODE_ENV`, `SEED_ADMIN_PASSWORD`, `SEED_TECH_PASSWORD`, dan `EXPO_PUBLIC_API_URL` untuk mobile.
Nilai asli hanya ada di `backend/.env` (tidak di-commit).

## Kondisi data demo saat handoff

Selama pengujian manual brief 4, data demo ikut berubah (ini normal, bukan bug):

- 2 catatan maintenance baru pada SRV-004 (satu `REPAIR`, satu `ROUTINE` dengan hasil `Resolved`),
  sehingga total maintenance menjadi 14 dan status SRV-004 kembali Aktif.
- Cek jaringan pada SRV-001 mengubah status dari Offline menjadi Online; prediksi ulang kemudian
  menghasilkan 76,0 Tinggi (bukan 83,5), dan ringkasan rata-rata menjadi 24,43.
- Dua catatan maintenance pada SRV-004 menaikkan skornya ke 30,5 Sedang; gate akhir mencatat
  ringkasan 6 Rendah / 2 Sedang / 1 Tinggi dengan rata-rata 26,91.
- `AI_ALERT` tambahan dibuat untuk admin dan teknisi1 oleh setiap prediksi HIGH (dua kali batch pada
  gate akhir); notifikasi admin yang sudah dibaca dihapus saat menguji aksi hapus.
- Form tambah aset pada emulator terisi sebagian (DC-4, hostname) tetapi tidak disimpan; tidak ada
  aset uji yang tertinggal (pemeriksaan `search=TST-902` = 0).
- Brief 5 tidak menyentuh data demo: seluruh test memakai `datacenter_tracker_test` yang dibuat dan
  dihapus oleh script. Jumlah baris demo tetap 2 user, 9 aset, 14 maintenance, 70 prediksi.

Untuk mengembalikan data demo ke kondisi seed (lokal, destruktif):

```bash
cd backend
npx prisma migrate reset --force   # menghapus seluruh data lokal lalu menjalankan seed
```

Setelah reset, jalankan prediksi batch sekali agar dashboard dan tab AI kembali terisi.

## Tidak diimplementasikan

- **Fase 6**: EAS build, APK/IPA, distribusi, dan UAT di perangkat pengguna.
- Push notification (alert hanya in-app), mode offline SQLite, unggah gambar aset, export PDF/Excel,
  dark mode, QR scanner, adaptive weight, HTTPS, rate limiting, Sentry, Docker, CI/CD, direktori
  `ai-service/`.
- Endpoint daftar user sehingga teknisi pada form maintenance belum dapat dipilih.
- Layar registrasi di mobile (registrasi hanya lewat API).

## Resume protocol

1. Baca file ini, `README.md`, `mobile/README.md`, dan `docs/API_CONTRACT.md`.
2. Jalankan backend dari direktori `backend` yang memiliki `.env`; jangan menyalin kredensial ke file
   yang di-commit.
3. Sebelum mengubah kontrak API, perbarui `docs/API_CONTRACT.md` lebih dulu dan pastikan mobile serta
   backend tetap cocok.
4. Mesin risiko deterministik: jangan menyebutnya model ML yang dilatih atau menambahkan klaim akurasi.
5. Verifikasi UI di emulator Android; web hanya pemeriksaan tambahan. Bila emulator berhenti
   merespons (screencap 0 byte, "Transport endpoint is not connected", "System UI isn't responding"),
   hentikan emulator lalu jalankan ulang `emulator -avd Medium_Phone_API_36.1 -no-snapshot-save`.
