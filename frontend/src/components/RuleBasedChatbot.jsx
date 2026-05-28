import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const statusText = {
  DRAFT: "Nháp: hồ sơ mới lưu, chưa gửi duyệt.",
  SUBMITTED: "Đã nộp: hồ sơ đang trong quy trình xét duyệt.",
  APPROVED: "Đã duyệt: hồ sơ đã được công nhận.",
  REJECTED: "Từ chối: hồ sơ chưa đạt, cần xem nhận xét và bổ sung.",
};

const roleLabel = {
  SINHVIEN: "sinh viên",
  GIANGVIEN: "giảng viên",
  CANBO: "cán bộ",
  HOIDONG: "hội đồng",
  ADMIN: "quản trị viên",
};

const pageLabels = {
  "/": "bảng điều khiển",
  "/profile": "thông tin cá nhân",
  "/criteria": "tiêu chí",
  "/awards": "danh hiệu",
  "/nominations": "hồ sơ",
  "/notifications": "thông báo",
  "/reviews": "xét duyệt",
  "/reports": "báo cáo",
  "/settings": "quản trị hệ thống",
  "/users": "người dùng",
};

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getReviewProgress(nomination) {
  const reviews = nomination.reviews || [];
  if (nomination.status === "DRAFT") return "Chưa nộp duyệt";
  if (nomination.status === "APPROVED") return "Đã hoàn tất xét duyệt";
  if (nomination.status === "REJECTED") return "Đã bị từ chối";

  const pending = reviews.find((review) => review.decision === "PENDING");
  if (!pending) return "Đang chờ cập nhật kết quả";

  const levelLabel = {
    DONVI: "cấp đơn vị",
    KHOA: "cấp khoa",
    TRUONG: "cấp trường",
  };

  return `Đang chờ ${levelLabel[pending.level] || pending.level} duyệt`;
}

function getPageContext(pathname) {
  if (pathname.startsWith("/nominations")) return "hồ sơ";
  if (pathname.startsWith("/criteria")) return "tiêu chí";
  if (pathname.startsWith("/reviews")) return "xét duyệt";
  if (pathname.startsWith("/reports")) return "báo cáo";
  if (pathname.startsWith("/users")) return "người dùng";
  if (pathname.startsWith("/settings")) return "quản trị hệ thống";
  return pageLabels[pathname] || "hệ thống";
}

