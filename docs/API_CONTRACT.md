# API Contract — DataCenter Asset Tracker

Kontrak ini adalah acuan tunggal untuk backend dan aplikasi mobile. Setiap field, status code, dan
bentuk respons di bawah ini harus cocok dengan implementasi. Perubahan kontrak wajib disepakati lebih
dulu, bukan dilakukan diam-diam saat mengerjakan mobile.

- Base URL lokal: `http://localhost:3000`
- Content type: `application/json`
- Semua endpoint selain `GET /health`, `POST /api/auth/register`, dan `POST /api/auth/login`
  membutuhkan header `Authorization: Bearer <token>`.
- Total endpoint: **40** = 37 dari dokumen (Auth 3, Asset 6, Maintenance 7, Network 8, AI 6,
  Notification 7) + **3 ekstensi**: 2 jadwal/pengingat maintenance dan 1 profil sendiri
  (`PATCH /api/users/me`).

## 1. Response envelope

Sukses:

```json
{
  "success": true,
  "message": "Asset created successfully",
  "data": { }
}
```

Gagal:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "assetCode", "message": "Asset code is required" }]
}
```

`errors` hanya muncul pada kegagalan validasi (400) dan konflik yang menyebut field tertentu (409).

### Status code

| Code | Arti |
|---|---|
| 200 | OK |
| 201 | Resource dibuat |
| 400 | Validasi gagal atau JSON tidak valid |
| 401 | Token tidak ada / tidak valid / kedaluwarsa |
| 403 | Role tidak diizinkan, akun nonaktif, atau aturan registrasi admin |
| 404 | Resource tidak ditemukan (termasuk route tidak dikenal) |
| 409 | Konflik data unik atau resource masih direferensikan |
| 500 | Kesalahan tak terduga |

### Format nilai

| Tipe | Format | Contoh |
|---|---|---|
| Tanggal (kolom `@db.Date`) | `YYYY-MM-DD` | `"2026-09-25"` |
| Timestamp | ISO 8601 UTC | `"2026-10-30T18:30:49.155Z"` |
| Decimal (`riskScore`, `confidence`, `cost`) | JSON number (bukan string) | `83.5`, `850000` |
| Enum | string huruf besar | `"REPAIR"` |
| Nilai kosong | `null` | `"brand": null` |

### Pagination

Endpoint list menerima `page` (default `1`) dan `limit` (default `10`, maksimal `100`):

```json
{
  "success": true,
  "message": "Assets retrieved successfully",
  "data": {
    "items": [],
    "pagination": { "page": 1, "limit": 10, "total": 9, "totalPages": 1 }
  }
}
```

`totalPages` bernilai `0` saat tidak ada data.

### Enum

| Enum | Nilai |
|---|---|
| `Role` | `ADMIN`, `TECHNICIAN` |
| `AssetType` | `SERVER`, `SWITCH`, `ROUTER`, `STORAGE`, `FIREWALL`, `RACK`, `OTHER` |
| `AssetStatus` | `ACTIVE`, `MAINTENANCE`, `INACTIVE` |
| `ConnectionStatus` | `ONLINE`, `OFFLINE`, `UNKNOWN` |
| `MaintenanceType` | `ROUTINE`, `REPAIR`, `UPGRADE`, `INSPECTION`, `REPLACEMENT` |
| `RiskLevel` | `LOW`, `MEDIUM`, `HIGH` |
| `NotificationType` | `AI_ALERT`, `MAINTENANCE_REMINDER`, `SYSTEM`, `INFO` |

## 2. Auth

### Aturan registrasi

- Selama belum ada user sama sekali, user pertama boleh mendaftar dengan `role: "ADMIN"` (bootstrap).
- Setelah itu `role: "TECHNICIAN"` boleh mendaftar tanpa token.
- `role: "ADMIN"` setelah bootstrap hanya boleh dibuat oleh pemanggil dengan token ADMIN; permintaan
  anonim menghasilkan **403**. Tanpa aturan ini siapa pun bisa menaikkan hak aksesnya sendiri.
- `role` default `TECHNICIAN` jika tidak dikirim.
- Username dan email unik; duplikat menghasilkan **409**.

### User object

```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@datacenter.local",
  "fullName": "Administrator",
  "role": "ADMIN",
  "isActive": true,
  "lastLogin": "2026-10-30T18:30:49.155Z",
  "createdAt": "2026-10-30T18:30:38.387Z",
  "updatedAt": "2026-10-30T18:30:49.156Z"
}
```

`passwordHash` tidak pernah dikirim.

### Token

Payload JWT: `{ "sub": <user id>, "username": "<username>", "role": "ADMIN" | "TECHNICIAN" }`.
Masa berlaku dari `JWT_EXPIRES_IN` (default `7d`). Setiap request terautentikasi memeriksa ulang user di
database, sehingga akun yang dinonaktifkan langsung kehilangan akses.

### Endpoint

| Method | Path | Akses | Body | `data` |
|---|---|---|---|---|
| POST | `/api/auth/register` | publik (ADMIN butuh token) | `username`, `email`, `password` (8–72), `fullName`, `role?` | `{ "user": User }` |
| POST | `/api/auth/login` | publik | `username`, `password` | `{ "token": "...", "user": User }` |
| GET | `/api/auth/me` | terautentikasi | – | `{ "user": User }` |

- Login dengan kredensial salah → **401** `"Invalid username or password"`.
- Login dengan `isActive: false` → **403** `"Account is inactive"`.
- Login sukses memperbarui `lastLogin`.

### Profil sendiri (ekstensi)

`PATCH /api/users/me` memperbarui profil **user yang sedang login**. Tidak ada `/:id`, jadi seorang
user tidak bisa mengubah profil user lain. Field yang boleh dikirim hanya:

| Field | Aturan |
|---|---|
| `fullName` | string 1–100 karakter (di-trim) |
| `email` | email valid, maksimal 255 karakter, unik |
| `password` | password baru, 8–72 karakter |
| `currentPassword` | wajib bersama `password`, tidak dipakai bila `password` tidak dikirim |

Semua field opsional, tetapi body kosong → **400**. Field lain (`username`, `role`, `isActive`)
**ditolak 400** (`Validation failed`, pesan `Unrecognized key ...`), bukan diabaikan diam-diam.

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@datacenter.local",
      "fullName": "Administrator DC",
      "role": "ADMIN",
      "isActive": true,
      "lastLogin": "2026-10-30T18:30:49.155Z",
      "createdAt": "2026-10-30T18:30:38.387Z",
      "updatedAt": "2026-11-04T10:00:00.000Z"
    }
  }
}
```

