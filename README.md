# Hệ thống xét duyệt thi đua, danh hiệu và khen thưởng IUH

Hệ thống hỗ trợ số hóa quy trình đăng ký, chấm điểm, xét duyệt và tổng hợp hồ sơ thi đua trong môi trường trường đại học. Dự án được xây dựng theo mô hình tách biệt giữa backend API và frontend web app, có phân quyền theo vai trò, quản lý tiêu chí chấm điểm, duyệt hồ sơ nhiều cấp, gửi thông báo email và kiểm tra an toàn tệp minh chứng khi người dùng tải lên.

## 1. Tổng quan công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React, Vite, React Router, Axios, GSAP |
| Backend | Node.js, Express, Prisma ORM |
| Database | SQLite |
| Xác thực | JWT, bcrypt |
| Upload file | Multer, kiểm tra loại tệp, giới hạn dung lượng, quét ClamAV |
| Email | Nodemailer |
| Báo cáo | CSV, PDFKit, XLSX |

## 2. Cấu trúc thư mục

```text
thidua/
├── backend/              # API, Prisma schema, seed data, business logic
│   ├── prisma/           # Database schema, migration, seed
│   └── src/
│       ├── middlewares/  # Middleware xác thực, phân quyền
│       ├── routes/       # Các nhóm API chính
│       └── utils/        # Email, JWT, bảo mật file
├── frontend/             # Giao diện React/Vite
│   └── src/
│       ├── components/   # Component dùng chung
│       ├── context/      # Auth context
│       ├── pages/        # Các màn hình nghiệp vụ
│       └── styles/       # CSS theo từng màn hình
├── scripts/              # Script hỗ trợ báo cáo/tài liệu
├── report_assets/        # Tài nguyên phục vụ báo cáo
└── rendered_report/      # Kết quả render báo cáo
```

## 3. Vai trò người dùng

| Vai trò | Mô tả |
| --- | --- |
| `SINHVIEN` | Tạo hồ sơ thi đua, tải minh chứng, theo dõi kết quả xét duyệt. |
| `GIANGVIEN` | Tạo và quản lý hồ sơ liên quan đến giảng viên, theo dõi trạng thái duyệt. |
| `CANBO` | Xét duyệt hồ sơ ở cấp đơn vị/khoa/phòng ban theo phân quyền. |
| `HOIDONG` | Xét duyệt cấp trường, đưa ra quyết định cuối cùng. |
| `ADMIN` | Quản trị người dùng, tiêu chí, danh mục danh hiệu/khen thưởng và cấu hình hệ thống. |

## 4. Chức năng chính

- Đăng nhập bằng JWT và phân quyền theo vai trò.
- Quản lý thông tin cá nhân người dùng.
- Quản lý năm học, đơn vị, phòng ban và người dùng.
- Quản lý tiêu chí thi đua, tiêu chí con và điểm tối đa.
- Quản lý danh mục danh hiệu và hình thức khen thưởng.
- Tạo hồ sơ thi đua, chọn tiêu chí, nhập điểm, tải minh chứng.
- Kiểm tra an toàn file upload bằng danh sách đuôi file cho phép và ClamAV.
- Duyệt hồ sơ theo nhiều cấp: `Đơn vị -> Khoa -> Trường`.
- Ghi nhận nhận xét, lý do từ chối, lịch sử xử lý và nhật ký duyệt.
- Gửi email thông báo trạng thái hồ sơ và nhắc việc quá hạn.
- Dashboard thống kê, báo cáo tổng hợp và xuất dữ liệu.

## 5. Yêu cầu cài đặt

- Node.js 18 trở lên.
- npm.
- ClamAV nếu muốn bật chức năng quét mã độc khi upload file.
- Tài khoản SMTP nếu muốn gửi email thật.

## 6. Cấu hình môi trường

Tạo file `.env` trong thư mục `backend/`:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="thay_bang_chuoi_bi_mat_manh"
PORT=4000

# Email, có thể bỏ trống nếu chỉ chạy thử local
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your_email@example.com
MAIL_PASS=your_app_password
MAIL_FROM=your_email@example.com

