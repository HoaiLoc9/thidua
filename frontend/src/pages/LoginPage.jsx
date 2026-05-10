import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err) {
      if (!err.response) {
        setError("Không kết nối được backend. Hãy chạy backend ở cổng 4000.");
      } else {
        setError(err.response?.data?.message || "Đăng nhập thất bại");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Hệ thống thi đua IUH</h1>
        <p>Đăng nhập để quản lý và xét duyệt thi đua khen thưởng.</p>

        <label>Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="admin@iuh.edu.vn"
          required
        />

        <label>Mật khẩu</label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="******"
          required
        />

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={loading}>
          {loading ? "Đang xử lý..." : "Đăng nhập"}
        </button>

        <small>
          Tài khoản mẫu: admin@iuh.edu.vn, canbo1@iuh.edu.vn, hoidong@iuh.edu.vn, gv@iuh.edu.vn, sv@iuh.edu.vn - mật khẩu: 123456
        </small>
        <small>
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
        </small>
      </form>
    </div>
  );
}
