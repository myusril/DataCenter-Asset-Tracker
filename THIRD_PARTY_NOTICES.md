# Third-party notices

Dokumen ini mencatat lisensi komponen pihak ketiga yang dipakai DataCenter Asset Tracker. Daftar
disusun dari field `license` pada `package.json` di `backend/node_modules` dan `mobile/node_modules`
yang benar-benar terpasang saat dokumen ini dibuat. Ini **bukan nasihat hukum**; sebelum distribusi
publik, periksa ulang dengan versi dependensi yang benar-benar dibangun.

## Komponen dan lisensi

### Backend

| Komponen | Lisensi |
|---|---|
| Express | MIT |
| bcryptjs | MIT |
| jsonwebtoken | MIT |
| zod | MIT |
| cors | MIT |
| jest (pengembangan) | MIT |
| supertest (pengembangan) | MIT |
| prisma (CLI) | Apache-2.0 |
| `@prisma/client` | Apache-2.0 |
| firebase-admin | Apache-2.0 |
| node-cron | ISC |

### Mobile

| Komponen | Lisensi |
|---|---|
| Expo | MIT |
| React Native | MIT |
| React | MIT |
| expo-router | MIT |
| expo-notifications | MIT |
| expo-linear-gradient | MIT |
| expo-haptics | MIT |
| expo-font | MIT |
| expo-constants | MIT |
| expo-linking | MIT |
| expo-status-bar | MIT |
| `@expo/metro-runtime` | MIT |
| `@expo/vector-icons` | MIT |
| react-native-svg | MIT |
| zustand | MIT |
| axios | MIT |
| `@react-native-async-storage/async-storage` | MIT |
| `@expo-google-fonts/plus-jakarta-sans` (font Plus Jakarta Sans) | MIT AND OFL-1.1 |

### Catatan

- `jest`, `supertest`, dan TypeScript hanya dipakai saat pengembangan/pengujian dan tidak ikut ke
  dalam APK. TypeScript terpasang dengan lisensi Apache-2.0.
- PostgreSQL berjalan sebagai layanan terpisah di server dan tidak dibundel ke dalam APK.
- Dependensi transitif dapat memiliki lisensi lain. Daftar ini mencakup dependensi langsung yang
  dipakai aplikasi; sebelum rilis, jalankan pemeriksaan lisensi pada seluruh pohon dependensi.

## Di mana teks lisensi lengkap berada

Teks lisensi asli disertakan oleh masing-masing paket di dalam `node_modules`, biasanya sebagai
`LICENSE`, `LICENSE.md`, `LICENSE.txt`, atau `NOTICE`. Contoh:

```
backend/node_modules/express/LICENSE
backend/node_modules/@prisma/client/LICENSE
backend/node_modules/firebase-admin/LICENSE
backend/node_modules/node-cron/LICENSE.md
mobile/node_modules/expo/LICENSE
mobile/node_modules/react-native/LICENSE
mobile/node_modules/@expo-google-fonts/plus-jakarta-sans/LICENSE
```

Berkas-berkas itu tidak disalin ke repository ini agar tidak menggandakan teks lisensi. Setelah
`npm ci`/`npm install`, semuanya tersedia di folder `node_modules` masing-masing proyek.
`@expo-google-fonts/plus-jakarta-sans` membawa lisensi MIT untuk kode paket dan OFL-1.1 untuk berkas
font; keduanya harus dipenuhi.

## Kewajiban saat mendistribusikan APK

- **MIT** mewajibkan teks hak cipta dan izin disertakan pada salinan atau bagian substansial perangkat
  lunak. Cantumkan pemberitahuan lisensi pihak ketiga bersama APK (misalnya halaman "Tentang" atau
  berkas `THIRD_PARTY_NOTICES` yang disertakan saat distribusi).
- **Apache-2.0** mewajibkan salinan lisensi dan, bila paket menyediakan berkas `NOTICE`, penyertaan
  isi notice tersebut. Jangan menghapus pemberitahuan lisensi dari paket.
- **ISC** mewajibkan teks hak cipta dan izin disertakan pada salinan.
- **OFL-1.1** (font Plus Jakarta Sans) mewajibkan lisensi font disertakan; font juga tidak boleh
  dijual terpisah dan tidak boleh memakai nama reserved font tanpa izin.
- Distribusi internal di dalam organisasi tetap sebaiknya menyertakan berkas ini; jangan menganggap
  penggunaan internal menghapus kewajiban lisensi.

## Pemeliharaan daftar

Saat menambah, menghapus, atau menaikkan versi dependensi:

1. Periksa field `license` pada paket yang terpasang.
2. Perbarui tabel di atas bila ada lisensi baru atau komponen baru.
3. Periksa apakah paket membawa `NOTICE` (khusus Apache-2.0) dan sertakan bila mendistribusikan.
4. Simpan teks lisensi lengkap dari `node_modules` bila diperlukan untuk paket distribusi; jangan
   menyalin isinya ke dokumen ini.

Daftar ini bukan jaminan kepatuhan dan bukan nasihat hukum. Untuk distribusi publik atau komersial,
konsultasikan dengan pemilik produk atau penasihat hukum.
