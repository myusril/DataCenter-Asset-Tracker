# DataCenter Tracker — Aplikasi Mobile

Aplikasi mobile untuk inventaris dan pemantauan aset data center. Dibangun dengan **Expo SDK 58**,
**React Native 0.88**, **TypeScript**, **Expo Router**, **Zustand**, dan **axios**. Semua teks untuk
pengguna berbahasa Indonesia; gaya visual memakai `StyleSheet` biasa tanpa UI kit dan tanpa library
grafik.

## Fitur

- **Login + auto-login** — `username` + `password`, pesan error dari API tampil inline. Token dan data
  user disimpan di AsyncStorage, sehingga sesi bertahan setelah aplikasi ditutup. Respons 401 dari
  endpoint mana pun (selain login) menghapus sesi dan kembali ke layar login.
- **5 tab** — Dashboard, Aset, Risiko, Notifikasi (dengan badge belum dibaca), Profil.
- **Dashboard** — hero total aset + ring sebaran risiko (rincian level ada di kartu Ringkasan
  Risiko), bar bertumpuk kondisi aset dengan legenda, bar sebaran tipe, skor rata-rata, kartu aset
  paling berisiko (kode + skor), serta akses cepat ke Maintenance, Jaringan, Semua Aset, dan Profil.
- **Daftar aset** — pencarian dengan debounce 400 ms, satu tombol **Filter** yang membuka panel
  tipe + status (chip aktif bisa dilepas satu per satu), pagination 6 aset per halaman,
  pull-to-refresh, empty state. Admin melihat tombol **+ Aset**.
- **Detail aset** — header gradien sesuai status, tab **Umum / Jaringan / Maintenance / Risiko**. Kartu maintenance dapat
  diketuk untuk membuka halaman detail maintenance. Tab Risiko menampilkan prediksi aktif, rincian lapisan
  (`GET /api/ai/explain/:id`), faktor utama, dan rekomendasi; admin mendapat tombol **Prediksi ulang**.
  Admin juga mendapat tombol ubah (ikon pensil di header), ubah data, dan hapus dengan dialog konfirmasi.
- **Maintenance** — daftar seluruh riwayat dengan filter jenis, pagination, pull-to-refresh; halaman
  detail menampilkan aset, tanggal, teknisi, biaya, jadwal berikutnya, uraian, dan hasil. Admin dapat
  menambah catatan lewat form dengan pemilih aset yang bisa dicari.
- **Jadwal maintenance** — layar `/schedule` dengan tab **Terlewat / 7 hari / 30 hari** beserta
  jumlahnya, baris terlewat lebih dulu (tanggal jatuh tempo, sisa/lewat hari, hasil terakhir), empty
  state per tab, dan pull-to-refresh. Dashboard menampilkan kartu jadwal dengan jumlah terlewat.
  Admin mendapat aksi **Jalankan pengingat** (konfirmasi + ringkasan `scanned/created/skipped`).
- **Jaringan** — daftar perangkat dengan status koneksi, pencarian hostname/IP, filter status, waktu
  cek terakhir. Admin mendapat aksi **Cek** yang memperbarui baris dan menampilkan ringkasan hasil.
- **Risiko** — skor rata-rata dalam arc gauge, jumlah per level, penjelasan tiga lapisan (aturan,
  statistik, pola), maksimal 5 aset berisiko tertinggi dengan bar skor, panel rincian perhitungan per
  aset, dan tombol **Prediksi semua aset** (admin) dengan ringkasan hasil.
- **Notifikasi** — urutan belum dibaca lebih dulu, badge pada tab, tandai dibaca saat diketuk, menu
  **Kelola** (ikon tiga titik) untuk menandai semua dibaca dan menghapus yang sudah dibaca (dengan
  konfirmasi), hapus satu, waktu relatif, dan ketuk notifikasi untuk membuka tujuannya: alert AI →
  detail aset, pengingat maintenance → detail maintenance (atau tab Maintenance aset bila catatan
  sudah dihapus). Ikon pengingat memakai warna amber.
- **Form admin aset** — bagian Umum, Lokasi, dan Jaringan; validasi inline tanpa library schema;
  prefill saat mengedit; pesan konflik 409 yang terbaca (kode/serial duplikat, aset masih punya
  riwayat).
- **Profil** — identitas, role, versi aplikasi, dan logout dengan konfirmasi. Semua role mendapat
  panel **Edit profil** (`PATCH /api/users/me`): nama lengkap dan email diperbarui inline, password
  opsional beserta konfirmasi dan password saat ini, validasi di layar sebelum dikirim, toast sukses,
  dan store auth langsung diganti sehingga greeting/avatar tidak menunggu muat ulang. Email duplikat
  tampil sebagai pesan di field email; password saat ini yang salah tampil di field tersebut; setelah
  password berganti aplikasi keluar ke layar login agar kredensial baru terbukti.