Bentuk `user` sama dengan `GET /api/auth/me`; `passwordHash` tidak pernah dikirim.

| Kondisi | Status | `message` |
|---|---|---|
| Body tidak valid / field terlarang / body kosong | 400 | `Validation failed` (+ `errors[]`) |
| `password` tanpa `currentPassword` | 400 | `Validation failed`, `errors[0].field = "currentPassword"` |
| `currentPassword` tanpa `password` | 400 | `Validation failed`, `errors[0].field = "password"` |
| `password` kurang dari 8 karakter | 400 | `Validation failed` |
| `currentPassword` salah | 400 | `Current password is incorrect` |
| Email sudah dipakai user lain | 409 | `A user with this email already exists` (+ `errors[]`) |
| Token tidak ada / tidak valid / akun nonaktif | 401 | `Authentication required` / `Invalid or expired token` / `User account is not available` |

- Pemeriksaan email unik mengecualikan baris pemanggil, sehingga mengirim email yang sama dengan
  miliknya sendiri tetap **200**.
- Password baru di-hash ulang dengan bcrypt (cost 10).
- **Mengganti password tidak membatalkan JWT yang sedang dipakai**: token membawa id user, bukan
  sidik jari kredensial, dan setiap request memuat ulang baris user. Aplikasi mobile memilih untuk
  logout setelah password berganti; klien lain boleh tetap memakai token sampai kedaluwarsa.
- Perubahan `fullName` langsung terlihat pada respons dan pada greeting/avatar setelah store mobile
  diperbarui.


## 3. Asset

Semua endpoint asset membutuhkan token. Penulisan (`POST`, `PUT`, `DELETE`) hanya untuk **ADMIN**.

### Bentuk asset

Item list:

```json
{
  "id": 1,
  "assetCode": "SRV-001",
  "assetName": "WEB Server 01",
  "assetType": "SERVER",
  "brand": "Dell",
  "model": "PowerEdge R750",
  "serialNumber": "SN-DC-SRV-001",
  "purchaseDate": "2024-02-10",
  "warrantyEnd": "2027-02-10",
  "status": "ACTIVE",
  "description": "Web server produksi untuk aplikasi internal",
  "createdBy": 1,
  "createdAt": "2026-06-01T08:00:00.000Z",
  "updatedAt": "2026-06-01T08:00:00.000Z",
  "location": {
    "id": 1,
    "dataCenter": "DC-1",
    "rack": "A",
    "rackSlot": "U03",
    "floor": "1",
    "room": null,
    "isCurrent": true,
    "movedAt": "2026-06-01T08:00:00.000Z"
  },
  "network": {
    "connectionStatus": "ONLINE",
    "hostname": "web-srv-01",
    "ipAddress": "192.168.1.10"
  }
}
```

`location` adalah lokasi dengan `isCurrent: true` (atau `null`). `network` bernilai `null` bila aset
belum punya informasi jaringan.

Detail (`GET /api/assets/:id`) menambahkan:

```json
{
  "creator": { "id": 1, "username": "admin", "fullName": "Administrator" },
  "locationHistory": [ ],
  "network": { "id": 1, "assetId": 1, "hostname": "...", "ipAddress": "...", "subnetMask": "...", "gateway": "...", "macAddress": "...", "connectionStatus": "ONLINE", "lastChecked": "...", "notes": "..." },
  "maintenanceCount": 2,
  "latestPrediction": null
}
```

