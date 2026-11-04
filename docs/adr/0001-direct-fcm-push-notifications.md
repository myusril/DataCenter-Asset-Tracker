# 0001. Push notification langsung melalui Firebase Cloud Messaging

Date: 2026-11-04
Status: Accepted
Approved: 2026-11-04 (founder, "saya setuju menggunakan jalur B")

## Ringkasan untuk founder

Notifikasi `AI_ALERT` dan `MAINTENANCE_REMINDER` dikirim langsung ke aplikasi Android lewat Firebase
Cloud Messaging (FCM), bukan lewat layanan Expo Push. Aplikasi mendaftarkan token perangkat setelah
login dan menghapusnya saat logout; backend menyimpan token dan mengirim push setelah baris notifikasi
in-app tersimpan. Tidak ada biaya bulanan: FCM memakai paket gratis dan `firebase-admin` berlisensi
Apache-2.0. Kredensial Firebase hanya ada di server, sedangkan `google-services.json` hanya dipakai
saat build. Push mati secara default sampai founder menaruh service account dan menyalakan
`PUSH_ENABLED`.

## Context

- Aplikasi Android dibangun lokal dengan Gradle, bukan EAS Build; Expo Push Service menambah
  ketergantungan layanan dan token Expo di luar FCM.
- Baris notifikasi in-app sudah menjadi sumber kebenaran. Push hanya cermin dan tidak boleh
  menggagalkan request API.
- Proyek Firebase milik mahasiswa; tidak ada layanan berbayar dan tidak ada akun yang dibuat agen.
- Perangkat uji: Infinix X6882 (Android 14). iOS/APNs di luar cakupan.

## Decision

Kami memakai FCM langsung melalui `firebase-admin` di backend. Tabel `device_tokens` menyimpan satu
token unik per perangkat yang terhubung ke `userId`; `POST`/`DELETE /api/notifications/device`
mengelola kepemilikan token. Setelah transaksi notifikasi commit, backend memanggil
`sendEachForMulticast` tanpa menunggu hasil (fire-and-forget), memangkas token yang dilaporkan FCM
sebagai tidak terdaftar/tidak valid, dan menjadi no-op dengan satu peringatan bila `PUSH_ENABLED=false`
atau service account tidak tersedia.

## Alternatives considered

| Option | Pros | Cons | Why not chosen |
|---|---|---|---|
| Expo Push Service | SDK mobile sederhana, menangani FCM/APNs | Perlu layanan/token Expo, biaya dan kuota tambahan, build lokal tetap butuh FCM untuk Android | Menambah lapisan eksternal tanpa manfaat untuk build Gradle lokal |
| FCM langsung (dipilih) | Gratis, satu jalur Android, kontrol penuh payload dan pemangkasan token | Backend harus menyimpan token dan menangani error FCM; iOS belum disiapkan | Sesuai keputusan founder jalur B |
| Tanpa push (in-app saja) | Paling sederhana, tanpa data tambahan | Pengguna tidak tahu alert saat aplikasi tertutup | Tidak memenuhi permintaan notifikasi |

## Consequences

- Positive: push mengikuti baris notifikasi yang sama; kegagalan FCM tidak menggagalkan API; tidak ada
  layanan berbayar; token perangkat dapat dicabut saat logout.
- Negative / accepted trade-offs: token perangkat adalah data pribadi baru yang dibagikan ke Google;
  belum ada rate limit atau batas jumlah token per pengguna; iOS/APNs, topik, dan push terjadwal belum
  ada.
- Revisit trigger: kebutuhan iOS, pengiriman massal/topik, keluhan spam, atau perubahan harga/kebijakan
  FCM.

## Cost and licensing

- FCM: paket gratis untuk kebutuhan aplikasi ini; tidak ada tagihan yang diaktifkan.
- `firebase-admin`: Apache-2.0. Plugin Gradle `com.google.gms.google-services`: Apache-2.0.
- Tidak ada akun atau layanan berbayar baru.

## Open dependencies

- Service account Firebase harus diletakkan di server (mode `600`) dan `PUSH_ENABLED=true` sebelum
  push aktif; ini keputusan/operasi founder.
- Region Firebase, dasar transfer lintas negara, dan retensi token: lihat
  `docs/product/personal-data.md` (keputusan founder/legal).
- APK harus dibangun dengan `mobile/google-services.json` milik proyek Firebase mahasiswa.

## References

- Brief 11: `/tmp/omp-briefs/dc-tracker-11-push-notifications.md`
- `docs/API_CONTRACT.md` §7 (pendaftaran perangkat dan payload push)
- Firebase Admin SDK: https://firebase.google.com/docs/admin/setup
- FCM HTTP v1 / multicast: https://firebase.google.com/docs/cloud-messaging/send-message
