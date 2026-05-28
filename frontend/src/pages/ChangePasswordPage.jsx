import { useState } from "react";
import api from "../api/client";

const initialForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ChangePasswordPage() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (form.newPassword !== form.confirmPassword) {
      setError("Mat khau moi va xac nhan mat khau khong khop.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.put("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm(initialForm);
      setMessage(data.message || "Doi mat khau thanh cong.");
    } catch (err) {
      setError(err.response?.data?.message || "Khong doi duoc mat khau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Doi mat khau</h2>
      <form className="page-grid" onSubmit={onSubmit}>
        <input
          type="password"
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          placeholder="Mat khau hien tai"
          minLength="6"
          required
        />
        <input
          type="password"
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          placeholder="Mat khau moi"
          minLength="6"
          required
        />
        <input
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          placeholder="Nhap lai mat khau moi"
          minLength="6"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Dang luu..." : "Luu mat khau"}
        </button>
      </form>
      {message ? <p className="success-message">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
