# Panduan pengguna

Panduan ini untuk pemilik sistem dan teknisi yang memakai aplikasi DataCenter Asset Tracker sehari-hari.
Semua yang terlihat di layar dijelaskan dari sudut pandang pengguna; istilah teknis diberi arti singkat.

Akun, password, dan alamat server **tidak ditulis di dokumen ini**. Nilainya diberikan oleh pemilik
sistem; saat data demo dibuat, password ada di `backend/.env` sebagai `SEED_ADMIN_PASSWORD` dan
`SEED_TECH_PASSWORD`. Jangan membagikan nilai itu lewat dokumen atau tangkapan layar.

## 1. Peran pengguna

| Kemampuan | Administrator | Teknisi |
|---|---|---|
| Masuk, melihat dashboard, daftar dan detail aset | Ya | Ya |
| Mencari, memfilter, membuka tab detail aset | Ya | Ya |
| Melihat riwayat dan detail maintenance | Ya | Ya |
| Melihat jadwal maintenance dan notifikasi | Ya | Ya |
| Melihat analisis risiko dan rincian perhitungan | Ya | Ya |
| Menambah, mengubah, menghapus aset | Ya | Tidak |
| Mencatat dan mengubah riwayat maintenance | Ya | Tidak |
| Menjalankan cek koneksi jaringan | Ya | Tidak |
| Menjalankan prediksi risiko tunggal/semua aset | Ya | Tidak |
| Menjalankan pengingat maintenance | Ya | Tidak |
| Mengubah profilnya sendiri (nama, email, password) | Ya | Ya |
| Mengelola notifikasinya sendiri | Ya | Ya |

Teknisi tidak melihat tombol tulis. Bila membuka alamat layar khusus admin secara langsung, muncul
tulisan **"Akses ditolak"**. Pembatasan ini juga ditegakkan di server, bukan hanya disembunyikan di
tampilan.

## 2. Masuk dan keluar

**Masuk**

1. Buka aplikasi. Bila sesi sebelumnya masih tersimpan, aplikasi langsung masuk ke Dashboard.
2. Isi **Username** (contoh format: `admin`) dan **Password**, lalu tekan **Masuk**.
3. Di bagian bawah layar login terlihat alamat server yang sedang dipakai. Bila alamat itu salah,
   hubungi pemilik sistem — alamat ditanam saat aplikasi dibangun, bukan diubah dari layar.

Pesan yang mungkin muncul:

| Pesan | Arti | Tindakan |
|---|---|---|
| `Invalid username or password` | Username atau password tidak cocok | Periksa ejaan; minta password yang benar ke pemilik |
| `Account is inactive` | Akun dinonaktifkan | Hubungi pemilik sistem |
| `Tidak dapat terhubung ke server. Periksa koneksi dan alamat API.` | Ponsel tidak bisa menjangkau server | Periksa jaringan; pastikan server berjalan dan alamat di layar login benar |
| Sesi berakhir dan kembali ke login | Token kedaluwarsa atau server mengganti kunci keamanan | Masuk ulang |

**Keluar**

Buka tab **Profil** → **Keluar** → konfirmasi. Sesi di ponsel dihapus dan aplikasi kembali ke layar
login. Bila push aktif, token perangkat juga dihapus agar notifikasi akun lama tidak lagi sampai ke
ponsel itu.

## 3. Dashboard

Dashboard merangkum kondisi hari ini:

- **Total aset** di kartu utama, dengan cincin sebaran risiko (Rendah/Sedang/Tinggi) bila sudah ada
  prediksi. Di bawahnya tertulis berapa aset yang belum diprediksi dan kapan prediksi terakhir dibuat.
- **Garansi habis ≤ 30 hari** dan **Aset baru bulan ini**.
- **Jadwal Maintenance**: jumlah jadwal terlewat, dalam 7 hari, dan 8–30 hari. Tekan
  **Buka jadwal maintenance** untuk melihat daftarnya.
