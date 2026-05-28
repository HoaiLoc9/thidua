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

function levelLabel(level) {
  switch (level) {
    case "DONVI":
      return "cấp đơn vị";
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
    ? (level === "TRUONG"
      ? "Hồ sơ đã hoàn tất xét duyệt và được công nhận."
      : "Hồ sơ sẽ được chuyển sang cấp xét duyệt tiếp theo.")
    : "Vui lòng đăng nhập hệ thống để xem nhận xét chi tiết và cập nhật hồ sơ.";

  const text = [
    `Kính gửi ${student.fullName},`,
    "",
    "Hệ thống Thi đua IUH trân trọng thông báo kết quả xử lý hồ sơ:",
    `- Tên hồ sơ: ${nomination.title}`,
    `- Kết quả: ${statusText}`,
    `- Cấp xử lý: ${levelLabel(level)}`,
    "",
    comment?.trim() ? `Nhận xét của cán bộ: ${comment.trim()}` : null,
    nextStepText,
  ].filter(Boolean).join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;">Kính gửi <strong>${student.fullName}</strong>,</p>
    <p style="margin:0 0 16px;line-height:1.7;">Hệ thống trân trọng thông báo kết quả xử lý hồ sơ thi đua của bạn.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;">
      <tr><td style="padding:14px 16px;font-size:14px;line-height:1.7;">
        <div><strong>Tên hồ sơ:</strong> ${nomination.title}</div>
        <div><strong>Kết quả:</strong> ${statusText}</div>
        <div><strong>Cấp xử lý:</strong> ${levelLabel(level)}</div>
      </td></tr>
    </table>
    ${comment?.trim()
      ? `<div style="margin-top:14px;padding:12px 14px;border-left:4px solid #94a3b8;background:#f8fafc;">
           <div style="font-size:13px;color:#475569;margin-bottom:6px;"><strong>Nhận xét của cán bộ</strong></div>
           <div style="font-size:14px;line-height:1.6;">${comment.trim()}</div>
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

function buildPasswordResetEmail({ fullName, resetUrl }) {
  const subject = "Yêu cầu đặt lại mật khẩu - Hệ thống Thi đua IUH";
  const text = [
    `Kính gửi ${fullName || "Quý người dùng"},`,
    "",
    "Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.",
    "Vui lòng truy cập liên kết dưới đây để tạo mật khẩu mới:",
    resetUrl,
    "",
    "Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.",
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;">Kính gửi <strong>${fullName || "Quý người dùng"}</strong>,</p>
    <p style="margin:0 0 16px;line-height:1.7;">
      Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
      Vui lòng nhấn nút bên dưới để tiếp tục.
    </p>
    <p style="margin:20px 0;">
      <a href="${resetUrl}" style="display:inline-block;padding:11px 18px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
        Đặt lại mật khẩu
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Nếu nút không hoạt động, vui lòng sao chép liên kết sau:</p>
    <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${resetUrl}" style="color:#1d4ed8;">${resetUrl}</a></p>
    <p style="margin:16px 0 0;line-height:1.7;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
  `;

  const html = buildLayout({
    heading: "HỆ THỐNG THI ĐUA IUH",
    subheading: "Xác thực yêu cầu đặt lại mật khẩu",
    bodyHtml,
    footerNote: "Đây là email tự động, vui lòng không phản hồi trực tiếp vào thư này.",
  });

  return { subject, text, html };
}

async function sendMail({ to, subject, text, html }) {
  const transporter = createTransporter();
  if (!transporter) {
    return { sent: false, to, reason: "MAIL config is missing" };
  }

  if (!to) {
    return { sent: false, to, reason: "Recipient email is missing" };
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
  const emailPayload = buildPasswordResetEmail({ fullName, resetUrl });
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
};
