# DataCenter Tracker — Aplikasi Mobile

Aplikasi mobile untuk inventaris dan pemantauan aset data center. Dibangun dengan **Expo SDK 58**,
**React Native 0.88**, **TypeScript**, **Expo Router**, **Zustand**, dan **axios**. Semua teks untuk
pengguna berbahasa Indonesia; gaya visual memakai `StyleSheet` biasa tanpa UI kit.

Tahap ini adalah fondasi mobile (brief 3 dari 4): autentikasi, dashboard, daftar aset, detail aset, dan
profil. Modul operasional lanjutan dikerjakan pada tahap berikutnya.

## Fitur

- **Login + auto-login** — `username` + `password`, pesan error dari API ditampilkan inline. Token dan
  data user disimpan di AsyncStorage sehingga sesi bertahan setelah aplikasi ditutup.
- **Dashboard** — kartu total/aktif/maintenance/nonaktif dari `/api/assets/statistics`, sebaran risiko
  AI dari `/api/ai/risk-summary`, kartu "N Aset Berisiko Tinggi" yang membuka aset paling berisiko,
  pull-to-refresh, dan tombol coba lagi saat gagal.
- **Daftar aset** — pencarian dengan debounce 400 ms, filter tipe dan status, pagination 6 aset per
  halaman tanpa duplikat, pull-to-refresh, dan empty state.
- **Detail aset** — header status berwarna, tab **Umum / Jaringan / Maintenance / AI**. Tab AI
  menampilkan prediksi aktif (skor, level, confidence, perkiraan kegagalan, faktor utama, rekomendasi)
  atau state "Belum ada prediksi".
- **Profil** — nama, username, email, badge role, versi aplikasi, dan logout dengan konfirmasi.
- **401 otomatis** — respons 401 dari endpoint mana pun (selain login) menghapus sesi dan kembali ke
  layar login.

Di luar cakupan tahap ini: tab AI global, pusat notifikasi, layar daftar maintenance/jaringan, form
admin, tombol trigger prediksi, push notification, QR, mode offline, export, dark mode, EAS/deploy.

## Prasyarat

- Node.js 24.21.0 (dokumen sumber menulis Node 22).
- Backend berjalan di `http://localhost:3000` (lihat `docs/HANDOFF.md`) dengan PostgreSQL 16
  pada port 5433 dan data seed.
- Android emulator `Medium_Phone_API_36.1` tersedia untuk verifikasi utama.

## Menjalankan

```bash
# 1. Backend (terminal terpisah, dari folder backend repo)
npm install
npm run dev

# 2. Aplikasi mobile
cd mobile
npm install
cp .env.example .env

# Android emulator (alamat host dari dalam emulator)
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npx expo start --android

# Web (pemeriksaan sekunder)
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web
```

Pemeriksaan tipe:

```bash
cd mobile
npx tsc --noEmit
```

### Konfigurasi alamat API

`EXPO_PUBLIC_API_URL` adalah satu-satunya sumber alamat API. Nilai jatuh ke `http://localhost:3000`
bila variabel tidak diisi, dan tidak ada alamat IP yang ditulis di dalam kode.

| Target | Nilai | Catatan |
|---|---|---|
| Android emulator | `http://10.0.2.2:3000` | `10.0.2.2` adalah alias host dari emulator |
| Web / iOS simulator | `http://localhost:3000` | |
| Perangkat fisik | `http://<IP-LAN-komputer>:3000` | HP dan komputer harus satu jaringan |
| Alternatif emulator | `adb reverse tcp:3000 tcp:3000` lalu pakai `http://localhost:3000` | |

File `.env` tidak di-commit; hanya `.env.example` yang masuk repositori.

## Struktur

```
mobile/
├── app.json                 # nama, scheme, plugin expo-router
├── .env.example             # EXPO_PUBLIC_API_URL
├── src/
│   ├── api/                 # client axios + interceptor, auth, assets, ai, maintenance
│   ├── app/                 # route Expo Router
│   │   ├── _layout.tsx      # hydration gate + Stack
│   │   ├── index.tsx        # redirect sesuai status login
│   │   ├── (auth)/          # login
│   │   ├── (tabs)/          # Dashboard, Aset, Profil
│   │   └── asset/[id]/      # detail aset (folder agar tahap 4 bisa menambah edit.tsx)
│   ├── components/          # Card, Button, Loading, EmptyState, StatusPill, AssetCard
│   ├── store/auth.ts        # Zustand + persist AsyncStorage
│   ├── theme/               # warna dan spacing
│   ├── types/api.ts         # tipe respons kontrak API
│   └── utils/               # format tanggal/label dan warna pill
└── README.md
```

## Keputusan dan deviasi