# ClamAV, dùng khi đã bật clamd
CLAMAV_HOST=127.0.0.1
CLAMAV_PORT=3310
CLAMAV_TIMEOUT_MS=20000
```

Lưu ý: không commit file `.env` chứa mật khẩu, secret hoặc thông tin SMTP thật lên Git.

## 7. Cài đặt và chạy dự án

### 7.1. Cài đặt dependencies

Từ thư mục gốc dự án:

```bash
npm run install:all
```

Hoặc cài riêng từng phần:

```bash
npm install --prefix backend
npm install --prefix frontend
```

Trên Windows PowerShell, nếu gặp lỗi policy khi chạy `npm`, có thể dùng:

```bash
npm.cmd run install:all
```

### 7.2. Khởi tạo database

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 7.3. Chạy backend

```bash
npm run dev --prefix backend
```

Backend mặc định chạy tại:

```text
http://localhost:4000
```

### 7.4. Chạy frontend

```bash
npm run dev --prefix frontend
```

Frontend mặc định chạy tại:

```text
http://localhost:5173
```

## 8. Tài khoản mẫu

Mật khẩu mặc định cho dữ liệu seed:

```text
123456
```

| Email | Vai trò |
| --- | --- |
| `admin@iuh.edu.vn` | ADMIN |
| `canbo1@iuh.edu.vn` | CANBO |
| `canbo2@iuh.edu.vn` | CANBO |
| `hoidong@iuh.edu.vn` | HOIDONG |
| `gv@iuh.edu.vn` | GIANGVIEN |
| `sv@iuh.edu.vn` | SINHVIEN |

## 9. API tiêu biểu

| Nhóm API | Endpoint |
| --- | --- |
| Xác thực | `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/me` |
| Người dùng | `GET /api/users`, `POST /api/users`, `PUT /api/users/:id` |
| Tiêu chí | `GET /api/criteria`, `POST /api/criteria`, `PUT /api/criteria/:id`, `DELETE /api/criteria/:id` |
| Danh hiệu | `GET /api/awards`, `POST /api/awards`, `PUT /api/awards/:id`, `DELETE /api/awards/:id` |
| Hồ sơ | `GET /api/nominations`, `POST /api/nominations`, `PUT /api/nominations/:id` |
| Nộp hồ sơ | `POST /api/nominations/:id/submit` |
| Duyệt hồ sơ | `GET /api/reviews/pending`, `POST /api/reviews/:reviewId/decision` |
| Báo cáo | `GET /api/reports/summary`, `GET /api/reports/summary.csv` |
| Hệ thống | `GET /api/system/health`, `GET /api/system/security` |

## 10. Quy trình nghiệp vụ chính

1. Người dùng đăng nhập vào hệ thống theo vai trò được cấp.
2. Sinh viên hoặc giảng viên tạo hồ sơ thi đua.
3. Người tạo hồ sơ chọn tiêu chí, nhập điểm, bổ sung minh chứng và gửi xét duyệt.
4. Hệ thống kiểm tra thông tin hồ sơ, loại tệp, dung lượng và quét mã độc nếu ClamAV đang hoạt động.
5. Hồ sơ được chuyển qua các cấp duyệt tương ứng.
6. Cán bộ hoặc hội đồng xem hồ sơ, kiểm tra tiêu chí, nhập nhận xét và đưa ra quyết định.
7. Hệ thống cập nhật trạng thái, lưu lịch sử xử lý và gửi email thông báo.
8. Quản trị viên hoặc cán bộ có quyền xem thống kê, xuất báo cáo tổng hợp.

## 11. Bảo mật và kiểm soát upload

Hệ thống áp dụng các lớp kiểm soát cơ bản cho file upload:

- Chỉ cho phép các định dạng tài liệu/hình ảnh phù hợp với minh chứng.
- Giới hạn dung lượng file.
- Kiểm tra MIME type và phần mở rộng.
- Quét mã độc bằng ClamAV thông qua `clamd`.
- Từ chối file nếu phát hiện nguy cơ hoặc không thể xác minh an toàn theo cấu hình hiện tại.

Khuyến nghị khi triển khai thật:

- Dùng HTTPS.
- Đặt `JWT_SECRET` đủ mạnh.
- Lưu file upload ngoài thư mục public.
- Bật logging và audit trail cho thao tác quan trọng.
- Sao lưu database định kỳ.
- Dùng SMTP app password thay vì mật khẩu tài khoản chính.

## 12. Kiểm thử và build

Chạy test backend:

```bash
npm run test --prefix backend
```

Build frontend:

```bash
npm run build:frontend
```

Preview bản build frontend:

```bash
npm run preview --prefix frontend
```

## 13. Ghi chú triển khai

Dự án hiện phù hợp cho môi trường phát triển, demo khóa luận và kiểm thử nghiệp vụ nội bộ. Khi triển khai production, nên chuyển từ SQLite sang hệ quản trị cơ sở dữ liệu phù hợp hơn như PostgreSQL hoặc MySQL, cấu hình reverse proxy, HTTPS, backup tự động, giám sát log và chính sách phân quyền chi tiết theo đơn vị.
