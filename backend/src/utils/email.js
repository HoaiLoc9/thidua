const nodemailer = require("nodemailer");

function isMailEnabled() {
  return Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);
}

function createTransporter() {
  if (!isMailEnabled()) return null;

  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_SECURE === "true",
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function levelLabel(level) {
  switch (level) {
    case "KHOA":
      return "cấp khoa";
    case "TRUONG":
      return "cấp trường";
    default:
      return level || "cấp xét duyệt";
  }
}

function buildLayout({ heading, subheading, bodyHtml, footerNote }) {
  return `
    <div style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              <tr>
                <td style="padding:18px 24px;background:#0f172a;color:#ffffff;">
                  <div style="font-size:18px;font-weight:700;line-height:1.4;">${heading}</div>
                  <div style="font-size:13px;opacity:.9;">${subheading}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:24px;">
                  ${bodyHtml}
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:12px;color:#64748b;">
                  Trân trọng,<br/>
                  <strong>Hệ thống Thi đua IUH</strong>
                  ${footerNote ? `<div style="margin-top:8px;">${footerNote}</div>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildReviewDecisionEmail({ nomination, student, decision, level, comment }) {
  const approved = decision === "APPROVED";
  const subject = approved
    ? "Thông báo kết quả xét duyệt hồ sơ thi đua"
    : "Thông báo hồ sơ thi đua cần bổ sung/chỉnh sửa";
  const statusText = approved ? "Được duyệt" : "Từ chối";
  const nextStepText = approved
    ? level === "TRUONG"
      ? "Hồ sơ đã hoàn tất xét duyệt và được hội đồng công nhận."
      : "Hồ sơ sẽ được chuyển sang cấp xét duyệt tiếp theo."
    : "Vui lòng đăng nhập hệ thống để xem nhận xét chi tiết và cập nhật hồ sơ.";
  const safeStudentName = escapeHtml(student.fullName);
  const safeTitle = escapeHtml(nomination.title);
  const safeComment = escapeHtml(comment?.trim());

  const text = [
    `Kính gửi ${student.fullName},`,
    "",
    "Hệ thống Thi đua IUH trân trọng thông báo kết quả xử lý hồ sơ:",
    `- Tên hồ sơ: ${nomination.title}`,
    `- Kết quả: ${statusText}`,
    `- Cấp xử lý: ${levelLabel(level)}`,
    "",
    comment?.trim() ? `Nhận xét: ${comment.trim()}` : null,
    nextStepText,
  ].filter(Boolean).join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;">Kính gửi <strong>${safeStudentName}</strong>,</p>
    <p style="margin:0 0 16px;line-height:1.7;">Hệ thống trân trọng thông báo kết quả xử lý hồ sơ thi đua của bạn.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;">
      <tr><td style="padding:14px 16px;font-size:14px;line-height:1.7;">
        <div><strong>Tên hồ sơ:</strong> ${safeTitle}</div>
        <div><strong>Kết quả:</strong> ${statusText}</div>
        <div><strong>Cấp xử lý:</strong> ${levelLabel(level)}</div>
      </td></tr>
    </table>
    ${safeComment
      ? `<div style="margin-top:14px;padding:12px 14px;border-left:4px solid #94a3b8;background:#f8fafc;">
           <div style="font-size:13px;color:#475569;margin-bottom:6px;"><strong>Nhận xét</strong></div>
           <div style="font-size:14px;line-height:1.6;">${safeComment}</div>
         </div>`
      : ""}
    <p style="margin:16px 0 0;line-height:1.7;">${nextStepText}</p>
  `;

  const html = buildLayout({
    heading: "HỆ THỐNG THI ĐUA IUH",
    subheading: "Thông báo kết quả xét duyệt hồ sơ",
    bodyHtml,
  });

  return { subject, text, html };
}

function buildPasswordResetOtpEmail({ fullName, otp, expiresInMinutes }) {
  const subject = "Mã OTP đặt lại mật khẩu - Hệ thống Thi đua IUH";
  const displayName = fullName || "Quý người dùng";
  const safeDisplayName = escapeHtml(displayName);
  const text = [
    `Kính gửi ${displayName},`,
    "",
    "Chúng tôi đã nhận được yêu cầu đặt lại hoặc đổi mật khẩu cho tài khoản của bạn.",
    `Mã OTP của bạn là: ${otp}`,
    `Mã này có hiệu lực trong ${expiresInMinutes} phút và chỉ được sử dụng một lần.`,
    "",
    "Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.",
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;">Kính gửi <strong>${safeDisplayName}</strong>,</p>
    <p style="margin:0 0 16px;line-height:1.7;">
      Chúng tôi đã nhận được yêu cầu đặt lại hoặc đổi mật khẩu cho tài khoản của bạn.
      Vui lòng sử dụng mã OTP dưới đây để xác thực yêu cầu.
    </p>
    <div style="margin:20px 0;padding:18px 20px;text-align:center;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;">
      <div style="font-size:13px;color:#64748b;margin-bottom:8px;">Mã OTP xác thực</div>
      <div style="font-size:32px;letter-spacing:8px;font-weight:800;color:#0f172a;">${otp}</div>
    </div>
    <p style="margin:0;line-height:1.7;">
      Mã này có hiệu lực trong <strong>${expiresInMinutes} phút</strong> và chỉ được sử dụng một lần.
    </p>
    <p style="margin:16px 0 0;line-height:1.7;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
  `;

  const html = buildLayout({
    heading: "HỆ THỐNG THI ĐUA IUH",
    subheading: "Xác thực OTP",
    bodyHtml,
    footerNote: "Không chia sẻ mã OTP cho bất kỳ ai. Đây là email tự động, vui lòng không phản hồi trực tiếp.",
  });

  return { subject, text, html };
}

async function sendMail({ to, subject, text, html }) {
  const transporter = createTransporter();
  if (!transporter) {
    return { sent: false, to, reason: "Chưa cấu hình email" };
  }

  if (!to) {
    return { sent: false, to, reason: "Thiếu địa chỉ email người nhận" };
  }

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    subject,
    text,
    html,
  });

  return {
    sent: (info.accepted || []).includes(to),
    to,
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  };
}

async function sendPasswordResetEmail({ email, fullName, resetUrl }) {
  const text = [
    `Kính gửi ${fullName || "Quý người dùng"},`,
    "",
    "Vui lòng sử dụng chức năng OTP trong hệ thống để đặt lại mật khẩu.",
    resetUrl || "",
  ].filter(Boolean).join("\n");

  return sendMail({
    to: email,
    subject: "Yêu cầu đặt lại mật khẩu - Hệ thống Thi đua IUH",
    text,
    html: buildLayout({
      heading: "HỆ THỐNG THI ĐUA IUH",
      subheading: "Yêu cầu đặt lại mật khẩu",
      bodyHtml: `<p style="line-height:1.7;">Vui lòng sử dụng chức năng OTP trong hệ thống để đặt lại mật khẩu.</p>`,
    }),
  });
}

async function sendPasswordResetOtpEmail({ email, fullName, otp, expiresInMinutes }) {
  const emailPayload = buildPasswordResetOtpEmail({ fullName, otp, expiresInMinutes });
  return sendMail({
    to: email,
    ...emailPayload,
  });
}

async function sendReviewDecisionEmail(payload) {
  const email = buildReviewDecisionEmail(payload);
  return sendMail({
    to: payload.student.email,
    ...email,
  });
}

module.exports = {
  sendReviewDecisionEmail,
  sendPasswordResetEmail,
  sendPasswordResetOtpEmail,
};