| # | Hal | Keputusan |
|---|---|---|
| 1 | Dokumen menaruh proyek di `mobile/DataCenterTracker/` | Proyek Expo berada langsung di `mobile/` dengan route di `mobile/src/app/`; bagian route dokumen memang sudah memakai `src/app/...` dan mencatat "belum di-restructure" |
| 2 | Sprint 1 menulis Redux Toolkit, roadmap menulis Zustand | Zustand + `persist` ke AsyncStorage |
| 3 | Penyimpanan token | AsyncStorage karena aplikasi hanya memakai Expo Go (tanpa modul native tambahan). Token tidak terenkripsi di perangkat; produksi sebaiknya memakai `expo-secure-store` |
| 4 | Rincian layer AI | Tabel `ai_predictions` tidak menyimpan `layerBreakdown`. Tab AI menampilkan prediksi aktif tersimpan, lalu mengambil `GET /api/ai/explain/:id` (read-only, tidak menyimpan) untuk rincian layer dan memberi keterangan bahwa nilainya dihitung ulang saat halaman dibuka |
| 5 | Pagination daftar | 6 aset per halaman agar pagination benar-benar teruji dengan 9 aset seed |
| 6 | Pesan gagal login | Pesan dari API ditampilkan apa adanya (mis. `Invalid username or password`) sesuai kriteria penerimaan, bukan dump JSON |
| 7 | Tombol back perangkat | `predictiveBackGestureEnabled: false` mengikuti default Expo Go. Di Expo Go pada emulator, tombol back perangkat tidak memicu navigasi (lihat Batasan); tombol back pada header berfungsi |
| 8 | Trigger prediksi | Belum ada di tahap ini; tombol dan alur prediksi milik tahap 4 |

## Verifikasi yang dijalankan

Verifikasi utama pada emulator **Medium_Phone_API_36.1** (Android 16 / API 36) memakai Expo Go
58.0.5 dan `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`; web diperiksa sebagai tambahan.

| Alur | Hasil yang diamati |
|---|---|
| Login salah | Pesan inline `Invalid username or password`, bukan JSON mentah |
| Login benar | Masuk ke Dashboard |
| Dashboard | Total **9**, Aktif **6**, Maintenance **2**, Nonaktif **1**; risiko Rendah **7**, Sedang **1**, Tinggi **1**; skor rata-rata **25.26**; kartu `1 Aset Berisiko Tinggi — SRV-001 · skor 83.5` |
| Kartu risiko tinggi | Membuka detail `SRV-001` (`/asset/10`) |
| Detail aset | Status **Maintenance**; Dell / PowerEdge R750 / SN-DC-SRV-001 / garansi 10 Feb 2027; lokasi DC-1 · Rack A · U03 |
| Tab Jaringan | Hostname `web-srv-01`, IP `192.168.1.10`, subnet `255.255.255.0`, gateway `192.168.1.1`, MAC `AA:BB:CC:00:00:01`, status **Offline**, catatan `VLAN 10 - produksi` |
| Tab Maintenance | Riwayat tampil, contoh 26 Okt 2026 · Perbaikan · teknisi Administrator · "In progress - menunggu spare part" |
| Tab AI | Skor **83.5 Tinggi**, confidence **95%**, perkiraan gagal **15 hari**, layer 69.51 + 5.00 + 9.00 = **83.51**, 5 faktor utama, rekomendasi inspeksi |
| Pencarian "srv" | 3 hasil (SRV-001, SRV-003, SRV-004) setelah debounce |
| Filter status Maintenance | 1 hasil (SRV-001) |
| Pencarian tanpa hasil | Empty state "Tidak ada aset" |
| Pagination | 9 aset dimuat 6 + 3 tanpa duplikat saat digulir |
| Tutup lalu buka aplikasi | Langsung ke Dashboard tanpa login ulang (auto-login) |
| Logout | Konfirmasi tampil, sesi dihapus, kembali ke layar login |
| Respons 401 | Dengan `JWT_SECRET` lokal diputar sementara, pull-to-refresh menghasilkan logout + redirect login |
| Back navigation | Tombol back pada header detail kembali ke daftar |
| Web | Login, dashboard (angka sama dengan emulator), detail `SRV-001`, tab Jaringan dan AI tampil |

### Batasan

- Tombol back perangkat pada emulator Expo Go tidak memicu navigasi; tombol back di header aplikasi
  berfungsi. Ini perilaku Expo Go, bukan kode aplikasi.
- State "Belum ada prediksi" belum dapat direproduksi dengan data seed karena kesembilan aset sudah
  memiliki prediksi aktif. Jalur UI-nya ada dan akan terpakai setelah ada aset baru tanpa prediksi.
- Token disimpan di AsyncStorage (tidak terenkripsi); lihat deviasi #3.
- Backend lokal memakai HTTP tanpa TLS. Password dan token hanya aman untuk pengembangan di
  localhost/emulator; jangan dipakai di jaringan nyata tanpa HTTPS.
- Prediksi AI adalah heuristik deterministik (aturan + statistik + pola), bukan model machine learning
  yang dilatih; tidak ada klaim akurasi.
