import { useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user, updateCurrentUser } = useAuth();
  const [fullName, setFullName] = useState(user.fullName || "");
  const [department, setDepartment] = useState(user.department || "");
  const [message, setMessage] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    await updateCurrentUser({ fullName, department });
    setMessage("Cập nhật thông tin thành công.");
  };

  return (
    <div className="card">
      <h2>Cập nhật thông tin cá nhân</h2>
      <form className="page-grid" onSubmit={onSubmit}>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Họ tên" required />
        <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Đơn vị" />
        <button type="submit">Lưu thay đổi</button>
      </form>
      {message ? <p>{message}</p> : null}
    </div>
  );
}
