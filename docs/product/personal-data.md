# Inventaris data pribadi (UU PDP)

Dokumen kerja untuk fitur push notification (brief 11). Ini **bukan nasihat hukum**; pertanyaan
dasar hukum, retensi, dan transfer lintas negara adalah keputusan founder dan, bila perlu, pengacara.
Status: 4 November 2026.

## Data yang diproses

| Data | Mengapa diperlukan | Dasar hukum | Lokasi penyimpanan | Siapa yang dapat mengakses | Retensi | Dibagikan kepada |
|---|---|---|---|---|---|---|
| `users.username`, `email`, `fullName`, `passwordHash` | Login dan identitas staf | ❓ keputusan founder (kontrak kerja / kepentingan sah) | PostgreSQL (`users`); di mesin pengembangan lokal, lokasi produksi ❓ | Proses backend, admin database | Selama akun aktif; penghapusan akun belum tersedia | Tidak ada pihak ketiga |
| `device_tokens.token` (token FCM), `platform`, `createdAt`, `lastSeenAt`, `userId` | Mengirim notifikasi ke perangkat milik pengguna | ❓ keputusan founder; izin notifikasi Android hanya izin sistem, bukan catatan consent UU PDP | PostgreSQL (`device_tokens`) | Proses backend; admin database | Dihapus saat logout; token tidak valid dipangkas otomatis; token yang tidak pernah logout **belum** punya batas retensi → ❓ | Google Firebase Cloud Messaging |
| Judul dan isi notifikasi dalam payload push (kode/nama aset, skor risiko, jadwal maintenance) | Isi pemberitahuan `AI_ALERT` / `MAINTENANCE_REMINDER` | Mengikuti dasar hukum notifikasi in-app | Tidak disimpan tambahan oleh push; baris `notifications` tetap di PostgreSQL | Proses backend; admin database | Mengikuti baris `notifications` | Google Firebase Cloud Messaging (transien) |

Token FCM bukan rahasia autentikasi, tetapi terhubung ke satu akun dan dapat dipakai mengirim pesan ke
perangkat orang tersebut. Token tidak pernah dikembalikan endpoint, tidak dicetak di log, dan hanya
dibaca proses backend.

## Checklist

- ✅ **Minimalisasi:** push hanya memakai token, platform, waktu, dan `userId`; tidak ada kontak,
  lokasi, atau isi perangkat lain.
- ✅ **Keamanan kredensial:** service account Firebase hanya di server (`FIREBASE_SERVICE_ACCOUNT`,
  mode `600`), `google-services.json` hanya build-time dan di-ignore; tidak ada kredensial di repo.
- ✅ **Hak penghapusan (sebagian):** logout menghapus token pengguna dari `device_tokens`; token yang
  dilaporkan FCM tidak valid dipangkas otomatis.
- ⚠️ **Dasar hukum dan consent:** ❓ founder. Izin notifikasi Android tidak mencatat consent UU PDP
  (siapa, kapan, teks versi apa).
- ⚠️ **Retensi:** belum ada batas untuk token yang tidak pernah logout. Usulan: hapus token dengan
  `lastSeenAt` lebih lama dari 90 hari; angka final ❓ founder.
- ⚠️ **Transfer lintas negara:** Firebase/Google memproses data di luar Indonesia; region proyek dan
  dasar transfer belum ditentukan → ❓ founder/legal (Pasal 56).
- ⚠️ **DPIA:** push adalah teknologi baru dan berbagi data ke vendor eksternal; apakah DPIA diperlukan
  → ❓ founder/legal (Pasal 34).
- ⚠️ **Respons insiden:** `docs/ops/incident-response.md` belum ada; notifikasi 3×24 jam (Pasal 46)
  belum punya prosedur.
- ❓ **DPO:** aplikasi internal untuk staf, bukan pemantauan massal; perlu konfirmasi founder bahwa
  Pasal 53 tidak berlaku.
- ✅ **Akuntabilitas:** inventaris ini dan ADR `docs/adr/0001-direct-fcm-push-notifications.md`
  menjadi catatan keputusan.

## Tindakan berikutnya

1. Founder memutuskan dasar hukum, retensi token, region Firebase, dan apakah perlu DPIA/pengacara.
2. Bila produksi dipakai, aktifkan HTTPS dan batasi akses database.
3. Buat prosedur insiden dan cara pengguna meminta penghapusan data.