- **Ringkasan Risiko**: jumlah aset per tingkat, aset paling berisiko, dan pintasan ke tab Risiko.
- **Kondisi Aset**: bar bertumpuk jumlah aset per status (Aktif, Maintenance, Nonaktif).
- **Sebaran Tipe**: jumlah aset per jenis (server, switch, router, storage, firewall, rack, lainnya).
- **Akses Cepat**: Semua Aset, Maintenance, Jaringan, Risiko, Profil.

Arti warna:

| Warna | Status aset | Tingkat risiko | Koneksi |
|---|---|---|---|
| Hijau | Aktif | Rendah | Online |
| Kuning/amber | Maintenance | Sedang | — |
| Merah | — | Tinggi | Offline |
| Abu-abu | Nonaktif | — | Belum diketahui |

Warna hanya alat bantu; selalu ada teks status di sebelahnya.

## 4. Aset

**Mencari dan memfilter**

- Kolom cari menerima kode aset, nama, atau serial number. Pencarian berjalan otomatis setelah
  berhenti mengetik sebentar.
- Tombol **Filter** membuka panel **Tipe** dan **Status**. Filter yang aktif tampil sebagai chip dan
  dapat dilepas satu per satu; **Reset** mengosongkan semuanya.
- Daftar menampilkan 6 aset per halaman. Tarik ke bawah untuk memuat ulang.

**Detail aset**

Ketuk satu aset untuk membuka halaman dengan empat tab:

1. **Umum** — merek, model, serial, tanggal pembelian, garansi, pembuat, jumlah catatan maintenance,
   lokasi saat ini, dan deskripsi. Admin melihat tombol **Ubah data aset** dan **Hapus aset**.
2. **Jaringan** — hostname, alamat IP, subnet, gateway, MAC, status koneksi, waktu cek terakhir, dan
   catatan.
3. **Maintenance** — riwayat perawatan aset tersebut. Ketuk satu kartu untuk membuka detailnya. Admin
   dapat menekan **Catat maintenance**.
4. **Risiko** — prediksi aktif, skor, tingkat, perkiraan hari, rincian tiga lapisan, faktor utama, dan
   rekomendasi. Admin dapat menekan **Prediksi ulang** atau **Prediksi sekarang**.

**Menambah dan mengubah (admin)**

Form tambah aset berisi bagian **Umum** (kode, nama, tipe, merek, model, serial, tanggal, status,
deskripsi), **Lokasi** (data center wajib; rack, slot, lantai, ruangan opsional), dan **Jaringan**
(hostname, IP, subnet, gateway, MAC, status, catatan). Validasi tampil di bawah field yang bermasalah.

Saat mengubah, form terisi otomatis. Mengosongkan field teks opsional seperti merek/model/serial atau
field jaringan **tidak menghapus nilai lama** — server menganggap kolom kosong sebagai "tidak diubah".
Sub-field lokasi (rack, slot, lantai, ruangan) boleh dikosongkan selama data center diisi.

**Menghapus (admin)**

Tekan **Hapus aset** lalu konfirmasi. Aset yang sudah punya riwayat maintenance atau prediksi tidak
dapat dihapus; muncul pesan bahwa aset masih memiliki riwayat. Nonaktifkan aset (`Status: Nonaktif`)
bila ingin menyimpannya sebagai arsip.

**Arti konflik 409**

| Pesan | Arti |
|---|---|
| Kode aset sudah dipakai aset lain | `assetCode` harus unik; pilih kode berbeda |
| Serial number sudah dipakai aset lain | Serial harus unik atau dikosongkan |
| Aset ini masih memiliki riwayat maintenance atau prediksi | Hapus/arsipkan data terkait lebih dulu, atau nonaktifkan aset |

## 5. Maintenance

- **Daftar** menampilkan seluruh riwayat dari semua aset, terbaru lebih dulu. Filter **Jenis**:
  Rutin, Perbaikan, Upgrade, Inspeksi, Penggantian. Daftar memakai halaman dan dapat ditarik ke bawah.
