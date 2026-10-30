# Handoff — DataCenter Asset Tracker

Dokumen ini mencatat status pekerjaan terakhir agar sesi berikutnya bisa melanjutkan tanpa menebak.

## Status

Backend core selesai pada branch `feat/backend-core`: Express 5 + TypeScript + Prisma + PostgreSQL 16,
dengan 24 endpoint (Auth 3, Asset 6, Maintenance 7, Network 8). Kontrak lengkap ada di
`docs/API_CONTRACT.md`; dokumen itu yang dipakai brief mobile, jangan mengubahnya diam-diam.

Sudah tersedia:

- Skema Prisma dengan 7 tabel dan 7 enum, migrasi awal, dan seed data demo (2 user, 9 aset yang
  mencakup semua tipe dan status, 8 riwayat maintenance, 8 baris network).
- Auth JWT + bcrypt, role guard, aturan registrasi admin bootstrap.
- Modul asset (CRUD, search/filter/sort/pagination, statistik), maintenance (termasuk sinkronisasi
  status aset), network (upsert, simulasi check, statistik).

Belum dikerjakan (brief berikutnya): AI prediction, alert/notification, mobile app, deployment.
Tidak ada endpoint AI/notification pada tahap ini.

## Menjalankan

```bash
cd backend
npm install
npx prisma migrate dev
npx prisma generate
npx prisma db seed
npm run dev
```

Environment variable (nama saja): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`,
`NODE_ENV`, `SEED_ADMIN_PASSWORD`, `SEED_TECH_PASSWORD`. Nilai asli hanya ada di `backend/.env`
yang tidak di-commit.

## Catatan lingkungan

- Node.js 24.21.0 (dokumen sumber menulis Node 22).
- PostgreSQL 16 lokal pada port 5433 (dokumen sumber menulis 5432).
- Database/role lokal: `datacenter_tracker` / `dc_admin`, password dibuat sendiri dan tidak
  dicatat di repositori.

## Resume protocol

Baca file ini dan `docs/API_CONTRACT.md` sebelum mengubah backend. Brief 2 menambahkan modul AI dan
notification tanpa mengubah kontrak endpoint yang sudah ada; bila ada field yang kurang, laporkan
alih-alih mengarang field baru.