`latestPrediction` diisi prediksi aktif terbaru (dikerjakan pada tahap AI) dan bernilai `null` selama
belum ada prediksi. `locationHistory` diurutkan `movedAt` menurun.

### Endpoint

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/assets` | semua role | List + search/filter/sort/pagination |
| GET | `/api/assets/statistics` | semua role | Statistik dashboard |
| GET | `/api/assets/:id` | semua role | Detail lengkap dengan relasi |
| POST | `/api/assets` | ADMIN | Buat aset (lokasi & network opsional) |
| PUT | `/api/assets/:id` | ADMIN | Update parsial; lokasi baru menggantikan lokasi aktif |
| DELETE | `/api/assets/:id` | ADMIN | Hapus aset; **409** bila ada riwayat maintenance/prediksi |

Urutan route: `/statistics` didaftarkan sebelum `/:id`.

### Query list

| Param | Nilai | Default |
|---|---|---|
| `search` | substring `assetCode` / `assetName` / `serialNumber`, case-insensitive | – |
| `type` | `AssetType` | – |
| `status` | `AssetStatus` | – |
| `rack` | kode rack pada lokasi aktif | – |
| `sortBy` | `assetName`, `assetCode`, `createdAt`, `status` | `createdAt` |
| `order` | `asc`, `desc` | `desc` |
| `page` | integer ≥ 1 | `1` |
| `limit` | integer 1–100 | `10` |

### Body create

```json
{
  "assetCode": "SRV-002",
  "assetName": "DB Server",
  "assetType": "SERVER",
  "brand": "HPE",
  "model": "ProLiant DL380",
  "serialNumber": "SN-002",
  "purchaseDate": "2025-01-10",
  "warrantyEnd": "2028-01-10",
  "status": "ACTIVE",
  "description": "Database server",
  "location": { "dataCenter": "DC-1", "rack": "B", "rackSlot": "U10", "floor": "1", "room": "R1" },
  "network": {
    "hostname": "db-srv",
    "ipAddress": "10.0.0.5",
    "subnetMask": "255.255.255.0",
    "gateway": "10.0.0.1",
    "macAddress": "AA:BB:CC:00:00:10",
    "connectionStatus": "ONLINE",
    "notes": "VLAN 20"
  }
}
```

Wajib: `assetCode`, `assetName`, `assetType`. `status` default `ACTIVE`. `createdBy` diisi otomatis
dari user yang membuat. Lokasi/network dibuat dalam transaksi yang sama. `assetCode` dan
`serialNumber` duplikat → **409**.

### Body update

Semua field create bersifat opsional. Bila `location` dikirim, baris lokasi aktif lama diubah menjadi
`isCurrent: false` dan baris baru dibuat dengan `movedAt` sekarang. Bila `network` dikirim, relasi 1:1
di-upsert (field yang tidak dikirim tidak berubah).

### Statistik

```json
{
  "total": 9,
  "byStatus": { "ACTIVE": 7, "MAINTENANCE": 1, "INACTIVE": 1 },
  "byType": { "SERVER": 3, "SWITCH": 1, "ROUTER": 1, "STORAGE": 1, "FIREWALL": 1, "RACK": 1, "OTHER": 1 },
  "warrantyExpiringSoon": 1,
  "addedThisMonth": 2
}
```

`warrantyExpiringSoon` menghitung aset dengan `warrantyEnd` antara hari ini dan 30 hari ke depan.
`addedThisMonth` menghitung aset dengan `createdAt` pada bulan berjalan. Semua key enum selalu ada
(nilai `0` bila kosong).

## 4. Maintenance

Semua endpoint maintenance membutuhkan token. `GET` boleh untuk semua role; `POST`, `PUT`, `DELETE`
hanya **ADMIN**.

### Bentuk maintenance

```json
{
  "id": 1,
  "assetId": 1,
  "technicianId": 2,
  "maintenanceType": "REPAIR",
  "maintenanceDate": "2026-09-25",
  "description": "Ganti RAM modul 2",
  "result": "Resolved - RAM diganti",
  "cost": 850000,
  "nextSchedule": "2027-03-25",
  "createdAt": "2026-10-30T18:35:00.000Z",
  "updatedAt": "2026-10-30T18:35:00.000Z",
  "asset": { "id": 1, "assetCode": "SRV-001", "assetName": "WEB Server 01" },
  "technician": { "id": 2, "username": "teknisi1", "fullName": "Budi Santoso" }
}
```

`technician` bernilai `null` bila `technicianId` kosong. `cost` dikirim sebagai number.

### Endpoint

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/maintenance` | semua role | List + filter + pagination |
| GET | `/api/maintenance/statistics` | semua role | Statistik |
| GET | `/api/maintenance/schedule` | semua role | Jadwal terlewat dan mendatang (ekstensi) |
| POST | `/api/maintenance/reminders` | ADMIN | Buat ulang pengingat idempoten (ekstensi) |
| GET | `/api/maintenance/asset/:assetId` | semua role | Riwayat satu aset, tanggal menurun |
| GET | `/api/maintenance/:id` | semua role | Detail |
| POST | `/api/maintenance` | ADMIN | Buat riwayat |
| PUT | `/api/maintenance/:id` | ADMIN | Update parsial |
| DELETE | `/api/maintenance/:id` | ADMIN | Hapus |