- **Detail** menampilkan aset, tanggal, teknisi, jenis, biaya, jadwal berikutnya, uraian, dan hasil.
- **Catat maintenance (admin)**: pilih aset lewat pencarian, tentukan jenis dan tanggal, isi uraian,
  hasil, biaya, dan jadwal berikutnya. Teknisi terisi otomatis dari akun yang sedang login karena API
  belum menyediakan daftar user.

**Aturan status aset** (penting untuk demo):

- Jenis **Perbaikan**, **Upgrade**, atau **Penggantian** membuat status aset menjadi **Maintenance**.
- Hasil yang diawali kata **`Resolved`** (contoh: `Resolved - RAM diganti`) membuat status aset kembali
  **Aktif**, apa pun jenisnya.
- Jenis **Rutin** dan **Inspeksi** tidak mengubah status aset.
- Saat catatan diubah, hanya aturan `Resolved` yang berlaku; mengganti jenis catatan tidak otomatis
  mengembalikan status.

## 6. Jaringan

Layar ini menampilkan satu baris per perangkat yang punya informasi jaringan: hostname, alamat IP,
status koneksi, dan waktu cek terakhir.

- Cari berdasarkan hostname atau alamat IP; filter status **Online**, **Offline**, **Belum diketahui**.
- Admin melihat tombol **Cek** pada setiap baris. Cek ini **simulasi** di server, bukan ping sungguhan:
  server mengundi Online 80% / Offline 20%, lalu mengisi waktu cek terakhir.

## 7. Risiko

Tab **Risiko** menjelaskan prioritas inspeksi, bukan ramalan pasti.

- **Skor Risiko Rata-rata** (0–100) ditampilkan pada busur, beserta jumlah aset per tingkat.
- **Cara Kerja** menjelaskan tiga lapisan: **Aturan** (bobot faktor terukur), **Statistik**
  (perbandingan interval dan tren dengan riwayat/peer), dan **Pola** (kombinasi kejadian seperti
  jaringan offline dan perbaikan berulang).
- Panel **Yang perlu diketahui** menegaskan: mesin ini **heuristik deterministik** — aturan, statistik,
  dan pola yang dapat diperiksa ulang. Bukan model machine learning yang dilatih dan tidak punya angka
  akurasi.
- **Aset Berisiko Tertinggi** menampilkan maksimal 5 aset non-rendah. Ketuk untuk melihat rincian
  perhitungan dari server.
- **Prediksi semua aset (admin)** menghitung ulang seluruh aset. Ringkasan menampilkan jumlah aset
  diproses, jumlah per tingkat, dan berapa alert baru dibuat.

Batas tingkat: **≤ 30 Rendah**, **≤ 60 Sedang**, **> 60 Tinggi**. Skor dihitung ulang dari data saat
itu; menambah maintenance atau mengubah status/koneksi dapat mengubah skor. Prediksi HIGH membuat
notifikasi `AI_ALERT` untuk setiap pengguna aktif.

## 8. Jadwal maintenance

Layar **Jadwal Maintenance** dibuka dari kartu dashboard atau menu Maintenance.

- Tiga tab dengan jumlah: **Terlewat**, **7 hari**, **30 hari**. Baris terlewat selalu tampil lebih
  dulu.
- Setiap baris menampilkan aset, jenis, tanggal jatuh tempo, sisa/lewat hari, dan hasil perawatan
  terakhir bila ada.
- Label: **Terlewat** (merah), **≤ 7 hari** (amber), **Akan datang** (aksen).
- Admin melihat kartu **Pengingat otomatis** dan tombol **Jalankan pengingat**. Konfirmasi lalu
  jalankan. Pesan hasil menyebut jumlah jadwal dipindai, pengingat baru, dan yang sudah pernah
  dikirim. Setiap pengguna aktif menerima paling banyak satu pengingat per jadwal; menekan tombol dua
  kali tidak mengirim ulang pesan yang sama.

Bila server menyalakan job harian, pengingat juga dibuat otomatis setiap pukul 07.00 waktu server.

## 9. Notifikasi

