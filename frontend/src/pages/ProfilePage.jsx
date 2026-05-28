import { useState } from "react";
import { useAuth } from "../context/AuthContext";

function toDateInputValue(value) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function ProfilePage() {
  const { user, updateCurrentUser } = useAuth();
  const [form, setForm] = useState({
    fullName: user.fullName || "",
    email: user.email || "",
    phone: user.phone || "",
    studentCode: user.studentCode || "",
    dateOfBirth: toDateInputValue(user.dateOfBirth),
    department: user.department || "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      await updateCurrentUser({
        fullName: form.fullName,
        phone: form.phone,
        studentCode: form.studentCode,
        dateOfBirth: form.dateOfBirth,
        department: form.department,
      });
      setMessage("Cập nhật thông tin thành công.");
    } catch (err) {
      setError(err.response?.data?.message || "Không cập nhật được thông tin.");
    }
  };

  return (
    <div className="card">
      <h2>Thông tin cá nhân</h2>
      <form className="form-grid" onSubmit={onSubmit}>
        <label className="field-group">
          <span>Họ và tên</span>
          <input
            value={form.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            placeholder="Họ và tên"
            required
          />
        </label>

        <label className="field-group">
          <span>Email</span>
          <input value={form.email} placeholder="Email" disabled />
          <small>Email dùng để đăng nhập nên không chỉnh sửa tại đây.</small>
        </label>

        <label className="field-group">
          <span>Số điện thoại</span>
          <input
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="Số điện thoại"
          />
        </label>

        <label className="field-group">
          <span>Mã số sinh viên</span>
          <input
            value={form.studentCode}
            onChange={(e) => updateField("studentCode", e.target.value)}
            placeholder="Mã số sinh viên"
          />
        </label>

        <label className="field-group">
          <span>Ngày tháng năm sinh</span>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => updateField("dateOfBirth", e.target.value)}
          />
        </label>

        <label className="field-group">
          <span>Khoa</span>
          <input
            value={form.department}
            onChange={(e) => updateField("department", e.target.value)}
            placeholder="Khoa"
          />
        </label>

        <div className="form-actions form-span-2">
          <button type="submit">Lưu thay đổi</button>
        </div>
      </form>
      {message ? <p className="success-message">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