## Sistem desain (fase 1 + 2)

Fase 1 merapikan lima layar inti: login, tab shell, Dashboard, daftar aset, detail aset, dan Risiko.
Fase 2 memakai sistem yang sama untuk layar operasional: Maintenance (daftar, detail, formulir),
Jaringan, Notifikasi, Profil, serta formulir tambah/ubah aset.

- **Token** — `src/theme/colors.ts` (palet), `spacing.ts` (spacing 4–40, radius 12/16/20/28, skala
  huruf 11/12/14/16/20/28), `typography.ts` (Plus Jakarta Sans per bobot), `tokens.ts` (satu lapis
  bayangan, gradien, durasi motion, warna grafik).
- **Header** — `GradientHeader` (hero di Dashboard/Profil/Notifikasi, `compact` di layar turunan) dengan
  tombol kaca `IconButton`; daftar aset memakai judul besar tanpa gradien seperti fase 1.
- **Kartu & status** — `ChartCard`, `DataList`, `StatusPill`, `Chip`, dan `SegmentedTabs`; skeleton
  (`ListSkeleton`, `NotificationListSkeleton`, `RecordDetailSkeleton`, `FormSkeleton`), `EmptyState`
  berilustrasi, serta `Toast` (dipakai di detail aset) untuk umpan balik singkat.
- **Font** — Plus Jakarta Sans 400/500/600/700/800 dimuat di `src/app/_layout.tsx`; splash ditahan
  sampai font dan sesi siap sehingga layar pertama tidak berkedip.
- **Grafik** — `DonutChart`, `BarChart`, dan `RiskGauge` memakai `react-native-svg`; semua angka berasal
  dari `GET /api/assets/statistics` dan `GET /api/ai/risk-summary` (tidak ada tren atau delta rekaan).
- **Motion** — hanya `Animated` bawaan React Native, durasi ≤ 250 ms, dan dimatikan/dipendekkan saat
  pengaturan *reduce motion* perangkat aktif (`useReducedMotion`).
- **Aksesibilitas** — kontras teks ≥ 4,5:1 (warna `*Ink` untuk teks di atas latar lembut), target sentuh
  ≥ 44 dp, teks tidak terpotong pada skala font 1,2×, dan tab memakai `adjustsFontSizeToFit`.
- **Status** — hijau/amber/merah tetap dipakai untuk status aset; teks memakai varian `successInk`,
  `warningInk`, dan `dangerInk` agar tetap terbaca.
- **Risiko bukan AI** — mesin heuristik deterministik (aturan, statistik, pola). Tidak ada klaim
  machine learning atau akurasi model.

## Prasyarat

- Node.js 24.21.0 (dokumen sumber menulis Node 22).
- Backend berjalan di `http://localhost:3000` dengan PostgreSQL 16 (port 5433) dan data seed — lihat
  `../README.md` dan `../backend/README.md`.
- Android **Infinix X6882 (Hot 50 4G)** — Android 14, arm64 — dengan Expo Go 58 untuk verifikasi utama.
  Emulator tidak dipakai pada fase desain ini.

## Menjalankan

```bash
# 1. Backend (terminal terpisah, dari folder backend)
npm install
npm run dev

# 2. Aplikasi mobile
cd mobile
npm install
cp .env.example .env

# Emulator Android (alamat host dari dalam emulator)
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npx expo start --android

# Alternatif emulator: teruskan port lalu pakai localhost
adb reverse tcp:3000 tcp:3000
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --android

# Web (pemeriksaan sekunder)
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web
```

Pemeriksaan tipe:

```bash
cd mobile
npm run typecheck     # tsc --noEmit
```

### Konfigurasi alamat API

`EXPO_PUBLIC_API_URL` adalah satu-satunya sumber alamat API. Nilai jatuh ke `http://localhost:3000`
bila variabel tidak diisi, dan tidak ada alamat IP yang ditulis di dalam kode.

| Target | Nilai | Catatan |
|---|---|---|
| Android emulator | `http://10.0.2.2:3000` | `10.0.2.2` adalah alias host dari emulator |
| Web / iOS simulator | `http://localhost:3000` | |
| Perangkat fisik | `http://<IP-LAN-komputer>:3000` | HP dan komputer harus satu jaringan |
| Alternatif emulator | `adb reverse tcp:3000 tcp:3000` + `http://localhost:3000` | |

