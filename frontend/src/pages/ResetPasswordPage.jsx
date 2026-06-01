import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import logo from "../../public/logo.png";
import "../styles/LoginPage.css";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialEmail) {
      setError("Vui lòng nhập email và mã OTP đã được gửi đến hộp thư của bạn.");
    }
  }, [initialEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Vui lòng nhập email tài khoản.");
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Mã OTP phải gồm 6 chữ số.");
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
      await api.post("/auth/reset-password", { email: email.trim(), otp: otp.trim(), password });
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
            <p>Nhập email, mã OTP 6 số và mật khẩu mới để tiếp tục.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label" htmlFor="email">
                Email tài khoản
              </label>
              <div className="input-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6.5C4 5.11929 5.11929 4 6.5 4H17.5C18.8807 4 20 5.11929 20 6.5V17.5C20 18.8807 18.8807 20 17.5 20H6.5C5.11929 20 4 18.8807 4 17.5V6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 7.75L12 13.5L20 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập email tài khoản"
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="otp">
                Mã OTP
              </label>
              <div className="input-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3L20 7V12C20 16.5 16.5 20.2 12 21C7.5 20.2 4 16.5 4 12V7L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  id="otp"
                  inputMode="numeric"
                  maxLength="6"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Nhập mã OTP 6 số"
                  required
                />
              </div>
            </div>

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

            <button className="login-button" type="submit" disabled={loading}>
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
          <h2>Xác thực bằng OTP</h2>
          <p>Mã OTP chỉ có hiệu lực trong thời gian ngắn và chỉ được sử dụng một lần.</p>
        </div>
        <div className="shape-circle one"></div>
        <div className="shape-circle two"></div>
        <div className="shape-circle three"></div>
      </div>
    </div>
  );
}