Urutan route: `/statistics` dan `/asset/:assetId` didaftarkan sebelum `/:id`.

### Query list

| Param | Nilai | Default |
|---|---|---|
| `type` | `MaintenanceType` | – |
| `assetId` | integer | – |
| `technicianId` | integer | – |
| `startDate` | `YYYY-MM-DD` (inklusif) | – |
| `endDate` | `YYYY-MM-DD` (inklusif) | – |
| `page`, `limit` | pagination | `1`, `10` |

Urutan: `maintenanceDate` menurun, lalu `id` menurun.

### Body create

```json
{
  "assetId": 1,
  "technicianId": 2,
  "maintenanceType": "REPAIR",
  "maintenanceDate": "2026-09-25",
  "description": "Ganti RAM",
  "result": "Resolved - RAM diganti",
  "cost": 850000,
  "nextSchedule": "2027-03-25"
}
```

Wajib: `assetId`, `maintenanceType`, `maintenanceDate`. `technicianId` default adalah user yang
sedang login (dokumen sumber tidak menyediakan endpoint daftar user). `assetId`/`technicianId` yang
tidak ada → **404**. Body update tidak boleh mengubah `assetId`.

### Sinkronisasi status aset

- Membuat `REPAIR`, `UPGRADE`, atau `REPLACEMENT` → status aset menjadi `MAINTENANCE`.
- Membuat `ROUTINE` atau `INSPECTION` → status aset tidak berubah.
- Bila `result` diawali `Resolved` (tidak peka huruf besar/kecil, setelah trim) → status aset menjadi
  `ACTIVE`. Aturan ini berlaku saat create dan saat update, dan menang atas aturan tipe di atas.
- Update tipe maintenance tanpa `result` tidak mengembalikan status secara otomatis.
- Menghapus riwayat tidak mengembalikan status aset.

### Statistik

```json
{
  "total": 8,
  "byType": { "ROUTINE": 2, "REPAIR": 2, "UPGRADE": 1, "INSPECTION": 2, "REPLACEMENT": 1 },
  "totalCost": 4600000,
  "thisMonthCount": 2,
  "upcomingSchedules": 1
}
```

`upcomingSchedules` menghitung riwayat dengan `nextSchedule` antara hari ini dan 30 hari ke depan.
`thisMonthCount` menghitung `maintenanceDate` pada bulan berjalan.

### Jadwal maintenance (ekstensi)

Dokumen sumber tidak memiliki endpoint jadwal; endpoint ini **aditif** dan tidak mengubah bentuk
endpoint maintenance yang sudah ada.

```
GET /api/maintenance/schedule?window=7|30&includeOverdue=true|false
```

Token wajib (**401** tanpa token) dan tersedia untuk kedua role. `window` hanya menerima `7` atau
`30` (default `30`); nilai lain → **400**. `includeOverdue` default `true`; nilai selain
`"true"`/`"false"` → **400**.

```json
{
  "window": 30,
  "includeOverdue": true,
  "today": "2026-11-04",
  "counts": { "overdue": 1, "dueSoon": 2, "upcoming": 2, "total": 5 },
  "items": [
    {
      "maintenanceId": 7,
      "assetId": 5,
      "asset": {
        "id": 5,
        "assetCode": "STG-001",
        "assetName": "Storage Array",
        "assetType": "STORAGE",
        "status": "ACTIVE"
      },
      "maintenanceType": "ROUTINE",
      "maintenanceDate": "2026-08-01",
      "nextSchedule": "2026-10-28",
      "daysUntil": -7,
      "state": "OVERDUE",
      "lastResult": "In progress - menunggu spare part"
    }
  ]
}
```

- Perbandingan memakai tanggal saja (UTC): `nextSchedule < hari ini` → `OVERDUE` (`daysUntil` negatif),
  `0…7` hari → `DUE_SOON`, `8…30` hari → `UPCOMING`.
- `includeOverdue=false` membuang baris `OVERDUE`; `window=7` membuang `daysUntil > 7`.
- Urutan `items`: `nextSchedule` menaik (terlewat lebih dulu), lalu `id`.
- `counts` selalu menghitung seluruh papan (terlewat + 30 hari) agar badge tab tidak berubah saat
  filter berganti. `counts.total = overdue + dueSoon + upcoming`.
- Baris tanpa `nextSchedule` tidak pernah muncul.

### Pengingat maintenance (ekstensi)

```
POST /api/maintenance/reminders
```

Hanya **ADMIN** (**403** untuk teknisi, **401** tanpa token). Memindai riwayat dengan `nextSchedule`
yang terlewat atau jatuh tempo dalam 7 hari, lalu membuat satu `MAINTENANCE_REMINDER` untuk setiap
user aktif.

