# DataCenter Asset Tracker

Aplikasi inventaris dan asset tracking data center untuk teknisi dan administrator: pencatatan aset
(server, switch, router, storage, firewall, rack), riwayat lokasi, informasi jaringan, riwayat maintenance,
serta risk prediction berbasis AI untuk preventive maintenance. Backend berupa REST API (Express 5 +
TypeScript + Prisma + PostgreSQL), mobile client menyusul pada tahap berikutnya.

## Setup

Panduan instalasi lengkap akan ditambahkan bersama backend (lihat `backend/.env.example` untuk nama
environment variable yang dibutuhkan).

### Catatan lingkungan pengembangan

- Node.js yang terpasang di mesin ini adalah **24.21.0**; dokumen sumber menyebut Node.js 22.
- PostgreSQL 16 lokal berjalan pada port **5433** (bukan 5432 seperti pada dokumen sumber).
