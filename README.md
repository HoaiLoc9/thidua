# He thong xet duyet thi dua, danh hieu va khen thuong IUH

He thong ho tro so hoa quy trinh dang ky, nop minh chung, cham diem va xet duyet thi dua theo nhieu cap trong truong dai hoc.

## Tong quan kien truc

- `frontend/`: ung dung React + Vite.
- `backend/`: REST API Express + Prisma.
- `backend/prisma/`: schema, migration, seed cho PostgreSQL.

Cong nghe chinh:

- Frontend: React, React Router, Axios, GSAP, Vite.
- Backend: Node.js, Express, Prisma ORM, JWT, bcrypt.
- CSDL: PostgreSQL.
- Upload/bao mat file: Multer + kiem tra an toan + ClamAV (tuy chon).
- Bao cao: xuat du lieu CSV/PDF/XLSX.

## Chuc nang chinh

- Dang nhap, phan quyen theo vai tro: `ADMIN`, `CANBO`, `GIANGVIEN`, `SINHVIEN`, `HOIDONG`.
- Quan ly nguoi dung, don vi, nam hoc, tieu chi, danh hieu/khen thuong.
- Tao ho so thi dua ca nhan/nhom, upload minh chung, nop ho so.
- Xet duyet nhieu cap: `DONVI -> KHOA -> TRUONG`.
- Bo phieu hoi dong va dieu chinh diem minh chung.
- Thong bao he thong, audit log, bao cao tong hop.
- Quen mat khau va doi mat khau bang OTP.

## Cau truc thu muc

```text
thidua/
|- backend/
|  |- prisma/
|  |- src/
|  \- tests/
|- frontend/
|- docs/
|- scripts/
\- README.md
```

## Yeu cau he thong

- Node.js 18+ (khuyen nghi Node.js 20 LTS).
- npm 9+.
- PostgreSQL 14+.
- ClamAV (neu bat quet file).

## Cau hinh moi truong

### 1) Backend (`backend/.env`)

Sao chep tu `backend/.env.example` va dien gia tri thuc te:

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgresql://user:password@localhost:5432/thidua_db

MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your-email@example.com
MAIL_PASS=your-app-password
MAIL_FROM="He thong thi dua IUH <your-email@example.com>"

CLAMAV_HOST=127.0.0.1
CLAMAV_PORT=3310
CLAMAV_TIMEOUT_MS=20000
ALLOW_UNSCANNED_UPLOADS=false

AUTH_RATE_LIMIT_MAX=30
UPLOAD_RATE_LIMIT_MAX=20
BACKUP_DIR=./backups
```

### 2) Frontend (`frontend/.env`)

Sao chep tu `frontend/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:4000/api
```

## Cai dat va chay local

### Cach nhanh (tu thu muc goc)

```bash
npm run install:all
npm run dev:backend
npm run dev:frontend
```

### Cach day du (kem khoi tao CSDL)

```bash
# 1) Cai dependencies
npm install --prefix backend
npm install --prefix frontend

# 2) Khoi tao Prisma
npm run prisma:generate --prefix backend
npm run prisma:deploy --prefix backend

# 3) Seed du lieu mau
npm run prisma:seed --prefix backend

# 4) Chay backend
npm run dev --prefix backend

# 5) Chay frontend (terminal khac)
npm run dev --prefix frontend
```

Dia chi mac dinh:

- Backend: `http://localhost:4000`
- Health check: `http://localhost:4000/health`
- Frontend: `http://localhost:5173`

## Tai khoan mau (seed)

Mat khau mac dinh: `123456`

- `admin@iuh.edu.vn` (`ADMIN`)
- `canbo1@iuh.edu.vn` (`CANBO`)
- `canbo2@iuh.edu.vn` (`CANBO`)
- `hoidong@iuh.edu.vn` (`HOIDONG`)
- `gv@iuh.edu.vn` (`GIANGVIEN`)
- `sv@iuh.edu.vn` (`SINHVIEN`)

## Scripts quan trong

Tu thu muc goc:

- `npm run install:all`: cai dependencies cho backend + frontend.
- `npm run dev:backend`: chay backend dev.
- `npm run dev:frontend`: chay frontend dev.
- `npm run build:frontend`: build frontend.

Tu `backend/`:

- `npm run dev`: chay API voi nodemon.
- `npm run start`: chay API production mode.
- `npm run test`: chay test Node built-in (`tests/**/*.test.js`).
- `npm run prisma:generate`: generate Prisma Client.
- `npm run prisma:deploy`: ap dung migrations.
- `npm run prisma:seed`: nap du lieu mau.
- `npm run backup`: backup PostgreSQL.

Tu `frontend/`:

- `npm run dev`: chay Vite dev server.
- `npm run build`: build production.
- `npm run preview`: preview ban build.
- `npm run lint`: lint frontend.

## API module hien co

Tat ca route backend nam duoi prefix `/api`:

- `/auth`
- `/users`
- `/criteria`
- `/nominations`
- `/reviews`
- `/awards`
- `/reports`
- `/system`
- `/departments`
- `/academic-years`
- `/notifications`
- `/approval-process`

## Bao mat va van hanh

- Dung rate-limit rieng cho dang nhap va upload file.
- Khong phuc vu truc tiep file upload cong khai.
- Co scheduler quet minh chung trong `backend/src/jobs/evidenceScan.job.js`.
- Khi production, can bat HTTPS, dung secret manh, backup CSDL dinh ky.

## Ghi chu trien khai

README nay da cap nhat theo he thong hien tai su dung PostgreSQL va bo migration trong `backend/prisma/migrations`.
Neu ban moi clone du an, uu tien dung `prisma:deploy` thay cho `prisma:migrate` de tranh tao migration moi khong can thiet.

## Deploy len EC2 bang Docker Compose

Du an da duoc bo sung bo file deploy production:

- `docker-compose.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `deploy/nginx/frontend.conf`
- `deploy/scripts/deploy.sh`
- `docs/DEPLOY_EC2.md`

Huong dan chi tiet tai: `docs/DEPLOY_EC2.md`.