File `.env` tidak di-commit; hanya `.env.example` yang masuk repositori.

## Build APK (Android, lokal)

APK dibangun langsung dengan Gradle di mesin pengembang; tidak memakai EAS, akun Expo, atau
unggahan ke toko aplikasi.

Prasyarat: JDK 17 dan Android SDK dengan build-tools 36.1.0. Isi `JAVA_HOME` dan `ANDROID_HOME` sesuai
lokasi instalasi di mesin Anda. Alamat API diberikan saat build lewat `EXPO_PUBLIC_API_URL` (lihat
bagian "Konfigurasi alamat API"); nilainya ditanam ke dalam bundel, jadi mengganti alamat berarti
build ulang dan alamat sungguhan tidak boleh ditulis ke file yang di-commit.

### APK release — default untuk uji di HP

APK release menanam JavaScript di dalam APK, sehingga aplikasi berjalan tanpa Metro, tanpa kabel, dan
tanpa dev server. Template Expo menandatanganinya dengan debug keystore: cukup untuk uji coba di
perangkat sendiri, bukan untuk toko aplikasi.

```bash
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

cd mobile
export EXPO_PUBLIC_API_URL=<alamat-api>        # must stay exported for Gradle too
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease

ls -lh app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/release/app-release.apk
```

### APK debug — hanya untuk pengembangan

APK debug tidak menanam JavaScript; aplikasi membacanya dari Metro saat runtime. Jalankan Metro dan
teruskan port 8081 ke perangkat sebelum membuka aplikasi:

```bash
cd mobile
EXPO_PUBLIC_API_URL=<alamat-api> npx expo start

adb reverse tcp:8081 tcp:8081
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Tanpa Metro, APK debug berhenti di "Unable to load script".

Catatan penting: `EXPO_PUBLIC_API_URL` dibaca saat Gradle membundel JavaScript, bukan hanya saat
`prebuild`. Kalau nilainya diubah setelah build sebelumnya, paksa bundel ulang:

```bash
export EXPO_PUBLIC_API_URL=<alamat-api>
cd mobile/android
./gradlew :app:createBundleReleaseJsAndAssets --rerun-tasks
./gradlew assembleRelease
```

Catatan:

- `android/` adalah hasil generate `expo prebuild` dan tidak di-commit (lihat `.gitignore`). Jalankan
  ulang `expo prebuild` setelah mengubah konfigurasi di `app.json`.
- ID aplikasi Android ada di `expo.android.package` (`com.datacentertracker.app`); ganti sebelum
  publikasi ke toko aplikasi.
- Kedua jenis APK ditandatangani dengan debug keystore; jangan dipakai untuk distribusi publik.

## Struktur

```
mobile/
├── app.json                 # nama, scheme, plugin expo-router
├── .env.example             # EXPO_PUBLIC_API_URL
└── src/
    ├── api/                 # client axios, session bridge, auth, users, assets, maintenance, network, ai, notifications
    ├── app/                 # route Expo Router
    │   ├── _layout.tsx      # hydration gate + Stack + pendaftaran handler 401
    │   ├── index.tsx        # redirect sesuai status login
    │   ├── (auth)/          # login
    │   ├── (tabs)/          # Dashboard, Aset, Risiko, Notifikasi, Profil
    │   ├── asset/           # new.tsx, [id]/index.tsx, [id]/edit.tsx
    │   ├── maintenance.tsx  # daftar maintenance
    │   ├── maintenance/     # [id].tsx, new.tsx
    │   ├── schedule.tsx     # jadwal maintenance + trigger pengingat (admin)
    │   └── network.tsx      # daftar jaringan
    ├── components/          # primitif desain: GradientHeader, ChartCard, DonutChart, BarChart, RiskGauge, SegmentedTabs, Skeleton, Sheet, Toast + komponen lama
    ├── hooks/               # useIsAdmin, useReducedMotion, useCountUp
    ├── store/               # auth (persist AsyncStorage), notifications (badge)
    ├── theme/               # colors, spacing, typography (Plus Jakarta Sans), tokens (elevation, gradien, motion)
    ├── types/api.ts         # tipe respons kontrak API
    └── utils/               # format tanggal/angka/waktu relatif, warna pill