- Badge pada tab **Notifikasi** menunjukkan jumlah belum dibaca. Badge diperbarui saat aplikasi
  dibuka kembali dan setelah aksi baca/hapus.
- Notifikasi belum dibaca tampil lebih dulu. Waktu ditampilkan relatif ("5 menit lalu").
- Ketuk notifikasi: pesan ditandai sudah dibaca, lalu aplikasi membuka tujuannya.
  - `AI_ALERT` → detail aset.
  - `MAINTENANCE_REMINDER` → detail maintenance. Bila catatan maintenance sudah dihapus, aplikasi
    membuka tab Maintenance pada aset terkait.
- Tombol tiga titik (**Kelola**) berisi **Tandai semua dibaca** dan **Hapus yang sudah dibaca**
  (dengan konfirmasi). Satu notifikasi juga dapat dihapus dari barisnya.

**Push di Android**

Setelah login pertama, Android menampilkan dialog izin notifikasi. Pilih **Izinkan**. Bila pernah
ditolak, aktifkan lewat **Pengaturan → Aplikasi → DataCenter Tracker → Notifikasi**. Push hanya
berjalan pada aplikasi yang dibangun dengan konfigurasi Firebase dan server yang menyalakan push;
tanpa itu, notifikasi tetap masuk ke pusat notifikasi di dalam aplikasi.

## 10. Profil

- Header menampilkan nama, username, role, dan inisial.
- **Informasi akun**: email dan waktu login terakhir.
- **Edit profil**: ubah **Nama lengkap** dan **Email**, lalu opsional ganti password dengan mengisi
  **Password baru**, **Konfirmasi password baru**, dan **Password saat ini**. Tekan **Simpan**.
  - Nama/avatar/sapaan dashboard langsung berubah tanpa muat ulang.
  - Email milik akun lain ditolak dengan pesan di field email.
  - Password minimal 8 karakter; konfirmasi harus sama.
  - Password saat ini yang salah ditolak server dengan pesan di field tersebut.
  - Setelah password berhasil diganti, aplikasi keluar ke layar login agar kredensial baru terbukti.
- **Keluar** meminta konfirmasi sebelum menghapus sesi.

## 11. Pemecahan masalah pengguna

| Gejala | Kemungkinan penyebab | Yang bisa dilakukan |
|---|---|---|
| Tidak bisa masuk | Password salah, akun nonaktif, atau server mati | Minta kredensial ke pemilik; pastikan server berjalan; coba lagi |
| Muncul "Tidak dapat terhubung ke server" | Ponsel dan server tidak satu jaringan, atau alamat API salah | Sambungkan ke jaringan yang sama; cocokkan alamat di layar login dengan informasi pemilik |
| Daftar aset kosong | Data belum di-seed, filter terlalu sempit, atau pencarian tidak cocok | Reset filter; tarik untuk memuat ulang; hubungi pemilik bila data memang belum ada |
| Data lama tidak berubah | Server menghitung ulang dari data aktual; perubahan orang lain mungkin sudah masuk | Tarik ke bawah untuk memuat ulang |
| Tombol tambah/ubah tidak terlihat | Akun berperan Teknisi | Minta akun Administrator bila memang perlu menulis data |
| Muncul "Akses ditolak" | Membuka layar khusus admin dengan akun Teknisi | Kembali; gunakan akun Administrator |
| Notifikasi in-app tidak bertambah | Belum ada prediksi HIGH atau pengingat baru | Jalankan prediksi/pengingat sebagai admin, atau tunggu job harian |
| Push tidak muncul | Izin notifikasi ditolak, aplikasi bukan build Firebase, atau push server nonaktif | Aktifkan izin; gunakan APK yang dibangun dengan konfigurasi Firebase; hubungi pemilik |
| Ketuk notifikasi tidak membuka apa pun | Sesi sudah berakhir | Masuk kembali, lalu buka notifikasi dari pusat notifikasi |
| Tidak bisa menghapus aset | Aset masih punya riwayat maintenance/prediksi | Nonaktifkan aset atau hapus riwayat lebih dulu |
| Sesi tiba-tiba berakhir | Token kedaluwarsa atau kunci keamanan server berubah | Masuk ulang; hubungi pemilik bila sering terjadi |

