import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import logo from "../../public/logo.png";
import "../styles/LoginPage.css";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Liên kết đặt lại mật khẩu không hợp lệ.");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Thiếu mã đặt lại mật khẩu.");
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/reset-password", { token, password });
      setMessage("Mật khẩu của bạn đã được đặt lại thành công.");
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể đặt lại mật khẩu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-card">
          <div className="login-brand">
            <img className="login-logo" src={logo} alt="Logo" />
            <h1>Đặt lại mật khẩu</h1>
            <p>Thiết lập mật khẩu mới để tiếp tục sử dụng tài khoản.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label" htmlFor="password">
                Mật khẩu mới
              </label>
              <div className="input-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 10V8C17 5.23858 14.7614 3 12 3C9.23858 3 7 5.23858 7 8V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="6" y="10" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 15V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="confirmPassword">
                Xác nhận mật khẩu
              </label>
              <div className="input-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 10V8C17 5.23858 14.7614 3 12 3C9.23858 3 7 5.23858 7 8V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="6" y="10" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 15V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Xác nhận mật khẩu mới"
                  required
                />
              </div>
            </div>

            {error ? <p className="error-text">{error}</p> : null}
            {message ? <p className="success-text">{message}</p> : null}

            <button className="login-button" type="submit" disabled={loading || !token}>
              {loading ? "Đang đặt lại..." : "ĐẶT LẠI MẬT KHẨU"}
            </button>

            <div className="login-note" style={{ marginTop: 18 }}>
              <Link to="/login" className="forgot-link">
                Quay lại đăng nhập
              </Link>
            </div>
          </form>
        </div>
      </div>

      <div className="welcome-panel">
        <div className="welcome-copy">
          <span>WELCOME!</span>
          <h2>Cập nhật mật khẩu mới</h2>
          <p>Hãy chọn mật khẩu an toàn để bảo vệ tài khoản và tiếp tục truy cập.</p>
        </div>
        <div className="shape-circle one"></div>
        <div className="shape-circle two"></div>
        <div className="shape-circle three"></div>
      </div>
    </div>
  );
}
