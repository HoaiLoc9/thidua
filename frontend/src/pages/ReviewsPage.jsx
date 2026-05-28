import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const levelLabels = {
  DONVI: "Cấp đơn vị",
  KHOA: "Cấp khoa",
  TRUONG: "Cấp trường",
};

export default function ReviewsPage() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [criteriaByLevel, setCriteriaByLevel] = useState({});
  const [commentById, setCommentById] = useState({});
  const [overdue, setOverdue] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [reassignByStepId, setReassignByStepId] = useState({});
  const [loadingReminder, setLoadingReminder] = useState(false);
  const [loadingReassignStepId, setLoadingReassignStepId] = useState(null);
  const [error, setError] = useState("");

  const load = () => api.get("/reviews/pending").then((res) => setPending(res.data));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!["ADMIN", "CANBO"].includes(user?.role)) return;
    api.get("/reviews/overdue")
      .then((res) => setOverdue(res.data))
      .catch((err) => console.error("Lỗi tải danh sách phiên duyệt quá hạn:", err));
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    api.get("/users")
      .then((res) => {
        const list = (res.data || []).filter((u) => ["ADMIN", "CANBO", "HOIDONG"].includes(u.role));
        setReviewers(list);
      })
      .catch((err) => console.error("Lỗi tải danh sách người duyệt:", err));
  }, [user?.role]);

  useEffect(() => {
    async function loadCriteriaByLevel() {
      const levels = ["DONVI", "KHOA", "TRUONG"];
      const entries = await Promise.all(
        levels.map(async (level) => {
          const { data } = await api.get(`/criteria?reviewLevel=${level}`);
          return [level, data];
        })
      );
      setCriteriaByLevel(Object.fromEntries(entries));
    }

    loadCriteriaByLevel().catch((err) => console.error("Lỗi tải tiêu chí xét duyệt:", err));
  }, []);

  const decision = async (id, value) => {
    const comment = (commentById[id] || "").trim();

    if (value === "REJECTED" && !comment) {
      setError("Vui lòng nhập lý do trước khi từ chối hồ sơ.");
      return;
    }

    setError("");
    const { data } = await api.post(`/reviews/${id}/decision`, {
      decision: value,
      comment,
    });
    if (data.emailDelivery?.sent) {
      alert(`Đã gửi email thông báo đến ${data.emailDelivery.to}`);
    } else {
      alert(`Đã xử lý hồ sơ, nhưng chưa gửi được email: ${data.emailDelivery?.reason || "không rõ lý do"}`);
    }
    load();
  };

  const sendOverdueReminders = async () => {
    try {
      setLoadingReminder(true);
      const { data } = await api.post("/reviews/send-overdue-reminders");
      alert(`Đã gửi nhắc việc cho ${data.reminded} phiên duyệt quá hạn.`);
      const overdueRes = await api.get("/reviews/overdue");
      setOverdue(overdueRes.data);
    } catch (err) {
      alert(err.response?.data?.message || "Không gửi được nhắc việc.");
    } finally {
      setLoadingReminder(false);
    }
  };

  const reassignReview = async (stepId) => {
    const nextReviewerId = Number(reassignByStepId[stepId]);
    if (!nextReviewerId) {
      alert("Vui lòng chọn người duyệt mới.");
      return;
    }
    try {
      setLoadingReassignStepId(stepId);
      await api.post(`/reviews/${stepId}/reassign`, { reviewerId: nextReviewerId });
      await load();
      if (["ADMIN", "CANBO"].includes(user?.role)) {
        const overdueRes = await api.get("/reviews/overdue");
        setOverdue(overdueRes.data);
      }
      alert("Đã phân công lại người duyệt.");
    } catch (err) {
      alert(err.response?.data?.message || "Không thể phân công lại.");
    } finally {
      setLoadingReassignStepId(null);
    }
  };

  const buildEvidenceEntries = (nomination) => {
    return (nomination.evidences || []).filter((ev) => ev.fileUrl).map((ev) => ({
      id: ev.id,
      url: ev.fileUrl,
    }));
  };

  const buildStudentReviewConditions = (nomination) => {
    const evidenceEntries = buildEvidenceEntries(nomination);
    const items = nomination.items || [];
    const missingEvidenceItems = items.filter((item) => !item.evidence?.trim());
    const hasEnoughEvidenceFiles = items.length > 0 && evidenceEntries.length >= items.length;
    const evidencePerCriteriaPassed = items.length > 0 && (missingEvidenceItems.length === 0 || hasEnoughEvidenceFiles);

    return [
      {
        label: "Người nộp là sinh viên",
        passed: nomination.applicant?.role === "SINHVIEN",
      },
      {
        label: "Hồ sơ có ít nhất một tiêu chí thành tích",
        passed: items.length > 0,
      },
      {
        label: "Tất cả tiêu chí trong hồ sơ đang được kích hoạt",
        passed: items.every((item) => item.criteria?.isActive !== false),
      },
      {
        label: "Hồ sơ có ít nhất một minh chứng kèm theo",
        passed: evidenceEntries.length > 0,
      },
      {
        label: "Mỗi tiêu chí thành tích có minh chứng riêng",
        passed: evidencePerCriteriaPassed,
        detail: missingEvidenceItems.map((item) => item.criteria?.code || `CRITERIA_${item.criteriaId}`),
      },
      {
        label: "Năm xét thi đua hợp lệ",
        passed: Number.isInteger(nomination.periodYear) && nomination.periodYear >= 2020,
      },
      {
        label: "Tên hồ sơ rõ ràng",
        passed: Boolean(nomination.title && nomination.title.trim().length >= 3),
      },
    ];
  };

  const canApproveStudentNomination = (nomination) => {
    if (nomination.applicant?.role !== "SINHVIEN") return true;
    return buildStudentReviewConditions(nomination).every((condition) => condition.passed);
  };

  return (
    <div className="card">
      <h2>Danh sách hồ sơ chờ duyệt</h2>
      {["ADMIN", "CANBO"].includes(user?.role) ? (
        <div style={{ marginBottom: 12 }}>
          <button type="button" onClick={sendOverdueReminders} disabled={loadingReminder}>
            {loadingReminder ? "Đang gửi..." : "Gửi nhắc việc quá hạn"}
          </button>
          <p style={{ marginTop: 8 }}>Phiên duyệt quá hạn: {overdue.length}</p>
        </div>
      ) : null}
      {error ? <div className="error-message">{error}</div> : null}
      {["ADMIN", "CANBO"].includes(user?.role) && overdue.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <strong>Danh sách quá hạn:</strong>
          <ul>
            {overdue.slice(0, 10).map((item) => (
              <li key={item.id}>
                [{levelLabels[item.level] || item.level}] {item.nomination?.title} - {item.reviewer?.fullName} - Hạn: {new Date(item.dueAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {pending.length === 0 ? <p>Không có hồ sơ chờ duyệt.</p> : null}
      {pending.map((step) => (
        <div className="review-card" key={step.id}>
          <h3>
            {step.nomination.title} - {levelLabels[step.level] || step.level}
          </h3>
          <p>
            Người nộp: {step.nomination.applicant.fullName} | Tổng điểm: {step.nomination.totalSelfPoint}
          </p>

          {step.nomination.applicant?.role === "SINHVIEN" ? (
            <div className="review-conditions">
              <strong>Điều kiện duyệt hồ sơ sinh viên:</strong>
              <ul>
                {buildStudentReviewConditions(step.nomination).map((condition) => (
                  <li
                    key={condition.label}
                    className={condition.passed ? "condition-passed" : "condition-failed"}
                  >
                    {condition.passed ? "Đạt" : "Chưa đạt"} - {condition.label}
                    {condition.detail?.length ? ` (${condition.detail.join(", ")})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <strong>Tiêu chí cần kiểm tra ở {levelLabels[step.level] || step.level}:</strong>
            {criteriaByLevel[step.level]?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Tiêu chí</th>
                    <th>Điều kiện</th>
                  </tr>
                </thead>
                <tbody>
                  {criteriaByLevel[step.level].map((criterion) => (
                    <tr key={criterion.id}>
                      <td>{criterion.code}</td>
                      <td>{criterion.title}</td>
                      <td>{criterion.description || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Chưa cấu hình tiêu chí cho cấp này.</p>
            )}
          </div>

          <div>
            <strong>Tiêu chí trong hồ sơ:</strong>
            {step.nomination.items?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Tiêu chí</th>
                    <th>Minh chứng</th>
                  </tr>
                </thead>
                <tbody>
                  {step.nomination.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.criteria?.code || "-"}</td>
                      <td>{item.criteria?.title || "-"}</td>
                      <td>{item.evidence ? "Có" : "Chưa có"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Chưa có tiêu chí.</p>
            )}
          </div>

          <div>
            <strong>Minh chứng:</strong>
            {buildEvidenceEntries(step.nomination).length ? (
              <ul>
                {buildEvidenceEntries(step.nomination).map((entry, idx) => (
                  <li key={`${step.id}-${idx}`}>
                    <a href={`http://localhost:4000/api/nominations/evidences/${entry.id}/download`} target="_blank" rel="noreferrer">
                      Tệp minh chứng #{idx + 1}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Chưa có minh chứng.</p>
            )}
          </div>

          <textarea
            placeholder="Nhận xét / lý do từ chối"
            value={commentById[step.id] || ""}
            onChange={(e) => setCommentById({ ...commentById, [step.id]: e.target.value })}
          />
          <div className="action-row">
            <button
              onClick={() => decision(step.id, "APPROVED")}
              disabled={!canApproveStudentNomination(step.nomination)}
              title={
                canApproveStudentNomination(step.nomination)
                  ? undefined
                  : "Hồ sơ sinh viên chưa đạt đủ điều kiện duyệt"
              }
            >
              Duyệt
            </button>
            <button
              className="danger"
              onClick={() => decision(step.id, "REJECTED")}
              title="Bắt buộc nhập lý do trước khi từ chối"
            >
              Từ chối
            </button>
            {user?.role === "ADMIN" ? (
              <>
                <select
                  value={reassignByStepId[step.id] || ""}
                  onChange={(e) => setReassignByStepId((prev) => ({ ...prev, [step.id]: e.target.value }))}
                >
                  <option value="">Chọn người duyệt mới</option>
                  {reviewers.map((reviewer) => (
                    <option key={reviewer.id} value={reviewer.id}>
                      {reviewer.fullName} ({reviewer.role})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => reassignReview(step.id)}
                  disabled={loadingReassignStepId === step.id}
                >
                  {loadingReassignStepId === step.id ? "Đang đổi..." : "Phân công lại"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
