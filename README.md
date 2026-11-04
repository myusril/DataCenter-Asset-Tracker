# DataCenter Asset Tracker

Aplikasi inventaris dan asset tracking data center untuk teknisi dan administrator: pencatatan aset
(server, switch, router, storage, firewall, rack), riwayat lokasi, informasi jaringan, riwayat
maintenance, serta prediksi risiko untuk preventive maintenance.

- Backend: REST API **Express 5 + TypeScript + Prisma 6.19.3 + PostgreSQL 16**, 42 endpoint
  (37 dari dokumen + 5 ekstensi: jadwal/pengingat maintenance, profil sendiri, dan pendaftaran
  perangkat push), 8 tabel.
- Mobile: aplikasi **Expo SDK 58 / React Native 0.88** (Expo Router, Zustand, axios) untuk Android
  (HP fisik) dan web.
- Mesin risiko: **heuristik deterministik 3 lapisan** (aturan berbobot + statistik + pencocokan pola),
  bukan model machine learning yang dilatih, tanpa layanan AI eksternal.

Seluruh teks antarmuka berbahasa Indonesia. Proyek ini dikerjakan bertahap dalam 4 fase; riwayat commit
lengkap ada di bagian [Riwayat pengembangan](#riwayat-pengembangan).

## Daftar isi

1. [Fitur](#fitur)
2. [Arsitektur](#arsitektur)
3. [Prasyarat](#prasyarat)
4. [Setup database](#setup-database)
5. [Setup backend](#setup-backend)
6. [Setup mobile](#setup-mobile)
7. [Setup push notification](#setup-push-notification)
8. [Daftar perintah](#daftar-perintah)
9. [Akun demo](#akun-demo)
10. [Mesin prediksi risiko](#mesin-prediksi-risiko)
11. [Struktur repository](#struktur-repository)
12. [Kesesuaian dengan dokumen](#kesesuaian-dengan-dokumen)
13. [Hasil pengujian](#hasil-pengujian)
14. [Batasan dan non-goals](#batasan-dan-non-goals)
15. [Riwayat pengembangan](#riwayat-pengembangan)

## Fitur

**Backend**

- Auth JWT + bcrypt, role `ADMIN`/`TECHNICIAN`, aturan registrasi admin bootstrap.
- Asset: CRUD, pencarian, filter tipe/status/rack, pengurutan, pagination, statistik, riwayat lokasi
  (1:N) dan informasi jaringan (1:1).
- Maintenance: CRUD, filter, statistik, sinkronisasi status aset (Perbaikan/Upgrade/Penggantian →
  Maintenance; hasil diawali `Resolved` → Aktif), jadwal maintenance (terlewat lebih dulu, `daysUntil`,
  `state`) dan pengingat `MAINTENANCE_REMINDER` idempoten untuk seluruh user aktif dengan job harian
  07.00 yang diaktifkan `REMINDER_JOB_ENABLED`.
- Network: upsert per aset, update, hapus, simulasi cek koneksi (80% Online / 20% Offline), statistik.
- AI: prediksi tunggal/batch, riwayat prediksi berversi (`isActive`), explain tanpa menyimpan, ringkasan
  risiko dashboard, alert otomatis untuk prediksi HIGH.
- Notification: 9 endpoint dengan scoping per user, unread count, mark read, mark all, hapus satu,
  hapus yang sudah dibaca, serta pendaftaran/penghapusan token FCM perangkat.
- Push FCM: `AI_ALERT` dan `MAINTENANCE_REMINDER` dikirim ke perangkat setelah baris notifikasi
  commit; provider menjadi no-op saat `PUSH_ENABLED=false` atau service account belum tersedia.

**Mobile**

- Login + auto-login (token & user disimpan di AsyncStorage), logout dengan konfirmasi, penanganan 401
  yang mengakhiri sesi dan kembali ke layar login.
- 5 tab: **Dashboard, Aset, AI, Notifikasi, Profil**.
- Dashboard: statistik aset, sebaran risiko, kartu "N Aset Berisiko Tinggi" yang membuka detail aset,
  akses cepat ke Maintenance dan Jaringan.
- Aset: pencarian (debounce 400 ms), filter tipe/status, pagination, pull-to-refresh, empty state.
- Detail aset: tab **Umum / Jaringan / Maintenance / AI**; catatan maintenance dapat diketuk untuk
  membuka detailnya.
- Maintenance: daftar seluruh riwayat + filter jenis + pagination, halaman detail lengkap.
- Jadwal maintenance: layar `/schedule` dengan tab **Terlewat / 7 hari / 30 hari** beserta jumlahnya,
  baris terlewat lebih dulu, kartu jadwal + jumlah terlewat di dashboard, dan tombol
  **Jalankan pengingat** khusus admin.
- Jaringan: daftar perangkat dengan status koneksi, pencarian hostname/IP, filter status, dan aksi
  **Cek** (khusus admin) yang memperbarui status + waktu cek.
- AI: skor rata-rata, jumlah per level, maksimal 5 aset berisiko tertinggi dengan bar skor, dialog
  rincian perhitungan dari `GET /api/ai/explain/:assetId`, tombol **Prediksi semua aset** (admin).
- Notifikasi: badge belum dibaca pada tab, urutan belum dibaca lebih dulu, tandai dibaca saat diketuk,
  tandai semua dibaca, hapus satu, hapus yang sudah dibaca, waktu relatif, ketuk alert AI → detail
  aset, dan ketuk pengingat maintenance → detail maintenance (atau tab Maintenance aset bila catatan
  sudah dihapus).
- Profil: panel **Edit profil** untuk nama lengkap, email, dan (opsional) password sendiri — validasi
  inline, toast sukses, greeting/avatar langsung ikut berubah, dan sesi berakhir otomatis setelah
  password diganti. Berlaku untuk admin maupun teknisi.
- Admin: form tambah/ubah aset (Umum + Lokasi + Jaringan, validasi inline), hapus aset dengan dialog
  konfirmasi dan pesan konflik 409 yang terbaca, form catat maintenance dengan pemilih aset.
- Teknisi: seluruh kontrol tulis disembunyikan; rute admin yang dibuka langsung menampilkan
  "Akses ditolak".

## Arsitektur

```
┌──────────────────────────┐        HTTP/JSON        ┌───────────────────────────┐
│  Mobile (Expo SDK 58)    │  Authorization: Bearer  │  Backend (Express 5, TS)  │
│  Expo Router + Zustand   │ ──────────────────────> │  42 endpoint REST         │
│  axios + AsyncStorage    │ <────────────────────── │  JWT + bcrypt + Zod       │
└──────────────────────────┘                         └─────────────┬─────────────┘
                                                                   │ Prisma 6.19.3
                                                                   ▼
                                                     ┌───────────────────────────┐
                                                     │  PostgreSQL 16 (port 5433)│
                                                     │  8 tabel + enum           │
                                                     └───────────────────────────┘
```

Alur data utama:

1. Mobile memanggil API dengan token dari interceptor axios.
2. Backend memvalidasi body/query dengan Zod, memeriksa token dan role, lalu mengakses PostgreSQL lewat
   Prisma.
3. Modul AI menghitung skor dari data aset, maintenance, dan jaringan; prediksi HIGH membuat notifikasi
   `AI_ALERT` untuk setiap user aktif dalam transaksi yang sama.
4. Mobile mengambil ringkasan risiko (`/api/ai/risk-summary`) dan daftar notifikasi untuk dashboard,
   tab AI, dan badge.

## Prasyarat

| Tool | Versi yang dipakai | Catatan |
|---|---|---|
| Node.js | **24.21.0** | Dokumen sumber menulis Node 22; mesin pengembangan tidak memiliki Node 22 |
| npm | 11.x (bawaan Node 24) | |
| PostgreSQL | **16** | Instance lokal berjalan pada port **5433**, bukan 5432 seperti dokumen |
| Android SDK | HP fisik **Infinix X6882 (Hot 50 4G)**, Android 14 + Expo Go 58 | Verifikasi UI utama |
| Browser | Chrome/Chromium | Verifikasi sekunder `expo start --web` |

## Setup database

Buat role dan database baru dengan kredensial lokal Anda sendiri (jangan memakai password contoh dari
dokumen sumber):

```bash
psql -h localhost -p 5433 -d postgres
```

```sql
CREATE USER dc_admin WITH PASSWORD '<password-lokal-anda>';
CREATE DATABASE datacenter_tracker OWNER dc_admin;
GRANT ALL PRIVILEGES ON DATABASE datacenter_tracker TO dc_admin;
ALTER USER dc_admin CREATEDB; -- Prisma membutuhkan shadow database
\q
```

## Setup backend

```bash
cd backend
npm install
cp .env.example .env      # isi nama variabel di bawah, jangan commit .env
npx prisma generate
npx prisma migrate dev
npm run prisma:seed       # data demo: 2 user, 9 aset, maintenance, jaringan
npm run dev
```

`backend/.env` tidak di-commit. Variabel yang dibutuhkan (nama saja):

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | URL PostgreSQL lokal, termasuk user, password, host, port, dan nama database |
| `JWT_SECRET` | Minimal 32 karakter; buat dengan `openssl rand -hex 48` |
| `JWT_EXPIRES_IN` | Masa berlaku token, default `7d` |
| `PORT` | Port server, default `3000` |
| `NODE_ENV` | `development` / `test` / `production` |
| `CORS_ORIGIN` | Opsional. Daftar origin dipisah koma; kosong = pantulkan origin request (hanya untuk lokal) |
| `SEED_ADMIN_PASSWORD` | Password akun admin saat seed; hanya dipakai `npm run prisma:seed` |
| `SEED_TECH_PASSWORD` | Password akun teknisi saat seed |
| `REMINDER_JOB_ENABLED` | `true` menyalakan job pengingat harian 07.00; default `false` |
| `PUSH_ENABLED` | `true` menyalakan pengiriman FCM; default `false` |
| `FIREBASE_SERVICE_ACCOUNT` | Path file service account JSON di server; hanya dibaca bila `PUSH_ENABLED=true` |

Output yang diharapkan:

```
[INFO] - ✅ Database connected
[INFO] - 🚀 Server running on http://localhost:3000
[INFO] - 📝 Environment: development
```

## Setup mobile

```bash
cd mobile
npm install
cp .env.example .env
EXPO_PUBLIC_API_URL=http://<IP-LAN-komputer>:3000 npx expo start --android   # HP fisik di jaringan yang sama
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web               # browser (pemeriksaan sekunder)
```

`EXPO_PUBLIC_API_URL` adalah satu-satunya sumber alamat API; tidak ada alamat IP di dalam kode. Nilai
jatuh ke `http://localhost:3000` bila variabel tidak diisi.

| Target | Nilai | Catatan |
|---|---|---|
| HP fisik | `http://<IP-LAN-komputer>:3000` | HP dan komputer harus satu jaringan |
| HP fisik lewat USB | `adb reverse tcp:3000 tcp:3000` + `http://localhost:3000` | Dipakai saat verifikasi di perangkat |
| Web / iOS simulator | `http://localhost:3000` | |

## Setup push notification

Push FCM bersifat opsional dan hanya untuk Android. Tanpa Firebase, aplikasi tetap berjalan dan
notifikasi tetap masuk ke pusat notifikasi in-app.

1. Buat proyek Firebase, daftarkan aplikasi Android `com.datacentertracker.app`, unduh
   `google-services.json`, dan letakkan di `mobile/google-services.json` (di-ignore, hanya untuk
   build).
2. Buat service account, simpan di server (mis. `/etc/dc-api-firebase.json`) dengan izin baca untuk
   akun proses backend, lalu set `PUSH_ENABLED=true` dan `FIREBASE_SERVICE_ACCOUNT=<path-file>`.
3. Bangun ulang APK dan uji dari Firebase Console maupun lewat prediksi HIGH / pengingat maintenance.

Langkah lengkap, log yang diharapkan, dan tabel pemecahan masalah: `docs/FIREBASE_SETUP.md`.

## Daftar perintah

Backend (`cd backend`):

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan (`tsx watch`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest: unit + integration test (butuh database test) |
| `npm run test:coverage` | Jest + coverage, threshold 70/70/70/60 ditegakkan |
| `npm run test:db:prepare` / `test:db:drop` | Siapkan / hapus database `datacenter_tracker_test` |
| `npm run build` / `npm start` | Kompilasi TypeScript / jalankan hasil build |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Terapkan migrasi |
| `npm run prisma:seed` | Isi data demo |

Mobile (`cd mobile`):

| Perintah | Fungsi |
|---|---|
| `npm start` | Metro (`expo start`) |
| `npm run android` / `npm run web` | Buka di HP fisik Android (Expo Go) / browser |
| `npm run typecheck` | `tsc --noEmit` |

## Akun demo

Dua akun dibuat oleh seed. Password **tidak ditulis di repository**; nilainya ada di `backend/.env`
sebagai `SEED_ADMIN_PASSWORD` dan `SEED_TECH_PASSWORD`.

| Username | Role | Bisa melakukan |
|---|---|---|
| `admin` | ADMIN | Semua fitur: CRUD aset, catat maintenance, cek jaringan, prediksi tunggal/batch, notifikasi |
| `teknisi1` | TECHNICIAN | Melihat dashboard/aset/detail/maintenance/jaringan/AI dan mengelola notifikasinya sendiri |

## Mesin prediksi risiko

Mesin berada di `backend/src/modules/ai-prediction/` (7 file) dan **bukan model machine learning yang
dilatih**; tidak ada metrik akurasi yang diklaim.

1. **Lapisan 1 — aturan berbobot.** Lima faktor dinormalisasi 0–100 lalu dikalikan bobot: frekuensi
   maintenance 90 hari (0,25), insiden `REPAIR` 90 hari (0,20), usia aset (0,15), status aset (0,15),
   kondisi jaringan (0,05).
2. **Lapisan 2 — penyesuaian statistik (total dibatasi ±10).** Z-score interval maintenance terhadap
   peer satu tipe, tren 45 hari, interval maintenance terjadwal, dan perbandingan jumlah maintenance
   dengan median peer. Sinyal z-score/peer bernilai 0 bila peer kurang dari 3 aset.
3. **Lapisan 3 — pencocokan pola (+0…+15).** Jaringan offline, ≥3 perbaikan dalam 90 hari, rasio
   perbaikan, dan jarak hari sejak maintenance terakhir.

`final = clamp(layer1 + layer2 + layer3, 0, 100)`. Level: ≤30 Rendah, ≤60 Sedang, >60 Tinggi.
Skor maksimum yang dapat dicapai dengan bobot di atas adalah 99; clamp 100 adalah pengaman. Prediksi
berlevel **Tinggi** membuat notifikasi `AI_ALERT` untuk setiap user aktif. Contoh acuan dokumen
(SRV-001): `69.5 + 5 + 9 = 83.5` → Tinggi, confidence 95, 15 hari.

## Struktur repository

```
.
├── backend/
│   ├── prisma/               # schema 8 tabel + seed demo
│   ├── scripts/test-db.sh    # prepare / truncate / drop database test
│   ├── test/support/         # helper truncate + fixture test
│   └── src/
│       ├── app.ts, server.ts
│       ├── config/           # Prisma client, validasi env
│       ├── middlewares/      # JWT + role guard
│       ├── modules/          # auth, asset, maintenance, network, ai-prediction, notification
│       └── utils/            # jwt, password, response, logger, serialize, validation
├── mobile/
│   ├── src/
│   │   ├── api/              # client axios, session bridge, auth, assets, maintenance, network, ai, notifications
│   │   ├── app/              # route Expo Router: (auth), (tabs), asset, maintenance, network
│   │   ├── components/       # Card, Button, StatusPill, RiskBar, form fields, dialog, dll.
│   │   ├── hooks/            # useIsAdmin, useReducedMotion, useCountUp
│   │   ├── notifications/    # token FCM, channel Android, routing saat notifikasi diketuk
│   │   ├── store/            # auth (Zustand + persist), notifications (badge)
│   │   ├── theme/            # warna, spacing, tipografi, token desain
│   │   ├── types/            # tipe respons API
│   │   └── utils/            # format tanggal/angka, warna pill
│   └── README.md
└── docs/
    ├── API_CONTRACT.md       # kontrak 42 endpoint (37 dokumen + 5 ekstensi)
    ├── FIREBASE_SETUP.md     # setup push FCM dari nol, kredensial sebagai placeholder
    ├── HANDOFF.md            # status & cara melanjutkan
    ├── MODULES.md            # panduan modul per modul, mesin risiko, model data, alur mobile
    ├── USER_GUIDE.md         # panduan pemakaian layar dan skenario demo 10 menit
    └── scripts/smoke.sh      # smoke test alur API
```

Lisensi komponen pihak ketiga: `THIRD_PARTY_NOTICES.md` di akar repository.

## Kesesuaian dengan dokumen

Dokumen sumber: *DataCenter Asset Tracker — Backend & Roadmap* (31 halaman). Tabel ini memetakan
bagian dokumen ke hasil yang benar-benar ada di repository.

| Bagian dokumen | Tuntutan | Yang dikerjakan |
|---|---|---|
| §3 Struktur project | Backend moduler + mobile Expo | Backend `src/modules/*` (7 modul) dan mobile di `mobile/` dengan route `src/app/...` |
| §4 Database schema | 7 tabel + enum | 8 tabel Prisma (`users`, `assets`, `asset_locations`, `network_information`, `maintenance_history`, `ai_predictions`, `notifications`, `device_tokens`) + 8 enum |
| §5 Backend modules | Auth 3, Asset 6, Maintenance 7, Network 8, AI 6, Notification 7 | **42 endpoint** = 37 sesuai tabel §7.1 + 5 ekstensi: jadwal/pengingat maintenance, `PATCH /api/users/me`, dan 2 endpoint perangkat push (`docs/API_CONTRACT.md`) |
| §6 AI hybrid engine | 3 lapisan, contoh 83.5 HIGH | 3 lapisan seperti dijelaskan di atas; contoh SRV-001 direproduksi (69.5 + 5 + 9) |
| §8.1 Test flow | Health, login, create asset, maintenance, predict, notifications | Dijalankan; hasil di tabel "Hasil pengujian" |
| §8.2 Checklist | 9 baris fitur | Diisi dengan bukti pengamatan nyata (lihat tabel berikut) |
| §11.2 TODO Production | Unit test Jest minimal 70% coverage | 14 suite / 143 test; statements 89.75%, lines 89.72%, functions 94.19%, branches 73.56% (threshold ditegakkan di `jest.config.mjs`) |
| §12.1 Sprint 1–4 mobile | Foundation → auth → dashboard/aset → operasional/AI | 4 fase mobile selesai (dashboard, aset, detail 4 tab, maintenance, jaringan, AI, notifikasi, form admin, profil) |
| Fase 1 Asset management (roadmap) | List, search, filter, detail, navigasi | Selesai |
| Fase 2 Operational features | Maintenance list/detail, network screen | Selesai |
| Fase 3 AI & notification | AI screen, top 5, notification center, badge, alert card | Selesai |
| Fase 4 Admin capabilities | Form tambah/edit/hapus aset, form maintenance | Selesai |
| Fase 5 Polish & testing | Profil, uji di perangkat, perbaikan UI, HANDOFF | Selesai untuk HP fisik Infinix X6882 + web; emulator tidak dipakai |
| Fase 6 Deployment | Build APK/IPA, distribusi | **Tidak dikerjakan** (non-goal) |

### Deviasi yang disengaja

| # | Dokumen menulis | Yang dipakai | Alasan |
|---|---|---|---|
| 1 | Node.js 22 | **Node.js 24.21.0** | Versi yang tersedia di mesin pengembangan; tidak ada Node 22 |
| 2 | PostgreSQL port 5432 | **Port 5433** | Instance PostgreSQL 16 lokal memang berjalan di 5433 |
| 3 | Database user `dc_admin` / password contoh | Role & password **lokal baru** | Password contoh dari dokumen tidak boleh dipakai/di-commit |
| 4 | Proyek Expo di `mobile/DataCenterTracker/` | Langsung di **`mobile/`** dengan route `src/app/` | Bagian route dokumen sendiri sudah memakai `src/app/...` |
| 5 | Sprint 1 menulis Redux Toolkit | **Zustand** + AsyncStorage | Roadmap dokumen menulis Zustand; Zustand lebih ringkas untuk sesi ini |
| 6 | §1.4 teknisi "view + update status" | Teknisi **read-only** | Mengikuti tabel endpoint §5.2/§5.3 (penulisan hanya ADMIN); dicatat sebagai keputusan |
| 7 | §5.4 judul "Endpoint: 7" | **8 endpoint network** | Judul dan tabel §7.1 bertentangan; mengikuti daftar route + tabel §7.1 |
| 8 | §6.1 pola lapisan 3 hanya 3 komponen | **4 komponen** (+2.5, +1.5, +5, 0) | Mengikuti contoh kerja §6.3 yang dipakai dokumen untuk angka 83.5 |
| 9 | Workflow hanya `main` | **Satu branch fitur per fase**, merge `--no-ff` | Brief pengerjaan bertahap; tiap fase tetap terlihat di riwayat |
| 10 | Maintenance butuh `technicianId` | **Default user yang login** | Dokumen tidak menyediakan endpoint daftar user; dicatat sebagai batasan |
| 11 | Registrasi anonim menerima role apa pun | User pertama boleh ADMIN; ADMIN berikutnya butuh token ADMIN | Mencegah eskalasi hak akses |
| 12 | Skema `assets`/`maintenance_history` tidak mencantumkan timestamp | Ditambahkan `createdAt`/`updatedAt` pada `assets`, `maintenance_history`, `notifications` | `sortBy=createdAt` dan urutan list pada §5.2 membutuhkan timestamp; nilainya ikut di respons API |

## Hasil pengujian

Semua baris di bawah berasal dari eksekusi nyata pada 31 Oktober 2026 di mesin pengembangan
(macOS, Node 24.21.0, PostgreSQL 16 port 5433). Nilai dapat berubah bila data demo diubah lagi
(mis. setelah cek jaringan atau prediksi ulang), karena skor risiko dihitung dari data aktual.

### Checklist §8.2 dokumen

| Fitur | Status | Bukti yang diamati |
|---|---|---|
| Register & login | Sebagian | Login `admin` dan `teknisi1` berhasil dan menerima JWT (UI emulator + web). Registrasi tidak diuji ulang pada fase 4 karena mobile tidak memiliki layar registrasi; endpoint berasal dari fase 1. |
| Password hashing | ✅ | Kolom `passwordHash` di database berisi hash bcrypt `$2a$10$…` sepanjang 60 karakter untuk kedua user; password asli tidak tersimpan |
| CRUD asset | ✅ | Aset `TST-901` dibuat lewat form admin (lokasi DC-3/Rack F/U05, IP 10.9.0.9), diubah (nama + status Maintenance), lalu dihapus; daftar kembali ke **9 aset** |
| Search & filter | ✅ | Pencarian "srv" → 3 hasil; filter status Maintenance → 1 hasil; filter maintenance jenis Rutin → 3 catatan, Perbaikan → 6 catatan |
| Maintenance | ✅ | 2 catatan baru dibuat lewat form admin; `REPAIR` membuat status aset menjadi Maintenance, catatan dengan hasil `Resolved - …` mengembalikan status ke Aktif; total menjadi 14 catatan |
| Network upsert | ✅ | Aksi **Cek** pada SRV-001 mengubah status Offline → Online dan memperbarui "Terakhir dicek" menjadi 31 Okt 2026 12:31 |
| AI Prediction | ✅ | SRV-001 = **83.5 Tinggi** (confidence 95, 15 hari) pada data awal; kondisi ini disiapkan `docs/scripts/smoke.sh` lewat API, bukan oleh seed. Setelah cek jaringan mengubah status menjadi Online, prediksi ulang menghasilkan **76.0 Tinggi**. Batch 9 aset pada gate akhir: **6 rendah / 2 sedang / 1 tinggi**, skor rata-rata **26.91** (SRV-004 naik ke Sedang setelah 2 catatan maintenance baru) |
| AI Alert | ✅ | Setiap prediksi HIGH menambah satu `AI_ALERT` untuk admin dan satu untuk teknisi1. Badge admin 4 → 5 setelah batch (web); pada emulator badge 0 → 2 setelah dua kali batch, lalu 2 → 1 setelah satu alert dibaca |
| Notification | ✅ | Mark read: badge 5 → 4 (web) dan 2 → 1 (emulator, unread count API ikut turun); "Tandai semua dibaca": 5 notifikasi, badge hilang; hapus satu: "Notifikasi dihapus."; hapus yang dibaca: 5 dihapus, empty state tampil |

### Jest coverage backend (§11.2)

Dijalankan dengan `npm run test:coverage` pada 31 Oktober 2026 di mesin yang sama: **10 suite,
108 test lulus**, memakai database khusus `datacenter_tracker_test` (database demo tidak disentuh).

| Metrik | Hasil terukur | Threshold |
|---|---|---|
| Statements | 766/841 (**91.08%**) | 70% |
| Branches | 211/281 (**75.08%**) | 60% |
| Functions | 171/180 (**95.00%**) | 70% |
| Lines | 756/830 (**91.08%**) | 70% |

Cakupan `src/**/*.ts` kecuali `src/server.ts`. Seluruh 37 endpoint dieksekusi lewat `supertest`,
termasuk jalur 400/401/403/404/409, pagination, urutan, perpindahan lokasi, aturan status maintenance,
upsert/cek jaringan, skor acuan 83.5, rotasi `isActive`, batch `failed[]`, alert HIGH hanya untuk user
aktif, dan scoping notifikasi per user. Angka di atas adalah hasil `npm run test:coverage`, bukan
estimasi.

### Brief 9 — jadwal dan pengingat (4 November 2026)

`npm run test:coverage` pada branch `feat/maintenance-schedule`: **12 suite, 116 test lulus**.

| Metrik | Hasil terukur | Threshold |
|---|---|---|
| Statements | 827/919 (**89.98%**) | 70% |
| Branches | 231/313 (**73.80%**) | 60% |
| Functions | 186/198 (**93.93%**) | 70% |
| Lines | 816/907 (**89.96%**) | 70% |

Seluruh **39 endpoint** dieksekusi lewat `supertest`, termasuk batas jadwal (kemarin, hari ini, +7,
+8, +30, +31), `window` tidak valid (400), tanpa token (401), teknisi pada trigger (403), fan-out
idempoten, pengingat baru setelah `nextSchedule` berubah, pembuatan ulang setelah notifikasi dihapus,
dan user nonaktif yang tidak pernah menerima pengingat.

Verifikasi perangkat pada **Infinix X6882** (Android 14, Expo Go) memakai backend lokal dan database
test berisi seed:

- Dashboard menampilkan kartu **Jadwal Maintenance** dengan 1 terlewat, 2 ≤ 7 hari, 2 8–30 hari.
- Tab **Terlewat (1) / 7 hari (2) / 30 hari (4)** menampilkan baris yang sesuai, terlewat lebih dulu.
- Tombol **Jalankan pengingat** (admin) menampilkan konfirmasi lalu
  "Tidak ada pengingat baru. 3 jadwal dipindai, 6 sudah pernah dikirim." pada eksekusi kedua.
- Pusat notifikasi menampilkan `MAINTENANCE_REMINDER` dengan ikon amber; ketuk → detail maintenance.
  Setelah baris maintenance dihapus, ketuk pengingat membuka tab **Maintenance** aset terkait.
- Teknisi tidak melihat tombol pengingat.

### Brief 10 — ubah profil (4 November 2026)

`npm run test:coverage` pada branch `feat/profile-edit`: **13 suite, 133 test lulus** (tanpa migrasi;
`PATCH /api/users/me` adalah ekstensi ketiga, total **40 endpoint**).

| Metrik | Hasil terukur | Threshold |
|---|---|---|
| Statements | 864/962 (**89.81%**) | 70% |
| Branches | 250/337 (**74.18%**) | 60% |
| Functions | 190/203 (**93.59%**) | 70% |
| Lines | 853/950 (**89.78%**) | 70% |

Suite baru `profile.api.test.ts` berisi 17 test: ubah nama/email, email sendiri tidak konflik, teknisi
boleh mengubah profilnya sendiri, ganti password (hash bcrypt baru, password lama ditolak, token lama
tetap sah), kombinasi nama+email+password, password saat ini salah, password tanpa `currentPassword`,
`currentPassword` tanpa password, password < 8 karakter, email tidak valid, email milik user lain
(409), `username`/`role`/`isActive` ditolak 400, body kosong, tanpa token, token tidak valid, tidak ada
rute ubah user lain, dan akun nonaktif.

Verifikasi perangkat pada **Infinix X6882** (Android 14, Expo Go) dengan backend lokal
(`localhost:3000` lewat `adb reverse`) dan database demo:

- Layar Profil menampilkan tombol **Edit profil** untuk admin dan teknisi; panel berisi nama lengkap,
  email, lalu bagian password (baru, konfirmasi, saat ini).
- Nama "Administrator DC" → header dan avatar berubah ("AD") dan toast "Profil berhasil diperbarui."
  muncul. Mengganti nama depan menjadi "Admin DC" mengubah sapaan dashboard menjadi "Admin" tanpa
  muat ulang.
- Email diubah ke `admin.dc@datacenter.local` dan langsung tampil di kartu Informasi akun; email milik
  teknisi ditolak dengan pesan di field email **"Email sudah dipakai akun lain."**
- Validasi di layar: password < 8 karakter, konfirmasi tidak cocok, dan password saat ini kosong
  tampil sebagai tiga pesan inline sebelum request dikirim.
- Password saat ini yang salah dijawab server dan tampil sebagai **"Password saat ini salah."**
- Ganti password → toast lalu kembali ke layar login; password lama menghasilkan
  "Invalid username or password", password baru berhasil masuk. Password akun demo dikembalikan ke
  nilai seed setelah pengujian.
- Teknisi (Budi Santoso) dapat mengubah profilnya sendiri ("Budi Teknisi", toast sukses, avatar "BT"),
  lalu nilainya dikembalikan. Tidak ada kontrol untuk mengubah user lain.

### Brief 11 — push notification FCM (4 November 2026)

`npm run test:coverage` pada branch `feat/push-notifications`: **14 suite, 143 test lulus** (migrasi
baru `20261104120000_add_device_tokens`, 2 endpoint perangkat, total **42 endpoint**).

| Metrik | Hasil terukur | Threshold |
|---|---|---|
| Statements | 955/1064 (**89.75%**) | 70% |
| Branches | 281/382 (**73.56%**) | 60% |
| Functions | 211/224 (**94.19%**) | 70% |
| Lines | 943/1051 (**89.72%**) | 70% |

Suite `push.test.ts` berisi 10 test: upsert token yang sama tanpa duplikat, pemindahan token ke user
yang sedang login, validasi 400, 401, hapus satu/semua hanya milik pemanggil, hapus token user lain
ditolak dengan `deleted: 0`, push `AI_ALERT` setelah prediksi HIGH commit (tanpa push untuk LOW),
push `MAINTENANCE_REMINDER` hanya untuk baris yang baru dibuat (eksekusi kedua tidak mengirim ulang),
pemangkasan token `registration-token-not-registered`/`invalid-argument`, kegagalan sementara tidak
memangkas token, dan provider no-op saat `PUSH_ENABLED=false` atau service account tidak ada.

Build release Android berhasil dengan `google-services.json` (file tidak di-commit):
`npx expo prebuild --platform android --no-install` lalu `./gradlew assembleRelease` →
`BUILD SUCCESSFUL`; Gradle memakai plugin `com.google.gms.google-services`. Verifikasi perangkat pada
**Infinix X6882** (Android 14) dengan backend lokal (`adb reverse tcp:3000 tcp:3000`):

- Setelah login, dialog izin notifikasi muncul satu kali (`/tmp/push-permission.png`); setelah
  **Izinkan**, database berisi **1** baris `device_tokens`, panjang token **142**, platform
  **ANDROID** (token tidak pernah dicetak). Membuka ulang aplikasi tidak menambah baris (tetap 1).
- Logout menghapus baris tersebut (hitungan kembali **0**) dan aplikasi kembali ke layar login.
- Setelah service account dipasang dan `PUSH_ENABLED=true`, log boot berisi
  `Push notifications enabled (FCM)`; tanpa itu provider menjadi no-op dan log memuat peringatan
  `Push notifications disabled (PUSH_ENABLED=false or missing service account)`.
- Untuk menjangkau backend `http://localhost:3000`, APK uji lokal memakai manifest hasil generate
  yang ditambahi `usesCleartextTraffic="true"`; perubahan itu hanya ada di `android/` yang
  di-ignore dan **tidak** masuk commit.

**Pengiriman push terverifikasi pada 4 November 2026** dengan APK release dan backend yang memakai
service account Firebase. Pada **Infinix X6882** (Hot 50 4G, Android 14):

- Pesan uji yang dikirim dari Firebase Console sampai ke perangkat, baik aplikasi terbuka maupun di
  latar belakang.
- Jalur otomatis juga sampai: prediksi HIGH membuat notifikasi `AI_ALERT`, dan pengingat maintenance
  membuat `MAINTENANCE_REMINDER`; mengetuk masing-masing membuka detail aset dan detail maintenance.
- Kebenaran baris in-app tetap terjaga: push hanya dikirim setelah baris `notifications` commit, dan
  eksekusi pengingat kedua tidak mengirim ulang pesan yang sama.

Yang tetap bergantung pada lingkungan pemilik berikutnya: membuat proyek Firebase sendiri, meletakkan
service account di server dengan izin baca untuk akun proses backend, menyalakan `PUSH_ENABLED`, dan
membangun ulang APK dengan `google-services.json` milik proyek tersebut. Langkahnya ada di
`docs/FIREBASE_SETUP.md`.

### Alur aplikasi (emulator Android dan web)

| Alur | Platform | Hasil yang diamati |
|---|---|---|
| Login | emulator, web | Masuk ke Dashboard setelah kredensial benar; kredensial salah menampilkan pesan API secara inline |
| Auto-login | emulator | Menutup lalu membuka aplikasi langsung ke Dashboard tanpa login ulang |
| Dashboard | emulator, web | Total 9, Aktif 6, Maintenance 2, Nonaktif 1; risiko Rendah 7 / Sedang 1 / Tinggi 1 dan rata-rata 25.26 pada data awal; pada gate akhir (setelah maintenance SRV-004) 6 / 2 / 1 dan rata-rata 26.91 |
| Kartu risiko tinggi | emulator | Mengetuk "1 Aset Berisiko Tinggi — SRV-001" membuka `/asset/10` |
| Daftar aset | emulator, web | 9 aset, pencarian, filter, pagination 6 + 3 |
| Detail aset | emulator, web | 4 tab (Umum, Jaringan, Maintenance, AI); Jaringan menampilkan hostname/IP/status; AI menampilkan 83.5 Tinggi |
| Maintenance list/detail | emulator, web | 12 catatan → filter Rutin 3; detail menampilkan tanggal, teknisi, biaya, jadwal berikutnya |
| Jaringan | emulator, web | 8 perangkat; aksi Cek hanya tampil untuk admin |
| AI tab | web, emulator | Rata-rata, jumlah per level, top 5 (2 aset pada data uji), dialog explain dengan rincian lapisan 64.51 + 5.00 + 6.50 = 76.01 |
| Notifikasi | emulator, web | Badge, urutan belum dibaca, mark read, mark all, hapus, waktu relatif |
| Form aset (tambah/ubah/hapus) | web | Lokasi + jaringan tersimpan; edit terisi otomatis; hapus butuh konfirmasi; hapus SRV-001 ditolak dengan pesan konflik yang terbaca |
| Form maintenance | web | Pemilih aset mencari "SRV-004"; teknisi otomatis Administrator; aturan status terbukti |
| Teknisi | web (emulator: lihat catatan) | Tidak ada tombol tambah/ubah/hapus/cek/prediksi; rute `/asset/new` menampilkan "Akses ditolak" |
| Logout | emulator, web | Konfirmasi, sesi dihapus, kembali ke layar login |
| 401 | web | Dengan `JWT_SECRET` sementara diputar, permintaan berikutnya memicu logout otomatis dan redirect ke login |
| Metro | web + Android | Tidak ada peringatan "Require cycle" setelah refactor |

Catatan: seluruh pengujian menggunakan data demo lokal. Backend berjalan di `localhost:3000`; emulator
mengaksesnya lewat `10.0.2.2:3000` atau `adb reverse`. Tidak ada data, kredensial, atau layanan eksternal
yang dipakai.

Catatan emulator: mesin pengembangan menjalankan beberapa sesi lain sehingga emulator beberapa kali
berhenti merespons. Saat itu `adb exec-out screencap` mengembalikan 0 byte, `adb pull` gagal dengan
`Transport endpoint is not connected`, dan dialog sistem "System UI isn't responding" muncul. Alur yang
berhasil diamati di emulator: login/auto-login, dashboard, daftar + pencarian aset, detail 4 tab,
maintenance daftar/filter/detail, cek jaringan, tab AI + batch predict, pusat notifikasi + mark read,
dan form tambah aset (render + isi sebagian field). Alur tambah/ubah/hapus aset sampai tuntas,
form maintenance sampai tuntas, tampilan teknisi, dan logout diamati di web (Chromium) dengan backend
dan data yang sama; baris tabel di atas mencantumkan platformnya.

## Batasan dan non-goals

Batasan yang diketahui:

- Registrasi admin kedua membutuhkan token admin (aturan keamanan); mobile belum memiliki layar
  registrasi.
- Form maintenance tidak dapat memilih teknisi lain karena API tidak menyediakan daftar user; teknisi
  diisi otomatis dari akun yang login.
- API memperlakukan kolom teks opsional yang kosong sebagai "tidak diubah", jadi mengosongkan nama
  merek/model/serial/deskripsi atau field jaringan tidak menghapus nilai lama. Sub-field lokasi
  (rak, slot, lantai, ruangan) dapat dikosongkan selama data center tetap diisi, karena lokasi
  dikirim ulang sebagai satu baris baru.
- Simulasi cek jaringan tidak mengirim ICMP; server mengundi Online (80%) / Offline (20%).
- Token disimpan di AsyncStorage (tidak terenkripsi). Untuk produksi sebaiknya `expo-secure-store`.
- Backend lokal memakai HTTP tanpa TLS; hanya untuk pengembangan.
- Tombol back perangkat pada Expo Go di emulator tidak memicu navigasi; tombol back pada header aplikasi
  berfungsi.
- Verifikasi UI utama dilakukan pada HP fisik **Infinix X6882** (Hot 50 4G, Android 14) dan web;
  emulator tidak dipakai pada fase-fase terakhir.

Non-goals (tidak dikerjakan): Fase 6 (EAS build, APK/IPA, distribusi), HTTPS, rate limiting, Sentry,
Docker, CI/CD, iOS APNs, topik/segmen push, push terjadwal, mode offline SQLite, unggah gambar,
export PDF/Excel, dark mode, QR scanner, adaptive weight, dan direktori `ai-service/`.

## Riwayat pengembangan

Pengerjaan dibagi menjadi 4 fase utama, masing-masing pada branch fitur sendiri lalu di-merge ke `main`
dengan `--no-ff` agar setiap fase terlihat di riwayat, ditambah satu brief penguatan pengujian backend.

| Fase | Isi | Branch | Commit |
|---|---|---|---|
| 1 | Backend core: bootstrap, Prisma/JWT, asset, maintenance, network | `feat/backend-core` | `chore: bootstrap backend server and config`, `feat: add prisma schema, seed, and jwt auth`, `feat: add asset module with crud, search, and statistics`, `feat: add maintenance history module`, `feat: add network information module` |
| 2 | Mesin risiko hibrida, notifikasi, alert HIGH, unit test | `feat/ai-engine` | `feat: add hybrid risk prediction engine`, `feat: add notification module and high-risk alerts`, `test: add ai engine unit tests and api smoke check` |
| 3 | Mobile core: login/auto-login, dashboard, daftar aset, detail 4 tab, profil | `feat/mobile-core` | `feat: add expo router foundation and login flow`, `feat: add dashboard and asset list`, `feat: add asset detail tabs and profile screen` |
| 4 | Layar operasional (maintenance, jaringan, AI, notifikasi), form admin, refactor require cycle, dokumentasi | `feat/mobile-ops-docs` | `feat: add maintenance, network, and ai screens`, `feat: add notification center and admin forms`, `refactor: remove auth store require cycle`, `docs: update readme and handoff for delivered scope` |
| 5 | Penguatan pengujian backend: integration suite 37 endpoint, database test terpisah, threshold coverage, dokumentasi | `test/backend-coverage` | `test: add api integration suites`, `test: enforce coverage threshold`, `docs: document test coverage` |

Detail status terakhir dan cara melanjutkan: `docs/HANDOFF.md`. Kontrak API:
`docs/API_CONTRACT.md`. Penjelasan modul per modul, rumus risiko, model data, dan alur mobile:
`docs/MODULES.md`. Cara memakai layar dan skenario demo: `docs/USER_GUIDE.md`. Lisensi pihak ketiga:
`THIRD_PARTY_NOTICES.md`.
