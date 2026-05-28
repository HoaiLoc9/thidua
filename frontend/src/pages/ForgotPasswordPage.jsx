import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import logo from "../../public/logo.png";
import "../styles/LoginPage.css";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMessage(
        data.message ||
          "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn khôi phục mật khẩu. Vui lòng kiểm tra hộp thư của bạn."
      );
    } catch (err) {
      setError(err.response?.data?.message || "Không thể gửi yêu cầu quên mật khẩu.");
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
            <h1>Quên mật khẩu</h1>
            <p>Nhập email tài khoản để nhận liên kết đặt lại mật khẩu.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label" htmlFor="email">
                Email hoặc mã người dùng
              </label>
              <div className="input-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 6.5C4 5.11929 5.11929 4 6.5 4H17.5C18.8807 4 20 5.11929 20 6.5V17.5C20 18.8807 18.8807 20 17.5 20H6.5C5.11929 20 4 18.8807 4 17.5V6.5Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 7.75L12 13.5L20 7.75"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập email hoặc mã người dùng"
                  required
                />
              </div>
            </div>

            {error ? <p className="error-text">{error}</p> : null}
            {message ? <p className="success-text">{message}</p> : null}

            <button className="login-button" type="submit" disabled={loading}>
              {loading ? "Đang gửi..." : "GỬI YÊU CẦU"}
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
          <h2>Hãy giữ an toàn tài khoản của bạn</h2>
          <p>Chúng tôi sẽ giúp bạn đặt lại mật khẩu và quay lại hệ thống nhanh chóng.</p>
        </div>
        <div className="shape-circle one"></div>
        <div className="shape-circle two"></div>
        <div className="shape-circle three"></div>
      </div>
    </div>
  );
}