export default function RuleBasedChatbot() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: "Xin chào, mình là Trợ lý thi đua. Mình có thể hướng dẫn nộp hồ sơ, giải thích trạng thái, kiểm tra minh chứng và hỗ trợ theo vai trò của bạn.",
    },
  ]);

  const userRole = user?.role || "SINHVIEN";
  const currentPage = getPageContext(location.pathname);
  const canReview = ["CANBO", "HOIDONG", "ADMIN"].includes(userRole);

  const quickActions = useMemo(() => {
    const base = ["Nộp hồ sơ thế nào?", "Upload file nào được phép?", "Điểm được tính thế nào?"];

    if (location.pathname.startsWith("/nominations")) {
      return userRole === "SINHVIEN"
        ? ["Tạo hồ sơ mới", "Hồ sơ bị từ chối thì làm gì?", "Hồ sơ của tôi", ...base]
        : ["Hồ sơ chờ duyệt", "Quy trình duyệt hồ sơ", "Cách kiểm tra minh chứng", ...base];
    }

    if (location.pathname.startsWith("/criteria")) {
      return ["Tạo tiêu chí lớn", "Chia ý nhỏ thế nào?", "Quy tắc tổng điểm", "Ai được sửa tiêu chí?"];
    }

    if (location.pathname.startsWith("/reviews")) {
      return ["Hồ sơ chờ duyệt", "Khi nào được từ chối?", "Chấm điểm cấp trường", "Chờ cấp trước duyệt là gì?"];
    }

    if (location.pathname.startsWith("/settings") || location.pathname.startsWith("/users")) {
      return ["Phân quyền actor", "Quản lý người dùng", "Audit log dùng để làm gì?", "Quét lại file chờ"];
    }

    return canReview ? ["Hồ sơ chờ duyệt", "Quy trình duyệt hồ sơ", ...base] : ["Hồ sơ của tôi", ...base];
  }, [canReview, location.pathname, userRole]);

  const addMessage = (message) => {
    setMessages((prev) => [...prev, message]);
  };

  const resetConversation = () => {
    setMessages([
      {
        from: "bot",
        text: `Mình đã làm mới hội thoại. Bạn đang ở trang ${currentPage}; mình sẽ ưu tiên trả lời theo vai trò ${roleLabel[userRole] || userRole}.`,
      },
    ]);
  };

  const getMyNominationsAnswer = async () => {
    const { data } = await api.get("/nominations");
    if (!data.length) {
      return [
        "Bạn chưa có hồ sơ nào.",
        "Các bước nên làm:",
        "1. Vào mục Hồ sơ.",
        "2. Nhập tên hồ sơ và năm xét duyệt.",
        "3. Chọn tiêu chí phù hợp.",
        "4. Upload minh chứng hợp lệ.",
        "5. Lưu hồ sơ, kiểm tra lại rồi bấm Nộp duyệt.",
      ].join("\n");
    }

    return data
      .slice(0, 5)
      .map((item, index) => {
        const status = statusText[item.status] || item.status;
        const progress = getReviewProgress(item);
        return `${index + 1}. ${item.title}\n- Trạng thái: ${status}\n- Tiến trình: ${progress}`;
      })
      .join("\n\n");
  };

  const getPendingReviewsAnswer = async () => {
    const { data } = await api.get("/reviews/pending");
    if (!data.length) {
      return "Hiện không có hồ sơ nào đang chờ bạn duyệt.";
    }

    return data
      .slice(0, 5)
      .map((step, index) => `${index + 1}. ${step.nomination.title}\n- Cấp duyệt: ${step.level}\n- Người nộp: ${step.nomination.applicant.fullName}`)
      .join("\n\n");
  };

  const buildAnswer = async (question) => {
    const q = normalizeText(question);

    if (q.includes("ho so cua toi") || q.includes("tra cuu") || q.includes("trang thai ho so")) {
      return canReview ? getPendingReviewsAnswer() : getMyNominationsAnswer();
    }

    if (q.includes("ho so cho duyet") || q.includes("cho duyet")) {
      if (!canReview) {
        return "Chức năng xem hồ sơ chờ duyệt chỉ dành cho cán bộ, hội đồng hoặc quản trị viên.";
      }
      return getPendingReviewsAnswer();
    }

    if (q.includes("nop ho so") || q.includes("tao ho so") || q.includes("huong dan")) {
      return [
        "Cách nộp hồ sơ:",
        "1. Vào mục Hồ sơ.",
        "2. Tạo hồ sơ mới và nhập thông tin bắt buộc.",
        "3. Chọn tiêu chí/danh hiệu phù hợp.",
        "4. Upload minh chứng cho từng tiêu chí.",
        "5. Kiểm tra trạng thái file phải sạch hoặc hợp lệ.",
        "6. Bấm Nộp duyệt để chuyển sang quy trình xét duyệt.",
      ].join("\n");
    }

    if (q.includes("file") || q.includes("minh chung") || q.includes("upload") || q.includes("tep")) {
      return [
        "Quy định upload minh chứng:",
        "1. Nên dùng các file: PDF, DOCX, XLSX, PNG, JPG, JPEG hoặc ZIP.",
        "2. Không upload file thực thi như EXE, BAT, CMD, JS lạ.",
        "3. Mỗi tiêu chí nên có minh chứng riêng để người duyệt dễ kiểm tra.",
        "4. Hệ thống sẽ kiểm tra định dạng và quét mã độc bằng ClamAV.",
        "5. Nếu file bị báo lỗi quét, hãy thử lại sau hoặc liên hệ quản trị viên.",
      ].join("\n");
    }

    if (q.includes("diem") || q.includes("tinh diem") || q.includes("tong diem") || q.includes("y nho")) {
      return [
        "Cách hệ thống tính điểm:",
        "1. Mỗi tiêu chí lớn có điểm tối đa.",
        "2. Tiêu chí lớn có thể được chia thành nhiều ý nhỏ.",
        "3. Hội đồng nhập điểm cho từng ý nhỏ.",
        "4. Hệ thống cộng điểm ý nhỏ thành điểm tiêu chí lớn.",
        "5. Tổng điểm hồ sơ là tổng điểm các tiêu chí được chấm.",
        "6. Điểm ý nhỏ không được vượt quá mức tối đa đã cấu hình.",
      ].join("\n");
    }

    if (q.includes("trang thai") || q.includes("draft") || q.includes("submitted") || q.includes("approved") || q.includes("rejected")) {
      return ["Ý nghĩa trạng thái hồ sơ:", statusText.DRAFT, statusText.SUBMITTED, statusText.APPROVED, statusText.REJECTED].join("\n");
    }

    if (q.includes("tu choi") || q.includes("bi tu choi") || q.includes("rejected")) {
      return [
        "Nếu hồ sơ bị từ chối:",
        "1. Mở mục Hồ sơ để xem trạng thái và lý do từ chối.",
        "2. Đọc nhận xét của người duyệt.",
        "3. Bổ sung hoặc thay minh chứng chưa phù hợp.",
        "4. Kiểm tra lại tiêu chí, điểm và file upload.",
        "5. Nộp lại hồ sơ nếu hệ thống cho phép mở lại/quy trình yêu cầu bổ sung.",
      ].join("\n");
    }

    if (q.includes("cho cap truoc") || q.includes("cap truoc") || q.includes("vuot tuyen")) {
      return "Chờ cấp trước duyệt nghĩa là quy trình đang duyệt tuần tự. Cấp khoa chỉ xử lý sau khi cấp đơn vị đã duyệt; cấp trường chỉ xử lý sau khi cấp khoa đã duyệt.";
    }

    if (q.includes("tieu chi") || q.includes("y nho")) {
      if (!["ADMIN", "HOIDONG"].includes(userRole)) {
        return "Tiêu chí do admin hoặc hội đồng cấu hình. Sinh viên chỉ cần chọn tiêu chí phù hợp và upload minh chứng tương ứng.";
      }
      return [
        "Gợi ý quản lý tiêu chí:",
        "1. Tạo tiêu chí lớn với tên rõ ràng và điểm tối đa.",
        "2. Chia thành các ý nhỏ có điểm riêng nếu tiêu chí cần chấm chi tiết.",
        "3. Tổng điểm ý nhỏ không nên vượt quá điểm tối đa của tiêu chí lớn.",
        "4. Tạm ẩn tiêu chí không còn dùng thay vì xóa nếu đã phát sinh hồ sơ.",
      ].join("\n");
    }

    if (canReview && (q.includes("duyet") || q.includes("hoi dong") || q.includes("can bo"))) {
      return [
        "Cách duyệt hồ sơ:",
        "1. Vào mục Xét duyệt.",
        "2. Mở hồ sơ được phân công.",
        "3. Kiểm tra thông tin, tiêu chí và minh chứng.",
        "4. Nếu đạt, bấm Duyệt để chuyển cấp tiếp theo.",
        "5. Nếu chưa đạt, nhập lý do rõ ràng rồi bấm Từ chối.",
        "6. Với hội đồng, nhập điểm từng ý nhỏ trước khi duyệt cuối.",
      ].join("\n");
    }

    if (q.includes("audit") || q.includes("nhat ky")) {
      return "Audit log dùng để ghi lại thao tác quan trọng như tạo hồ sơ, duyệt, từ chối, phân công lại, upload/tải minh chứng và thay đổi tiêu chí. Đây là phần giúp hệ thống minh bạch và dễ truy vết.";
    }

    if (q.includes("phan quyen") || q.includes("actor") || q.includes("vai tro")) {
      return "Hệ thống có các actor chính: sinh viên/giảng viên tạo hồ sơ; cán bộ duyệt cấp đơn vị/khoa; hội đồng chấm điểm và duyệt cấp trường; admin quản lý người dùng, tiêu chí, phân công và vận hành hệ thống.";
    }

    return [
      `Mình chưa hiểu rõ câu hỏi. Bạn đang ở trang ${currentPage}, vai trò ${roleLabel[userRole] || userRole}.`,
      "Bạn có thể hỏi về: nộp hồ sơ, trạng thái hồ sơ, upload minh chứng, cách tính điểm, hồ sơ bị từ chối, quy trình duyệt hoặc phân quyền actor.",
    ].join("\n");
  };

  const submitQuestion = async (question) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    addMessage({ from: "user", text: trimmed });
    setInput("");
    setLoading(true);

    try {
      const answer = await buildAnswer(trimmed);
      addMessage({ from: "bot", text: answer });
    } catch (error) {
      addMessage({
        from: "bot",
        text: `Mình chưa tra cứu được dữ liệu lúc này: ${error.response?.data?.message || error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot-widget">
      {open ? (
        <section className="chatbot-panel" aria-label="Trợ lý hệ thống thi đua">
          <div className="chatbot-header">
            <div>
              <strong>Trợ lý thi đua</strong>
              <span>
                {roleLabel[userRole] || userRole} · Trang {currentPage}
              </span>
            </div>
            <div className="chatbot-header-actions">
              <button type="button" className="chatbot-clear" onClick={resetConversation}>
                Xóa
              </button>
              <button type="button" className="chatbot-close" onClick={() => setOpen(false)} aria-label="Đóng trợ lý">
                ×
              </button>
            </div>
          </div>

          <div className="chatbot-messages">
            {messages.map((message, index) => (
              <div key={`${message.from}-${index}`} className={`chatbot-message ${message.from}`}>
                {message.text}
              </div>
            ))}
            {loading ? <div className="chatbot-message bot">Đang trả lời...</div> : null}
          </div>

          <div className="chatbot-quick-actions">
            {quickActions.map((action) => (
              <button key={action} type="button" onClick={() => submitQuestion(action)}>
                {action}
              </button>
            ))}
          </div>

          <form
            className="chatbot-input-row"
            onSubmit={(event) => {
              event.preventDefault();
              submitQuestion(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Nhập câu hỏi..."
            />
            <button type="submit" disabled={loading}>
              Gửi
            </button>
          </form>
        </section>
      ) : null}

      <button type="button" className="chatbot-toggle" onClick={() => setOpen((value) => !value)}>
        Trợ lý
      </button>
    </div>
  );
}
