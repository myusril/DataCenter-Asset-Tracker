# API Contract — DataCenter Asset Tracker

Kontrak ini adalah acuan tunggal untuk backend dan aplikasi mobile. Setiap field, status code, dan
bentuk respons di bawah ini harus cocok dengan implementasi. Perubahan kontrak wajib disepakati lebih
dulu, bukan dilakukan diam-diam saat mengerjakan mobile.

- Base URL lokal: `http://localhost:3000`
- Content type: `application/json`
- Semua endpoint selain `GET /health`, `POST /api/auth/register`, dan `POST /api/auth/login`
  membutuhkan header `Authorization: Bearer <token>`.
- Total endpoint: **24** (Auth 3, Asset 6, Maintenance 7, Network 8).

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
  "total": 6,
  "byType": { "ROUTINE": 1, "REPAIR": 2, "UPGRADE": 1, "INSPECTION": 1, "REPLACEMENT": 1 },
  "totalCost": 4350000,
  "thisMonthCount": 2,
  "upcomingSchedules": 1
}
```

`upcomingSchedules` menghitung riwayat dengan `nextSchedule` antara hari ini dan 30 hari ke depan.
`thisMonthCount` menghitung `maintenanceDate` pada bulan berjalan.

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
  "byConnectionStatus": { "ONLINE": 5, "OFFLINE": 1, "UNKNOWN": 2 },
  "lastCheckedWithin24h": 8
}
```

## 6. Health

| Method | Path | Akses | `data` |
|---|---|---|---|
| GET | `/health` | publik | `{ "status": "ok", "environment": "development", "timestamp": "..." }` |

## 7. Keputusan atas bagian dokumen yang ambigu

| # | Hal | Keputusan |
|---|---|---|
| 1 | §5.4 menulis 7 endpoint tetapi mendaftar 8 | Implementasi 8 endpoint network |
| 2 | Registrasi anonim menerima role apa pun | User pertama boleh ADMIN; ADMIN berikutnya butuh token ADMIN |
| 3 | Teknisi "view + update status" vs tabel endpoint | Semua penulisan ADMIN; teknisi read-only |
| 4 | Maintenance butuh `technicianId` tanpa endpoint daftar user | Default ke user yang login |
| 5 | Urutan status `MAINTENANCE` vs `result` dimulai `Resolved` | `Resolved` menang → `ACTIVE` |
| 6 | Port database dokumen 5432 | Lingkungan lokal memakai 5433 |
| 7 | Node 22 pada dokumen | Lingkungan lokal memakai Node 24.21.0 |

Larangan lain yang tetap berlaku: tidak ada endpoint AI/notification pada tahap ini; keduanya
ditambahkan pada tahap berikutnya tanpa mengubah kontrak di atas.