```json
{ "scanned": 3, "created": 6, "skipped": 0 }
```

- `scanned` = jumlah baris jadwal yang masuk horizon pengingat.
- `created` = jumlah notifikasi baru; `skipped` = kandidat yang sudah punya kunci yang sama.
- Kunci idempotensi: `dedupeKey = "<maintenanceId>:<nextSchedule YYYY-MM-DD>"`, unik per
  `(userId, dedupeKey)`. Menjalankan ulang tidak membuat duplikat (`created = 0`); mengubah
  `nextSchedule` menghasilkan kunci baru sehingga pengingat baru boleh dibuat; notifikasi yang
  dihapus membebaskan kuncinya dan dapat dibuat ulang.
- Penerima: seluruh user `isActive: true`; user nonaktif tidak pernah menerima pengingat.
- Isi: `type = MAINTENANCE_REMINDER`, `assetId` dan `maintenanceId` diisi, `predictionId = null`.
  Judul memuat kode aset; pesan berbahasa Indonesia memuat kode/nama aset, tanggal jatuh tempo,
  jumlah hari terlewat atau menuju jatuh tempo, dan hasil perawatan terakhir.
- Job harian `node-cron` pukul **07.00 waktu server** memanggil fungsi service yang sama. Job hanya
  aktif bila `REMINDER_JOB_ENABLED=true` (default `false`); pengujian memanggil service secara
  langsung tanpa menunggu timer.

## 5. Network

Semua endpoint network membutuhkan token. `GET` boleh untuk semua role; `POST`, `PUT`, `DELETE`, dan
`check` hanya **ADMIN**.

### Bentuk network

```json
{
  "id": 1,
  "assetId": 1,
  "hostname": "web-srv-01",
  "ipAddress": "192.168.1.10",
  "subnetMask": "255.255.255.0",
  "gateway": "192.168.1.1",
  "macAddress": "AA:BB:CC:00:00:01",
  "connectionStatus": "ONLINE",
  "lastChecked": "2026-10-30T16:35:00.000Z",
  "notes": "VLAN 10 - produksi",
  "asset": { "id": 1, "assetCode": "SRV-001", "assetName": "WEB Server 01" }
}
```