## 12. Skenario demo 10 menit

Skenario ini memakai data demo (2 akun, 9 aset, 8 catatan maintenance) dan akun **Administrator**.
Jalankan backend lebih dulu, lalu buka aplikasi di ponsel. Sesuaikan jumlah bila data sudah berubah.

| Waktu | Langkah | Hasil yang diharapkan |
|---|---|---|
| 0:00–0:30 | Masuk dengan akun admin | Dashboard terbuka; sapaan memakai nama depan; total aset **9** |
| 0:30–1:30 | Tunjukkan kartu dashboard | Kartu garansi, aset baru, jadwal maintenance, kondisi aset, sebaran tipe; cincin risiko masih kosong dan tertulis berapa aset belum diprediksi |
| 1:30–2:30 | Buka tab **Risiko** → **Prediksi semua aset** | Toast "Prediksi selesai: 9 aset diproses · … tinggi · … sedang · … rendah · … alert baru."; busur rata-rata dan jumlah per tingkat terisi |
| 2:30–3:00 | Kembali ke Dashboard | Cincin risiko dan kartu "Aset paling berisiko" terisi; badge Notifikasi bertambah bila ada prediksi HIGH |
| 3:00–5:00 | Tab **Aset** → **+ Aset**; isi kode `TST-901`, nama `Server Demo`, tipe Server, data center `DC-3`, rack `F`, slot `U05`, hostname `demo-srv`, IP `203.0.113.40`, status Aktif; **Simpan** | Kembali ke daftar/detail; aset baru muncul dan dapat dicari dengan `TST-901` |
| 5:00–6:30 | Dari detail aset → tab **Maintenance** → **Catat maintenance**; jenis **Perbaikan**, hasil `In progress - demo`; simpan | Status aset berubah menjadi **Maintenance** (kuning) dan catatan muncul di riwayat |
| 6:30–7:30 | Catat maintenance kedua pada aset yang sama; hasil `Resolved - demo selesai`; simpan | Status aset kembali **Aktif** (hijau); dua catatan tampil |
| 7:30–8:15 | Buka detail **SRV-001** → tab **Risiko** → **Prediksi ulang** | Skor, tingkat, perkiraan hari, tiga lapisan (aturan/statistik/pola), faktor utama, dan rekomendasi tampil. Jelaskan ini heuristik, bukan model terlatih |
| 8:15–9:00 | Dari dashboard buka **Jadwal Maintenance**; tunjukkan tab Terlewat/7/30 hari; sebagai admin tekan **Jalankan pengingat** lalu konfirmasi | Pesan hasil menyebut jadwal dipindai dan pengingat baru/sudah terkirim; notifikasi `MAINTENANCE_REMINDER` muncul |
| 9:00–9:30 | Buka tab **Notifikasi**; ketuk satu `AI_ALERT` dan satu `MAINTENANCE_REMINDER` | Baris menjadi sudah dibaca; ketukan membuka detail aset atau detail maintenance. Bila push aktif, tunjukkan juga notifikasi yang sama datang ke perangkat |
| 9:30–10:00 | Tab **Profil** → **Edit profil**, ubah nama (mis. tambah "Demo"), simpan; lalu kembalikan | Toast "Profil berhasil diperbarui." dan sapaan/avatar langsung berubah. Tunjukkan tombol **Keluar** dan konfirmasinya |

**Beres-beres setelah demo:** sebagai admin, hapus dua catatan maintenance `TST-901` lebih dulu, lalu
hapus asetnya. Aset yang masih punya catatan maintenance atau prediksi tidak bisa dihapus (pesan
konflik 409); bila tidak ingin menghapus riwayat, ubah status aset menjadi **Nonaktif** dan biarkan
sebagai arsip. Untuk latihan berulang, gunakan salinan database demo lokal, bukan data bersama.
