# 📋 TÓMALEXANDER CHỈ CHỈNH SỬA

## ✅ HOÀN TẤT

### 1️⃣ BACKEND - API Lọc Tiêu Chí

**File sửa:**
- `backend/prisma/schema.prisma` - Thêm field `target` và `isTest` vào model Criteria
- `backend/src/routes/criteria.routes.js` - Cập nhật GET /api/criteria

**Tính năng:**
✓ Lọc chỉ lấy tiêu chí cho **Sinh viên** (target: "SINHVIEN")
✓ Loại bỏ dữ liệu **test/rác** (isTest: false, code không chứa "POSTMAN")
✓ Trả về fields gọn nhẹ: `id, code, title, description, maxPoint`

**Query Prisma:**
```javascript
await prisma.criteria.findMany({
  where: {
    isActive: true,
    isTest: false,
    target: "SINHVIEN",
    code: { not: { contains: "POSTMAN" } },
  },
  select: {
    id: true, code: true, title: true,
    description: true, maxPoint: true,
  },
  orderBy: { id: "asc" },
});
```

---

### 2️⃣ FRONTEND - Component CriteriaScoreForm

**File tạo:**
- `frontend/src/components/CriteriaScoreForm.jsx` - Component form điểm
- `frontend/src/styles/CriteriaScoreForm.css` - CSS gọn lại, responsive
- `frontend/src/pages/NominationsPage.jsx` - Cập nhật sử dụng component mới
- `frontend/src/styles/NominationsPage.css` - CSS support thêm

**Tính năng:**

#### 2.1 Input Điểm với Validation
```javascript
✓ Type: number
✓ Validate không âm (< 0 → 0)
✓ Validate không vượt max của tiêu chí
✓ Real-time update
```

#### 2.2 Tính Tổng Điểm Real-time
```javascript
const totalScore = useMemo(() => {
  return Object.values(scores).reduce(
    (sum, score) => sum + (Number(score) || 0), 0
  );
}, [scores]);
```

#### 2.3 Upload File Custom UI
```
❌ Ẩn input[type="file"] mặc định (display: none)
✓ Button "📎 Chọn file" đẹp
✓ Hiển thị tên file bên cạnh
✓ Nút "✕" để xóa file đã chọn
✓ Accept: .pdf, .doc, .docx, .jpg, .jpeg, .png, .txt
```

**CSS highlights:**
- Bảng tiêu chí gọn: 3 cột (Tiêu chí | Điểm | Minh chứng)
- Responsive (mobile-friendly)
- Tổng điểm hiển thị rõ: xanh da trời, font lớn
- File button: xanh dương, hover sáng hơn
- File selected: nền xanh nhạt, hiển thị tên file

---

### 3️⃣ Cách Sử Dụng

**Trong NominationsPage:**
```javascript
import CriteriaScoreForm from "../components/CriteriaScoreForm";

<CriteriaScoreForm 
  onScoreChange={handleScoreChange}  // Nhận {scores, totalScore, files}
  loading={loading}
/>

// Handler
const handleScoreChange = (data) => {
  setScoreData(data);
};

const handleSubmitNomination = async (data) => {
  // Upload files từ data.files[criteriaId]
  // Create nomination với items từ data.scores
};
```

---

### 4️⃣ File Tạo/Sửa

**Tạo mới:**
- `frontend/src/components/CriteriaScoreForm.jsx` (250 lines)
- `frontend/src/styles/CriteriaScoreForm.css` (220 lines)
- `frontend/src/styles/NominationsPage.css` (130 lines)
- `backend/API_CONTROLLER_QUERY_EXAMPLE.md`
- `frontend/src/components/COMPONENT_DOCUMENTATION.md`

**Sửa:**
- `backend/prisma/schema.prisma` - Thêm 2 field vào Criteria
- `backend/src/routes/criteria.routes.js` - Cập nhật GET endpoint
- `frontend/src/pages/NominationsPage.jsx` - Sử dụng component mới

---

### 5️⃣ Database Migration

Chạy:
```bash
cd backend
npx prisma db push
```

✓ Thêm cột `target` (String, default "SINHVIEN") vào bảng criteria
✓ Thêm cột `isTest` (Boolean, default false) vào bảng criteria

---

### 6️⃣ Tính Năng Backend Thêm

**Endpoint mới:** `POST /nominations/upload-evidence`
- Upload file evidence cho từng tiêu chí
- Return: `{ fileUrl: "/uploads/evidences/..." }`

---

## 🎯 SUMMARY

### Backend:
- ✓ API lọc tiêu chí: chỉ SINHVIEN, loại rác
- ✓ Fields gọn: id, code, title, description, maxPoint
- ✓ Schema + Migration

### Frontend:
- ✓ Component form điểm
- ✓ Input validate: không âm, không vượt max
- ✓ Tính tổng real-time (useMemo)
- ✓ Upload file custom UI: button + tên file + nút xóa
- ✓ CSS responsive, tươi sáng
- ✓ NominationsPage tích hợp

### Developer Experience:
- ✓ Component tái sử dụng
- ✓ Documentation chi tiết
- ✓ Clean code, dễ bảo trì