### Endpoint

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/network` | semua role | List + filter status + search hostname/IP |
| GET | `/api/network/statistics` | semua role | Statistik |
| GET | `/api/network/asset/:assetId` | semua role | Info jaringan satu aset |
| GET | `/api/network/:id` | semua role | Detail |
| POST | `/api/network` | ADMIN | Upsert berdasarkan `assetId` |
| PUT | `/api/network/:id` | ADMIN | Update parsial |
| DELETE | `/api/network/:id` | ADMIN | Hapus |
| POST | `/api/network/:id/check` | ADMIN | Simulasi pengecekan koneksi |

Urutan route: `/statistics` dan `/asset/:assetId` didaftarkan sebelum `/:id`.

Dokumen sumber menulis heading "Endpoint: 7" tetapi mendaftar 8 route dan §7.1 menghitung 8; kontrak
ini mengikuti jumlah 8.

### Query list

| Param | Nilai | Default |
|---|---|---|
| `connectionStatus` | `ConnectionStatus` | – |
| `search` | substring `hostname` / `ipAddress`, case-insensitive | – |
| `page`, `limit` | pagination | `1`, `10` |

### Body upsert (POST)

```json
{
  "assetId": 1,
  "hostname": "web-srv-01",
  "ipAddress": "192.168.1.10",
  "subnetMask": "255.255.255.0",
  "gateway": "192.168.1.1",
  "macAddress": "AA:BB:CC:00:00:01",
  "connectionStatus": "ONLINE",
  "notes": "VLAN 10"
}
```

Wajib: `assetId`. Bila aset sudah punya baris network, field yang dikirim menggantikan nilai lama
(field yang tidak dikirim tetap). `assetId` tidak ada → **404**. Respons **200** untuk create maupun
update.

### Simulasi check

`POST /api/network/:id/check` tidak melakukan ICMP sungguhan. Server mengundi hasil dengan peluang
80% `ONLINE` dan 20% `OFFLINE`, lalu menyimpan `lastChecked` = sekarang dan mengembalikan baris
terbaru.

### Statistik

```json
{
  "total": 8,
  "byConnectionStatus": { "ONLINE": 6, "OFFLINE": 1, "UNKNOWN": 1 },
  "lastCheckedWithin24h": 8
}
```

## 6. AI Prediction (Hybrid Engine)

Modul `src/modules/ai-prediction/` berisi 7 file sesuai dokumen sumber. Mesin ini adalah
**heuristik deterministik** (aturan + statistik + pencocokan pola), bukan model machine learning
yang dilatih, dan tidak memanggil layanan AI eksternal. Tidak ada metrik akurasi yang diklaim.

### Aturan perhitungan

Layer 1 — skor dasar berbobot (setiap faktor dinormalisasi 0–100):

| Faktor | Normalisasi | Bobot |
|---|---|---|
| `frequency` | `min(maintenance 90 hari / 5, 1) * 100` | 0.25 |
| `incidents` | `min(REPAIR 90 hari / 4, 1) * 100` | 0.20 |
| `age` | `min(usia tahun / 5, 1) * 100` (dari `purchaseDate`, fallback `createdAt`) | 0.15 |
| `status` | `ACTIVE` 0, `MAINTENANCE` 100, `INACTIVE` 60 | 0.15 |
| `network` | `ONLINE` 0, `UNKNOWN` 50, `OFFLINE` 100, tanpa baris 50 | 0.05 |

Layer 2 — penyesuaian statistik bertanda, total di-clamp ke ±10:

| Sinyal | Aturan | Rentang |
|---|---|---|
| `zScore` | z dari interval maintenance aset terhadap peer satu tipe; **butuh ≥3 peer yang masing-masing punya ≥3 baris**, jika tidak 0. Tanda dibalik: interval lebih pendek dari peer (z negatif) menaikkan risiko. `|z| ≥ 2` penuh, `1.5 ≤ |z| < 2` setengah | ±10 |
| `trend` | jumlah maintenance 45 hari terakhir dibanding 45 hari sebelumnya: naik +5, turun −5, sama 0 | ±5 |
| `interval` | rata-rata jarak maintenance **terjadwal (selain `REPAIR`)**; **butuh ≥3 baris terjadwal**, jika tidak 0. `<60` hari +5, `<90` hari +2.5, `>180` hari −5, selain itu 0 | ±5 |
| `peer` | jumlah maintenance 90 hari di atas median peer satu tipe +5, di bawah −2.5, sama 0; **butuh ≥3 peer**, jika tidak 0 | ±5 |

Layer 3 — pencocokan pola, hanya penambahan, total ≤15 (contoh kerja dokumen memakai 4 komponen):

| Pola | Kondisi | Boost |
|---|---|---|
| `downtimeOffline` | network `OFFLINE` | +2.5 |
| `downtimeRepair` | ≥3 `REPAIR` dalam 90 hari | +1.5 |
| `repairRatio` | `REPAIR / maintenance 90 hari ≥ 0.5` → `min(rasio * 6.25, 5)` | 0..+5 |
| `daysSince` | hari sejak maintenance terakhir: 90–180 linear, ≥180 | 0..+5 |

- `final = clamp(layer1 + layer2 + layer3, 0, 100)`, dibulatkan 2 desimal.
- Level: `≤30` LOW, `≤60` MEDIUM, selain itu HIGH.
- `confidence = 50 + min(jumlah maintenance, 5) * 5 + (network?10) + (purchaseDate?10) + (usia ≥90 hari?5)`, maksimal 95.
- `predictedFailureDays = clamp(round((100 - riskScore) * 0.9), 3, 365)`.
- Skor maksimum yang dapat dicapai dengan bobot di atas adalah **99**; clamp 100 tetap dipertahankan
  sebagai pengaman. Contoh kerja dokumen (SRV-001): Layer 1 `69.5` + Layer 2 `5` + Layer 3 `9` = **83.5 HIGH**,
  confidence 95, 15 hari.

Contoh `layerBreakdown` untuk 83.5:

```json
{
  "layer1": {
    "baseScore": 69.5,
    "factors": [
      { "name": "frequency", "raw": 100, "weight": 0.25, "impact": 25 },
      { "name": "incidents", "raw": 100, "weight": 0.2, "impact": 20 },
      { "name": "age", "raw": 30, "weight": 0.15, "impact": 4.5 },
      { "name": "status", "raw": 100, "weight": 0.15, "impact": 15 },
      { "name": "network", "raw": 100, "weight": 0.05, "impact": 5 }
    ]
  },
  "layer2": {
    "adjustments": { "zScore": 0, "trend": 5, "interval": 0, "peer": 0 },
    "total": 5
  },
  "layer3": {
    "boosts": { "downtimeOffline": 2.5, "downtimeRepair": 1.5, "repairRatio": 5, "daysSince": 0 },
    "total": 9
  },
  "final": 83.5
}
```

### Bentuk prediksi tersimpan

List dan riwayat mengembalikan baris `ai_predictions` dengan `riskScore`/`confidence` sebagai number:

```json
{
  "id": 16,
  "assetId": 10,
  "riskScore": 83.5,
  "riskLevel": "HIGH",
  "confidence": 95,
  "topFactors": [{ "name": "frequency", "impact": 25, "description": "..." }],
  "recommendation": "Lakukan inspeksi menyeluruh segera dan jadwalkan penggantian komponen yang berisiko.",
  "predictedFailureDays": 15,
  "modelVersion": "v1.0",
  "predictedAt": "2026-10-30T19:28:00.000Z",
  "isActive": true,
  "asset": { "id": 10, "assetCode": "SRV-001", "assetName": "WEB Server 01" }
}
```

Menyimpan prediksi baru menonaktifkan prediksi aktif sebelumnya untuk aset yang sama
(`isActive: false`) dalam satu transaksi. `POST /predict/:assetId` mengembalikan bentuk penilaian
lengkap ditambah `id`, `predictedAt`, `isActive`, dan `alertsCreated`.

### Penilaian lengkap (explain dan predict)

```json
{
  "assetId": 10,
  "assetCode": "SRV-001",
  "assetName": "WEB Server 01",
  "riskScore": 83.5,
  "riskLevel": "HIGH",
  "confidence": 95,
  "predictedFailureDays": 15,
  "shortSummary": "SRV-001 risiko tinggi (83.5/100) karena frekuensi maintenance tinggi, insiden perbaikan tinggi, status maintenance.",
  "explanation": "Aset SRV-001 (WEB Server 01) memiliki skor risiko 83.5/100 dengan level HIGH. Faktor dominan: ... Lakukan inspeksi menyeluruh segera ...",
  "topFactors": [{ "name": "frequency", "impact": 25, "description": "Frekuensi maintenance dalam 90 hari terakhir sangat tinggi" }],
  "recommendation": "Lakukan inspeksi menyeluruh segera dan jadwalkan penggantian komponen yang berisiko.",
  "layerBreakdown": { "layer1": {}, "layer2": {}, "layer3": {}, "final": 83.5 },
  "modelVersion": "v1.0"
}
```

`topFactors` berisi 3–5 faktor dengan dampak absolut terbesar. `explanation` adalah 2–4 kalimat
bahasa Indonesia yang menyebut faktor dominan dan rekomendasi. Rekomendasi mengikuti level: HIGH
inspeksi segera/penggantian, MEDIUM preventive maintenance, LOW pemantauan rutin.

### Endpoint

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/ai/predictions` | semua role | List prediksi + filter + pagination + `asset` |
| GET | `/api/ai/predictions/asset/:assetId` | semua role | Riwayat prediksi satu aset, terbaru dulu |
| GET | `/api/ai/risk-summary` | semua role | Ringkasan dashboard |
| GET | `/api/ai/explain/:assetId` | semua role | Hitung + jelaskan **tanpa menyimpan** |
| POST | `/api/ai/predict/:assetId` | ADMIN | Hitung, simpan, nonaktifkan prediksi lama, buat alert HIGH (201) |
| POST | `/api/ai/predict-batch` | ADMIN | Batch prediksi; body kosong = semua aset |

