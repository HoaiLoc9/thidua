import { useEffect, useState } from "react";
import api from "../api/client";

const roleLabels = {
  ADMIN: "ADMIN - Quản trị hệ thống",
  CANBO: "CANBO - Cán bộ duyệt cấp đơn vị/khoa",
  HOIDONG: "HOIDONG - Hội đồng xét duyệt cấp trường",
  GIANGVIEN: "GIANGVIEN - Giảng viên tạo và theo dõi hồ sơ",
  SINHVIEN: "SINHVIEN - Sinh viên tạo và theo dõi hồ sơ",
};

const rolePermissions = [
  { role: "ADMIN", description: "Quản lý toàn hệ thống, người dùng, danh mục, quy trình, sao lưu." },
  { role: "CANBO", description: "Duyệt hồ sơ ở cấp đơn vị/khoa, xem báo cáo và danh sách chờ duyệt." },
  { role: "HOIDONG", description: "Phê duyệt ở cấp trường, xem báo cáo, quản lý danh hiệu/khen thưởng." },
  { role: "GIANGVIEN", description: "Tạo, sửa, nộp hồ sơ thi đua và theo dõi trạng thái của chính mình." },
  { role: "SINHVIEN", description: "Tạo, sửa, nộp hồ sơ thi đua và theo dõi trạng thái của chính mình." },
];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "SINHVIEN",
    department: "",
    departmentId: "",
  });
  const [message, setMessage] = useState("");

  const load = async () => {
    const [usersRes, depRes] = await Promise.all([api.get("/users"), api.get("/departments")]);
    setUsers(usersRes.data);
    setDepartments(depRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      fullName: "",
      email: "",
      password: "",
      role: "SINHVIEN",
      department: "",
      departmentId: "",
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    const payload = {
      fullName: form.fullName,
      role: form.role,
      department: form.department || null,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
    };

    if (!editingId) {
      payload.email = form.email;
      payload.password = form.password;
      await api.post("/users", payload);
      setMessage("Tạo người dùng thành công");
    } else {
      if (form.password) {
        payload.password = form.password;
      }
      await api.put(`/users/${editingId}`, payload);
      setMessage("Cập nhật người dùng thành công");
    }

    resetForm();
    await load();
  };

  // Auto-clear success/error messages after a few seconds
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(t);
  }, [message]);

  const onEdit = (user) => {
    setEditingId(user.id);
    setForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      role: user.role,
      department: user.department || "",
      departmentId: user.departmentId || "",
    });
    // bring the form into view and focus the first input for better UX
    setTimeout(() => {
      const formEl = document.querySelector(".page-grid > form.card");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth", block: "start" });
        const firstInput = formEl.querySelector("input, select, textarea");
        if (firstInput) firstInput.focus();
      }
    }, 50);
  };

  const onDelete = async (id) => {
    const ok = window.confirm("Bạn có chắc muốn xóa người dùng này?");
    if (!ok) {
      return;
    }
    await api.delete(`/users/${id}`);
    setMessage("Đã xóa người dùng");
    if (editingId === id) {
      resetForm();
    }
    await load();
  };

  return (
    <div className="page-grid">
      <form className="card" onSubmit={onSubmit}>
        <h2>{editingId ? "Cập nhật người dùng" : "Tạo người dùng mới"}</h2>
        {message ? (
          <div role="status" aria-live="polite" style={{ margin: "0.5rem 0", color: "#155724", background: "#d4edda", padding: "0.5rem", borderRadius: 6 }}>
            {message}
          </div>
        ) : null}
        <input
          placeholder="Họ tên"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required={!editingId}
          disabled={Boolean(editingId)}
        />
        <input
          type="password"
          placeholder={editingId ? "Mật khẩu mới (không bắt buộc)" : "Mật khẩu"}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required={!editingId}
        />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="ADMIN">{roleLabels.ADMIN}</option>
          <option value="CANBO">{roleLabels.CANBO}</option>
          <option value="HOIDONG">{roleLabels.HOIDONG}</option>
          <option value="GIANGVIEN">{roleLabels.GIANGVIEN}</option>
          <option value="SINHVIEN">{roleLabels.SINHVIEN}</option>
        </select>
        <select
          value={form.departmentId}
          onChange={(e) => {
            const value = e.target.value;
            const selected = departments.find((d) => d.id === Number(value));
            setForm({
              ...form,
              departmentId: value,
              department: selected ? selected.departmentName : "",
            });
          }}
        >
          <option value="">Chọn đơn vị (không bắt buộc)</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.departmentName}
            </option>
          ))}
        </select>
        <div className="action-row">
          <button type="submit">{editingId ? "Lưu thay đổi" : "Tạo mới"}</button>
          {editingId ? (
            <button type="button" onClick={resetForm}>
              Hủy chỉnh sửa
            </button>
          ) : null}
        </div>
        {message ? <p>{message}</p> : null}
      </form>

      <div className="card">
        <h2>Phân quyền theo vai trò</h2>
        <ul>
          {rolePermissions.map((item) => (
            <li key={item.role}>
              <strong>{roleLabels[item.role]}:</strong> {item.description}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Danh sách người dùng</h2>
        <table>
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Đơn vị</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.fullName}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.department || "-"}</td>
                <td>
                  <div className="action-row">
                    <button type="button" onClick={() => onEdit(user)}>Sửa</button>
                    <button type="button" onClick={() => onDelete(user.id)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
