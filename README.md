# He thong xet duyet thi dua khen thuong IUH

Du an duoc tach ro 2 phan:
- backend: Node.js + Express + Prisma + SQLite
- frontend: React (Vite)

## 1) Cau truc du an

- backend/: API + database
- frontend/: giao dien React

## 2) Actor theo use case

- SINHVIEN
- GIANGVIEN
- CANBO (khoa/phong/ban)
- HOIDONG (thi dua cap truong)
- ADMIN (quan tri he thong)

## 3) Chuc nang chinh

- Dang nhap/JWT va phan quyen theo vai tro actor trong use case.
- Cap nhat thong tin ca nhan.
- Quan ly tieu chi thi dua.
- Quan ly danh muc danh hieu thi dua, hinh thuc khen thuong.
- Giang vien tao ho so thi dua, tu cham diem theo tieu chi, nop duyet.
- Sinh vien tao/quan ly ho so thi dua va theo doi ket qua.
- Quy trinh duyet 3 cap: `DONVI -> KHOA -> TRUONG`.
- Cap duyet co the phe duyet/tu choi kem nhan xet.
- Dashboard thong ke trang thai ho so.
- Bao cao tong hop va xuat CSV.

## 4) Cai dat va chay

Yeu cau: Node.js 18+.

### Buoc 1: Cai dependencies

```bash
npm run install:all
```

Hoac cai tung phan:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### Buoc 2: Khoi tao database

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### Buoc 3: Chay backend

```bash
cd backend
npm run dev
```

Backend mac dinh chay tai: `http://localhost:4000`

### Buoc 4: Chay frontend

```bash
cd frontend
npm run dev
```

Frontend mac dinh chay tai: `http://localhost:5173`

## 5) Tai khoan mau (seed)

Mat khau chung: `123456`

- admin@iuh.edu.vn (ADMIN)
- canbo1@iuh.edu.vn (CANBO)
- canbo2@iuh.edu.vn (CANBO)
- gv@iuh.edu.vn (GIANGVIEN)
- sv@iuh.edu.vn (SINHVIEN)
- hoidong@iuh.edu.vn (HOIDONG)

## 6) API chinh

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `PUT /api/auth/me`
- `GET/POST/PUT/DELETE /api/criteria`
- `GET/POST/PUT/DELETE /api/awards`
- `GET/POST/PUT /api/nominations`
- `POST /api/nominations/:id/submit`
- `GET /api/reviews/pending`
- `POST /api/reviews/:reviewId/decision`
- `GET /api/reviews/stats`
- `GET /api/users` (ADMIN)
- `GET /api/reports/summary`
- `GET /api/reports/summary.csv`

## 7) Ghi chu

Do hien tai minh chua doc truc tiep duoc file .docx trong workspace, phien ban nay duoc xay dung day du theo nghiep vu xet duyet thi dua pho bien. Ban gui tiep noi dung yeu cau chi tiet (muc bieu mau, quy tac diem, workflow dac thu) de minh mapping 1-1 theo tai lieu.