Urutan route: static (`/predictions`, `/risk-summary`, `/explain/:assetId`, `/predict-batch`) didaftarkan
sebelum route berparameter.

### Query list prediksi

| Param | Nilai | Default |
|---|---|---|
| `assetId` | integer | – |
| `riskLevel` | `LOW`, `MEDIUM`, `HIGH` | – |
| `activeOnly` | `true`, `false` | semua |
| `page`, `limit` | pagination | `1`, `10` |

Urutan: `predictedAt` menurun, lalu `id` menurun.

### Risk summary

```json
{
  "counts": { "LOW": 7, "MEDIUM": 1, "HIGH": 1 },
  "averageScore": 25.26,
  "topRiskAssets": [
    {
      "assetId": 10,
      "assetCode": "SRV-001",
      "assetName": "WEB Server 01",
      "riskScore": 83.5,
      "riskLevel": "HIGH",
      "predictedFailureDays": 15,
      "predictedAt": "2026-10-30T19:28:00.000Z"
    }
  ],
  "assetsWithoutPrediction": 0,
  "lastPredictedAt": "2026-10-30T19:28:00.000Z"
}
```

`counts` dan `averageScore` dihitung dari prediksi **aktif** saja. `topRiskAssets` berisi maksimal 5
prediksi aktif HIGH/MEDIUM dengan skor tertinggi. `assetsWithoutPrediction` menghitung aset yang belum
pernah punya baris prediksi. `lastPredictedAt` adalah waktu prediksi terbaru (aktif maupun tidak);
`null` bila belum ada prediksi.

### Batch

Body: `{ "assetIds": [10, 11] }` atau `{}` untuk semua aset.

```json
{
  "processed": 9,
  "high": 1,
  "medium": 1,
  "low": 7,
  "alertsCreated": 2,
  "failed": [{ "assetId": 999999, "message": "Asset not found" }]
}
```

Kegagalan satu aset dicatat di `failed` dan tidak menggagalkan seluruh batch (HTTP tetap **200**).
`processed` menghitung aset yang berhasil.

## 7. Notification

Modul `src/modules/notification/` berisi 4 file. Semua endpoint membutuhkan token dan hanya
menyentuh baris milik user yang login. Notifikasi milik user lain dijawab **404** (bukan 403) agar
keberadaannya tidak bocor.

### Bentuk notifikasi

