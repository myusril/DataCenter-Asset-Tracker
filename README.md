# DataCenter Asset Tracker

Aplikasi inventaris dan asset tracking data center untuk teknisi dan administrator: pencatatan aset
(server, switch, router, storage, firewall, rack), riwayat lokasi, informasi jaringan, riwayat
maintenance, serta prediksi risiko untuk preventive maintenance.

- Backend: REST API **Express 5 + TypeScript + Prisma 6.19.3 + PostgreSQL 16**, 37 endpoint, 7 tabel.
- Mobile: aplikasi **Expo SDK 58 / React Native 0.88** (Expo Router, Zustand, axios) untuk Android
  (emulator) dan web.
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
7. [Daftar perintah](#daftar-perintah)
8. [Akun demo](#akun-demo)
9. [Mesin prediksi risiko](#mesin-prediksi-risiko)
10. [Struktur repository](#struktur-repository)
11. [Kesesuaian dengan dokumen](#kesesuaian-dengan-dokumen)
12. [Hasil pengujian](#hasil-pengujian)
13. [Batasan dan non-goals](#batasan-dan-non-goals)
14. [Riwayat pengembangan](#riwayat-pengembangan)

## Fitur

**Backend**

- Auth JWT + bcrypt, role `ADMIN`/`TECHNICIAN`, aturan registrasi admin bootstrap.
- Asset: CRUD, pencarian, filter tipe/status/rack, pengurutan, pagination, statistik, riwayat lokasi
  (1:N) dan informasi jaringan (1:1).
- Maintenance: CRUD, filter, statistik, sinkronisasi status aset (Perbaikan/Upgrade/Penggantian →
  Maintenance; hasil diawali `Resolved` → Aktif).
- Network: upsert per aset, update, hapus, simulasi cek koneksi (80% Online / 20% Offline), statistik.
- AI: prediksi tunggal/batch, riwayat prediksi berversi (`isActive`), explain tanpa menyimpan, ringkasan
  risiko dashboard, alert otomatis untuk prediksi HIGH.
- Notification: 7 endpoint dengan scoping per user, unread count, mark read, mark all, hapus satu,
  hapus yang sudah dibaca.

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
- Jaringan: daftar perangkat dengan status koneksi, pencarian hostname/IP, filter status, dan aksi
  **Cek** (khusus admin) yang memperbarui status + waktu cek.
- AI: skor rata-rata, jumlah per level, maksimal 5 aset berisiko tertinggi dengan bar skor, dialog
  rincian perhitungan dari `GET /api/ai/explain/:assetId`, tombol **Prediksi semua aset** (admin).
- Notifikasi: badge belum dibaca pada tab, urutan belum dibaca lebih dulu, tandai dibaca saat diketuk,
  tandai semua dibaca, hapus satu, hapus yang sudah dibaca, waktu relatif, ketuk alert → detail aset.
- Admin: form tambah/ubah aset (Umum + Lokasi + Jaringan, validasi inline), hapus aset dengan dialog
  konfirmasi dan pesan konflik 409 yang terbaca, form catat maintenance dengan pemilih aset.
- Teknisi: seluruh kontrol tulis disembunyikan; rute admin yang dibuka langsung menampilkan
  "Akses ditolak".

## Arsitektur

```
┌──────────────────────────┐        HTTP/JSON        ┌───────────────────────────┐
│  Mobile (Expo SDK 58)    │  Authorization: Bearer  │  Backend (Express 5, TS)  │
│  Expo Router + Zustand   │ ──────────────────────> │  37 endpoint REST         │
│  axios + AsyncStorage    │ <────────────────────── │  JWT + bcrypt + Zod       │
└──────────────────────────┘                         └─────────────┬─────────────┘
                                                                   │ Prisma 6.19.3
                                                                   ▼
                                                     ┌───────────────────────────┐
                                                     │  PostgreSQL 16 (port 5433)│
                                                     │  7 tabel + enum           │
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
| Android SDK | emulator `Medium_Phone_API_36.1` (Android 16 / API 36) + Expo Go 58 | Verifikasi UI utama |
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
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npx expo start --android   # emulator Android
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web      # browser (pemeriksaan sekunder)
```

`EXPO_PUBLIC_API_URL` adalah satu-satunya sumber alamat API; tidak ada alamat IP di dalam kode. Nilai
jatuh ke `http://localhost:3000` bila variabel tidak diisi.

| Target | Nilai | Catatan |
|---|---|---|
| Emulator Android | `http://10.0.2.2:3000` | `10.0.2.2` adalah alias host dari emulator |
| Web / iOS simulator | `http://localhost:3000` | |
| Perangkat fisik | `http://<IP-LAN-komputer>:3000` | HP dan komputer harus satu jaringan |
| Alternatif emulator | `adb reverse tcp:3000 tcp:3000` + `http://localhost:3000` | Dipakai saat verifikasi akhir |

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
| `npm run android` / `npm run web` | Buka di emulator Android / browser |
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
│   ├── prisma/               # schema 7 tabel + seed demo
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
│   │   ├── hooks/            # useIsAdmin
│   │   ├── store/            # auth (Zustand + persist), notifications (badge)
│   │   ├── theme/            # warna dan spacing
│   │   ├── types/            # tipe respons API
│   │   └── utils/            # format tanggal/angka, warna pill
│   └── README.md
└── docs/
    ├── API_CONTRACT.md       # kontrak 37 endpoint
    ├── HANDOFF.md            # status & cara melanjutkan
    └── scripts/smoke.sh      # smoke test alur API
```

## Kesesuaian dengan dokumen

Dokumen sumber: *DataCenter Asset Tracker — Backend & Roadmap* (31 halaman). Tabel ini memetakan
bagian dokumen ke hasil yang benar-benar ada di repository.

| Bagian dokumen | Tuntutan | Yang dikerjakan |
|---|---|---|
| §3 Struktur project | Backend moduler + mobile Expo | Backend `src/modules/*` (6 modul) dan mobile di `mobile/` dengan route `src/app/...` |
| §4 Database schema | 7 tabel + enum | 7 tabel Prisma (`users`, `assets`, `asset_locations`, `network_information`, `maintenance_history`, `ai_predictions`, `notifications`) + 7 enum |
| §5 Backend modules | Auth 3, Asset 6, Maintenance 7, Network 8, AI 6, Notification 7 | Total **37 endpoint** sesuai tabel §7.1 dan `docs/API_CONTRACT.md` |
| §6 AI hybrid engine | 3 lapisan, contoh 83.5 HIGH | 3 lapisan seperti dijelaskan di atas; contoh SRV-001 direproduksi (69.5 + 5 + 9) |
| §8.1 Test flow | Health, login, create asset, maintenance, predict, notifications | Dijalankan; hasil di tabel "Hasil pengujian" |
| §8.2 Checklist | 9 baris fitur | Diisi dengan bukti pengamatan nyata (lihat tabel berikut) |
| §11.2 TODO Production | Unit test Jest minimal 70% coverage | 10 suite / 108 test; statements 91.08%, lines 91.08%, functions 95.00%, branches 75.08% (threshold ditegakkan di `jest.config.mjs`) |
| §12.1 Sprint 1–4 mobile | Foundation → auth → dashboard/aset → operasional/AI | 4 fase mobile selesai (dashboard, aset, detail 4 tab, maintenance, jaringan, AI, notifikasi, form admin, profil) |
| Fase 1 Asset management (roadmap) | List, search, filter, detail, navigasi | Selesai |
| Fase 2 Operational features | Maintenance list/detail, network screen | Selesai |
| Fase 3 AI & notification | AI screen, top 5, notification center, badge, alert card | Selesai |
| Fase 4 Admin capabilities | Form tambah/edit/hapus aset, form maintenance | Selesai |
| Fase 5 Polish & testing | Profil, uji di perangkat, perbaikan UI, HANDOFF | Selesai untuk emulator Android + web; uji di HP fisik belum |
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
- Uji di HP fisik belum dilakukan; verifikasi UI memakai emulator Android dan web.

Non-goals (tidak dikerjakan): Fase 6 (EAS build, APK/IPA, distribusi), HTTPS, rate limiting, Sentry,
Docker, CI/CD, push notification, mode offline SQLite, unggah gambar, export PDF/Excel, dark mode, QR
scanner, adaptive weight, dan direktori `ai-service/`.

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

Detail status terakhir dan cara melanjutkan: `docs/HANDOFF.md`. Kontrak API: `docs/API_CONTRACT.md`.
