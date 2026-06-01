import { useState } from "react";
import api from "../api/client";

const initialForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  otp: "",
};

export default function ChangePasswordPage() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const sendOtp = async () => {
    setMessage("");
    setError("");
    setSendingOtp(true);

    try {
      const { data } = await api.post("/auth/change-password/otp");
      setOtpSent(true);
      setMessage(data.message || "Mã OTP đã được gửi về email của bạn.");
    } catch (err) {
      setError(err.response?.data?.message || "Không gửi được mã OTP.");
    } finally {
      setSendingOtp(false);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (form.newPassword !== form.confirmPassword) {
      setError("Mật khẩu mới và xác nhận mật khẩu không khớp.");
      return;
    }

    if (!/^\d{6}$/.test(form.otp.trim())) {
      setError("Vui lòng nhập mã OTP gồm 6 chữ số.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.put("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        otp: form.otp.trim(),
      });
      setForm(initialForm);
      setOtpSent(false);
      setMessage(data.message || "Đổi mật khẩu thành công.");
    } catch (err) {
      setError(err.response?.data?.message || "Không đổi được mật khẩu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Đổi mật khẩu</h2>
      <p className="muted-text">
        Để bảo vệ tài khoản, hệ thống sẽ gửi mã OTP về email của bạn trước khi đổi mật khẩu.
      </p>

      <div className="form-actions" style={{ marginBottom: 16 }}>
        <button type="button" className="secondary" onClick={sendOtp} disabled={sendingOtp}>
          {sendingOtp ? "Đang gửi OTP..." : otpSent ? "Gửi lại mã OTP" : "Gửi mã OTP"}
        </button>
      </div>

      <form className="page-grid" onSubmit={onSubmit}>
        <input
          type="password"
          value={form.currentPassword}
          onChange={(e) => updateField("currentPassword", e.target.value)}
          placeholder="Mật khẩu hiện tại"
          minLength="6"
          required
        />
        <input
          inputMode="numeric"
          maxLength="6"
          value={form.otp}
          onChange={(e) => updateField("otp", e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="Mã OTP gồm 6 chữ số"
          required
        />
        <input
          type="password"
          value={form.newPassword}
          onChange={(e) => updateField("newPassword", e.target.value)}
          placeholder="Mật khẩu mới"
          minLength="6"
          required
        />
        <input
          type="password"
          value={form.confirmPassword}
          onChange={(e) => updateField("confirmPassword", e.target.value)}
          placeholder="Nhập lại mật khẩu mới"
          minLength="6"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Đang lưu..." : "Lưu mật khẩu"}
        </button>
      </form>

      {message ? <p className="success-message">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