```

## Keputusan dan deviasi

| # | Hal | Keputusan |
|---|---|---|
| 1 | Dokumen menaruh proyek di `mobile/DataCenterTracker/` | Proyek Expo berada langsung di `mobile/` dengan route di `mobile/src/app/`; bagian route dokumen memang sudah memakai `src/app/...` |
| 2 | Sprint 1 menulis Redux Toolkit, roadmap menulis Zustand | Zustand + `persist` ke AsyncStorage |
| 3 | Penyimpanan token | AsyncStorage karena aplikasi memakai Expo Go (tanpa modul native tambahan). Token tidak terenkripsi; produksi sebaiknya `expo-secure-store` |
| 4 | Rincian layer AI | Tabel `ai_predictions` tidak menyimpan `layerBreakdown`; tab AI dan dialog explain memakai `GET /api/ai/explain/:id` (read-only) dan menjelaskan bahwa nilainya dihitung ulang |
| 5 | Pagination daftar | 6 aset per halaman agar pagination benar-benar teruji dengan 9 aset seed |
| 6 | Pesan gagal login | Pesan dari API ditampilkan apa adanya (mis. `Invalid username or password`) |
| 7 | Tombol back perangkat | `predictiveBackGestureEnabled: false` mengikuti default Expo Go; di Expo Go pada emulator tombol back perangkat tidak memicu navigasi, tombol back header berfungsi |
| 8 | Role gating | Satu hook `useIsAdmin()` membaca `useAuthStore().user.role`; teknisi tidak melihat kontrol tulis dan rute admin menampilkan "Akses ditolak" |
| 9 | Teknisi pada form maintenance | API tidak punya daftar user, jadi teknisi otomatis diisi akun yang login (ditampilkan di form sebagai keterangan) |
| 10 | Mengosongkan field opsional | Kolom teks aset/jaringan yang kosong dianggap "tidak diubah" oleh API; sub-field lokasi dapat dikosongkan selama data center terisi. Form hanya mengirim bagian lokasi/jaringan yang benar-benar berubah saat mengedit, agar riwayat lokasi tidak bertambah tanpa alasan |
| 11 | Validasi form | Validasi ringan buatan sendiri (bukan Zod) untuk kode, panjang teks, format tanggal `YYYY-MM-DD`, IPv4, dan MAC; pesan error inline |
| 12 | Require cycle | `src/api/session.ts` menjadi jembatan token/handler 401; `client.ts` tidak mengimpor store, sehingga siklus `store/auth → api/client → store/auth` hilang tanpa mengubah perilaku |
| 13 | Dialog | Hapus aset memakai `ConfirmDialog` berbasis `Modal` (berfungsi di Android dan web), bukan `Alert.alert` yang tidak tampil di web |

## Verifikasi yang dijalankan

Verifikasi UI utama pada emulator **Medium_Phone_API_36.1** (Android 16 / API 36) dengan Expo Go 58 dan
`EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` (sebagian akhir memakai `adb reverse` + `localhost`), serta
`expo start --web` sebagai pemeriksaan tambahan. Backend berjalan lokal di port 3000.

| Alur | Platform | Hasil yang diamati |
|---|---|---|
| Login salah | web | Pesan inline dari API, bukan dump JSON |
| Login benar (admin, teknisi1) | emulator, web | Masuk ke Dashboard; sapaan memakai nama user |
| Auto-login | emulator | Aplikasi dibuka ulang langsung ke Dashboard |
| Dashboard | emulator, web | Total **9**, Aktif **6**, Maintenance **2**, Nonaktif **1**; risiko **7 / 1 / 1**; skor rata-rata **25.26** (data awal); kartu "1 Aset Berisiko Tinggi — SRV-001 · 83.5" membuka `/asset/10` |
| Daftar aset | emulator, web | 9 aset; pencarian "srv" → 3 hasil; filter status Maintenance → 1; pagination 6 + 3 tanpa duplikat |
| Detail aset (4 tab) | emulator, web | SRV-001 Maintenance, Dell / PowerEdge R750 / SN-DC-SRV-001; Jaringan `web-srv-01` / `192.168.1.10` / Offline; AI 83.5 Tinggi, confidence 95, 15 hari |
| Maintenance list | emulator, web | 12 catatan; filter Rutin → 3; Perbaikan → 6 (setelah 2 catatan baru) |
| Maintenance detail | emulator, web | Tanggal, teknisi, biaya, jadwal berikutnya, uraian, hasil; keterangan aturan `Resolved` |
| Jaringan | emulator | 8 perangkat; **Cek** pada SRV-001 mengubah Offline → Online, "Terakhir dicek" 31 Okt 2026 12:31, ringkasan hijau muncul |
| AI tab | web, emulator | Rata-rata 24.43–26.91, level 7 / 1 / 1 pada data awal lalu 6 / 2 / 1 pada gate akhir, top 2–3 aset; dialog explain: `64.51 + 5.00 + 6.50 = 76.01` |
| Prediksi tunggal | emulator | "Prediksi diperbarui: 76.0 Tinggi · 2 alert dibuat." |
| Prediksi batch | web, emulator | Web: badge admin 4 → 5. Emulator: toast "Prediksi selesai: 9 aset diproses · 1 tinggi · 2 sedang · 6 rendah · 2 alert baru." dan badge 0 → 2 setelah dua kali batch |
| Notifikasi | emulator, web | Badge 5, "5 belum dibaca"; mark read → 4; "Tandai semua dibaca" → 5 notifikasi, badge hilang; hapus satu → "Notifikasi dihapus."; hapus yang dibaca → 5 dihapus, empty state |
| Tambah aset | web | `TST-901` tersimpan dengan lokasi DC-3 / Rack F / U05 / lantai 3 / R2 dan jaringan 10.9.0.9 |
| Ubah aset | web | Form terisi otomatis (kode, nama, lokasi); nama + status berubah dan tampil di detail |
| Hapus aset | web | Dialog konfirmasi muncul; setelah konfirmasi daftar kembali 9 aset dan `TST-901` hilang |
| Hapus aset beriwayat | web | SRV-001 ditolak: "Aset ini masih memiliki riwayat maintenance atau prediksi…" |
| Catat maintenance | web | SRV-004: REPAIR → status Maintenance; catatan kedua `Resolved - …` → status Aktif |
| Teknisi | web | Tanpa tombol tambah/ubah/hapus/cek/prediksi; `/asset/new` menampilkan "Akses ditolak"; catatan "Hanya administrator…" tampil di tab AI. Di emulator belum diuji ulang |
| Logout | web | Konfirmasi, sesi dihapus, kembali ke login |
| 401 | web | `JWT_SECRET` diputar sementara → reload memicu logout otomatis dan redirect ke login |
| Metro | web + Android | Tidak ada peringatan "Require cycle" |

Catatan emulator: beberapa kali emulator berhenti merespons karena mesin pengembangan menjalankan sesi
lain. Gejalanya: `adb exec-out screencap` menghasilkan 0 byte, `adb pull` gagal dengan
`Transport endpoint is not connected`, dan dialog "System UI isn't responding". Alur form aset sampai
tersimpan, form maintenance, teknisi, dan logout diverifikasi di web; lihat tabel platform.

### Brief 9 — HP fisik (4 November 2026)

Verifikasi pada **Infinix X6882** (Android 14, Expo Go) memakai backend lokal dan database test berisi
seed, dengan `adb reverse` untuk port 3000 dan 8081.

| Alur | Hasil yang diamati |
|---|---|
| Kartu dashboard | **Jadwal Maintenance**: 1 terlewat, 2 ≤ 7 hari, 2 8–30 hari, plus peringatan "1 jadwal sudah lewat tanggal" |
| Tab jadwal | Terlewat (1) menampilkan STG-001 (28 Okt 2026, terlewat 7 hari, hasil terakhir tampil); 7 hari (2) menampilkan SRV-001 dan SW-001; 30 hari (4) menambahkan FW-001 dan SRV-003 |
| Jalankan pengingat (admin) | Dialog konfirmasi, lalu "Tidak ada pengingat baru. 3 jadwal dipindai, 6 sudah pernah dikirim." pada eksekusi kedua |
| Notifikasi | Tiga `MAINTENANCE_REMINDER` dengan ikon amber; ketuk → detail maintenance SW-001 |
| Catatan dihapus | Setelah baris maintenance dihapus, ketuk pengingat STG-001 membuka `/asset/5?tab=maintenance` dan tab **Maintenance** langsung aktif |
| Teknisi | Layar jadwal tanpa kartu/aksi pengingat; tab dan empty state tetap berfungsi |

### Batasan

- Tombol back perangkat pada emulator Expo Go tidak memicu navigasi; tombol back di header berfungsi.
  Ini perilaku Expo Go, bukan kode aplikasi.
- Form edit tidak dapat mengosongkan nama merek/model/serial/deskripsi atau field jaringan (batasan
  API: kolom kosong = tidak diubah); sub-field lokasi dapat dikosongkan selama data center terisi.
- Pilihan teknisi pada form maintenance belum tersedia (tidak ada endpoint daftar user).
- Cek jaringan adalah simulasi server, bukan ping sungguhan.
- Token disimpan di AsyncStorage (tidak terenkripsi); aplikasi hanya untuk pengembangan lokal.
- Backend lokal memakai HTTP tanpa TLS.
- Prediksi AI adalah heuristik deterministik (aturan + statistik + pola), bukan model machine learning
  yang dilatih; tidak ada klaim akurasi.
- Pengingat maintenance hanya in-app; tidak ada push notification, email, atau WhatsApp.