```json
{
  "id": 8,
  "type": "AI_ALERT",
  "title": "AI Alert: SRV-001 risiko HIGH",
  "message": "Prediksi risiko 83.5/100 (HIGH) untuk SRV-001 - WEB Server 01. Lakukan inspeksi menyeluruh segera ...",
  "isRead": false,
  "readAt": null,
  "createdAt": "2026-10-30T19:28:00.000Z",
  "assetId": 10,
  "predictionId": 16,
  "maintenanceId": null,
  "dedupeKey": null,
  "asset": { "id": 10, "assetCode": "SRV-001", "assetName": "WEB Server 01" }
}
```

`asset`, `predictionId`, dan `maintenanceId` bernilai `null` untuk notifikasi yang tidak terkait
aset/prediksi/jadwal. `dedupeKey` hanya diisi pada `MAINTENANCE_REMINDER` (lihat §4); `AI_ALERT`
memiliki `maintenanceId = null` dan `dedupeKey = null`.

### Endpoint

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/notifications` | List milik user; filter `isRead`, `type`; pagination |
| GET | `/api/notifications/unread-count` | `{ "unreadCount": 2 }` |
| GET | `/api/notifications/:id` | Detail milik user |
| PUT | `/api/notifications/:id/read` | `isRead=true`, `readAt` diisi sekali |
| PUT | `/api/notifications/read-all` | `{ "updated": 3 }` |
| DELETE | `/api/notifications/:id` | Hapus satu milik user |
| DELETE | `/api/notifications/read` | `{ "deleted": 2 }` — hapus semua yang sudah dibaca |

Urutan route: `/unread-count`, `/read-all`, dan `/read` didaftarkan sebelum `/:id` agar tidak
dianggap sebagai id.

Urutan list: `createdAt` menurun, lalu `id` menurun.

### Alert otomatis

Setiap prediksi berlevel **HIGH** membuat satu baris `AI_ALERT` untuk **setiap user aktif**, berisi
judul, pesan (skor + rekomendasi), `assetId`, dan `predictionId`. Pembuatan berjalan dalam transaksi
yang sama dengan penyimpanan prediksi dan idempoten untuk `predictionId` yang sama. Prediksi MEDIUM
dan LOW tidak membuat alert.

`MAINTENANCE_REMINDER` tidak dibuat oleh mesin AI. Baris ini hanya dibuat oleh
`POST /api/maintenance/reminders` atau job hariannya, dengan `maintenanceId`, `dedupeKey`, dan
`assetId` terisi (lihat §4).

## 8. Health

| Method | Path | Akses | `data` |
|---|---|---|---|
| GET | `/health` | publik | `{ "status": "ok", "environment": "development", "timestamp": "..." }` |

## 9. Keputusan atas bagian dokumen yang ambigu

| # | Hal | Keputusan |
|---|---|---|
| 1 | §5.4 menulis 7 endpoint tetapi mendaftar 8 | Implementasi 8 endpoint network |
| 2 | Registrasi anonim menerima role apa pun | User pertama boleh ADMIN; ADMIN berikutnya butuh token ADMIN |
| 3 | Teknisi "view + update status" vs tabel endpoint | Semua penulisan ADMIN; teknisi read-only |
| 4 | Maintenance butuh `technicianId` tanpa endpoint daftar user | Default ke user yang login |
| 5 | Urutan status `MAINTENANCE` vs `result` dimulai `Resolved` | `Resolved` menang → `ACTIVE` |
| 6 | Port database dokumen 5432 | Lingkungan lokal memakai 5433 |
| 7 | Node 22 pada dokumen | Lingkungan lokal memakai Node 24.21.0 |
| 8 | Contoh kerja Layer 2 menulis interval 0 untuk 5 baris dalam 90 hari | Sinyal interval memakai maintenance terjadwal (selain `REPAIR`) dan butuh ≥3 baris; sinyal peer/z-score butuh ≥3 peer |
| 9 | Dokumen tidak menyebut batas sampel untuk z-score/peer | Keduanya 0 bila peer kurang dari 3, agar sinyal kecil tidak menyesatkan |
| 10 | Notifikasi milik user lain | Dijawab 404, bukan 403 |
| 11 | `risk-summary` tidak mendefinisikan populasi hitungan | `counts`/`averageScore` dari prediksi aktif; `assetsWithoutPrediction` dari seluruh riwayat |
| 12 | Clamp akhir 100 | Skor maksimum yang dapat dicapai adalah 99; clamp 100 adalah pengaman |
| 13 | Dokumen tidak menyediakan endpoint jadwal/pengingat maintenance | Ditambahkan 2 endpoint ekstensi (`GET /api/maintenance/schedule`, `POST /api/maintenance/reminders`) tanpa mengubah bentuk endpoint lama; total menjadi 39 |
| 14 | Dokumen tidak menyediakan endpoint ubah profil; layar profil semula hanya baca | Ditambahkan 1 endpoint ekstensi `PATCH /api/users/me` (self only, field `username`/`role`/`isActive` ditolak 400); total menjadi 40 |

Kontrak AI dan notification di atas dipakai oleh tahap mobile. Mesin AI tetap deterministik:
jangan menambahkan klaim akurasi atau menyebutnya sebagai model yang dilatih.
