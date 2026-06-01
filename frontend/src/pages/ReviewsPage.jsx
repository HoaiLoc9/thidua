import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { downloadEvidence } from "../utils/downloadEvidence";

const levelLabels = {
  KHOA: "Cấp khoa",
  TRUONG: "Cấp trường",
};

const voteLabels = {
  AGREE: "Đồng ý",
  DISAGREE: "Không đồng ý",
  REVIEW_AGAIN: "Đề nghị xem xét lại",
};

const adjustmentLabels = {
  KEEP: "Giữ nguyên điểm",
  ADJUST: "Điều chỉnh điểm",
  CANCEL: "Hủy điểm minh chứng",
};

export default function ReviewsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const reviewCardRefs = useRef({});
  const targetScrollKeyRef = useRef("");
  const [pending, setPending] = useState([]);
  const [criteriaByLevel, setCriteriaByLevel] = useState({});
  const [commentById, setCommentById] = useState({});
  const [evidenceScoresByStepId, setEvidenceScoresByStepId] = useState({});
  const [overdue, setOverdue] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [reassignByStepId, setReassignByStepId] = useState({});
  const [loadingReminder, setLoadingReminder] = useState(false);
  const [loadingReassignStepId, setLoadingReassignStepId] = useState(null);
  const [councilByNominationId, setCouncilByNominationId] = useState({});
  const [voteForms, setVoteForms] = useState({});
  const [savingVoteStepId, setSavingVoteStepId] = useState(null);
  const [adjustmentForms, setAdjustmentForms] = useState({});
  const [finalCommentByStepId, setFinalCommentByStepId] = useState({});
  const [rankings, setRankings] = useState([]);
  const [error, setError] = useState("");
  const [highlightedReviewId, setHighlightedReviewId] = useState(null);
  const [filters, setFilters] = useState({
    keyword: "",
    level: "ALL",
    awardTypeId: "ALL",
    readiness: "ALL",
    voteStatus: "ALL",
    evidenceScore: "ALL",
    scoreMin: "",
    scoreMax: "",
  });

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      keyword: "",
      level: "ALL",
      awardTypeId: "ALL",
      readiness: "ALL",
      voteStatus: "ALL",
      evidenceScore: "ALL",
      scoreMin: "",
      scoreMax: "",
    });
  };

  const loadCouncilForSteps = async (steps) => {
    if (!["ADMIN", "HOIDONG"].includes(user?.role)) return;
    const truongSteps = steps.filter((step) => step.level === "TRUONG");
    if (!truongSteps.length) return;

    const entries = await Promise.all(
      truongSteps.map(async (step) => {
        const { data } = await api.get(`/reviews/council/${step.nominationId}`);
        return [step.nominationId, data];
      })
    );
    setCouncilByNominationId((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  };

  const loadRankings = async () => {
    const { data } = await api.get("/reviews/rankings");
    setRankings(data);
  };

  const load = async () => {
    const res = await api.get("/reviews/pending");
    setPending(res.data);
    await loadCouncilForSteps(res.data);
    if (["ADMIN", "HOIDONG"].includes(user?.role)) {
      await loadRankings();
    }
  };

  useEffect(() => {
    load();
  }, [user?.role]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetReviewId = params.get("reviewId");
    const targetNominationId = params.get("nominationId");
    if (!targetReviewId && !targetNominationId) return;

    targetScrollKeyRef.current = "";
    setFilters((prev) => ({
      ...prev,
      keyword: "",
      level: "ALL",
      awardTypeId: "ALL",
      readiness: "ALL",
      voteStatus: "ALL",
      evidenceScore: "ALL",
      scoreMin: "",
      scoreMax: "",
    }));
  }, [location.search]);

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
      const levels = ["KHOA", "TRUONG"];
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

  const decision = async (step, value) => {
    const id = step.id;
    const comment = (commentById[id] || "").trim();

    if (value === "REJECTED" && !comment) {
      setError("Vui lòng nhập lý do trước khi từ chối hồ sơ.");
      return;
    }

    setError("");
    const evidenceScores = value === "APPROVED" && step.level === "KHOA"
      ? buildEvidenceScorePayload(step)
      : [];

    const { data } = await api.post(`/reviews/${id}/decision`, {
      decision: value,
      comment,
      ...(evidenceScores.length ? { evidenceScores } : {}),
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
      reviewPoint: ev.reviewPoint,
      criterionTitle: ev.awardCriterion?.title,
    }));
  };

  const openEvidence = async (entry, fallbackName = "minh-chung") => {
    try {
      await downloadEvidence(entry?.id, fallbackName);
    } catch (err) {
      alert("Không tải được file minh chứng: " + (err.response?.data?.message || err.message));
    }
  };

  const updateEvidenceScore = (stepId, evidenceId, value) => {
    setEvidenceScoresByStepId((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || {}),
        [evidenceId]: value,
      },
    }));
  };

  const getEvidenceScoreValue = (step, evidence) => {
    return evidenceScoresByStepId[step.id]?.[evidence.id] ?? evidence.reviewPoint ?? "";
  };

  const getEvidenceScoreTotal = (step) => {
    return buildEvidenceEntries(step.nomination).reduce((sum, evidence) => {
      const score = getEvidenceScoreValue(step, evidence);
      return sum + (score === "" || score === null || score === undefined ? 0 : Number(score));
    }, 0);
  };

  const buildEvidenceScorePayload = (step) => {
    if (step.level !== "KHOA") return [];
    return buildEvidenceEntries(step.nomination).map((evidence) => ({
      evidenceId: evidence.id,
      score: Number(getEvidenceScoreValue(step, evidence)),
    }));
  };

  const updateVoteForm = (nominationId, field, value) => {
    setVoteForms((prev) => ({
      ...prev,
      [nominationId]: {
        choice: "AGREE",
        comment: "",
        ...(prev[nominationId] || {}),
        [field]: value,
      },
    }));
  };

  const submitCouncilVote = async (step) => {
    try {
      setSavingVoteStepId(step.id);
      const form = voteForms[step.nominationId] || {};
      await api.post(`/reviews/${step.id}/council/vote`, {
        choice: form.choice || "AGREE",
        comment: form.comment || "",
      });
      await load();
      alert("Đã lưu phiếu biểu quyết thành công.");
    } catch (err) {
      alert(err.response?.data?.message || "Không lưu được phiếu biểu quyết.");
    } finally {
      setSavingVoteStepId(null);
    }
  };

  const updateAdjustmentForm = (evidenceId, field, value) => {
    setAdjustmentForms((prev) => ({
      ...prev,
      [evidenceId]: {
        action: "ADJUST",
        newPoint: "",
        reason: "",
        ...(prev[evidenceId] || {}),
        [field]: value,
      },
    }));
  };

  const submitScoreAdjustment = async (step, evidence) => {
    const form = adjustmentForms[evidence.id] || {};
    const action = form.action || "ADJUST";
    const payload = {
      evidenceId: evidence.id,
      action,
      reason: (form.reason || "").trim(),
    };

    if (action !== "KEEP" && !payload.reason) {
      alert("Vui lòng nhập lý do điều chỉnh điểm.");
      return;
    }

    if (action === "KEEP" && !payload.reason) {
      payload.reason = "Giữ nguyên điểm theo kết quả đã chấm.";
    }

    if (action === "ADJUST") {
      payload.newPoint = Number(form.newPoint);
      if (!Number.isInteger(payload.newPoint) || payload.newPoint < 0) {
        alert("Điểm mới phải là số nguyên không âm.");
        return;
      }
    }

    await api.post(`/reviews/${step.id}/council/adjust-evidence`, payload);
    setAdjustmentForms((prev) => ({ ...prev, [evidence.id]: { action: "ADJUST", newPoint: "", reason: "" } }));
    await load();
  };

  const finalizeCouncilReview = async (step, value) => {
    const comment = (finalCommentByStepId[step.id] || "").trim();
    try {
      const { data } = await api.post(`/reviews/${step.id}/council/finalize`, {
        decision: value,
        comment,
      });
      await load();
      if (data.emailDelivery?.sent) {
        alert(`\u0110\u00e3 ch\u1ed1t k\u1ebft qu\u1ea3 h\u1ed9i \u0111\u1ed3ng v\u00e0 g\u1eedi email th\u00f4ng b\u00e1o \u0111\u1ebfn ${data.emailDelivery.to}.`);
      } else {
        alert(`\u0110\u00e3 ch\u1ed1t k\u1ebft qu\u1ea3 h\u1ed9i \u0111\u1ed3ng, nh\u01b0ng ch\u01b0a g\u1eedi \u0111\u01b0\u1ee3c email: ${data.emailDelivery?.reason || "kh\u00f4ng r\u00f5 l\u00fd do"}.`);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Kh\u00f4ng ch\u1ed1t \u0111\u01b0\u1ee3c k\u1ebft qu\u1ea3 h\u1ed9i \u0111\u1ed3ng.");
    }
  };

  const formatRatio = (value) => `${Math.round(Number(value || 0) * 100)}%`;

  const canApproveWithEvidenceScores = (step) => {
    if (step.level !== "KHOA") return true;
    if (user?.email !== "canbo1@iuh.edu.vn") return false;
    const evidences = buildEvidenceEntries(step.nomination);
    if (!evidences.length) return false;
    return evidences.every((evidence) => {
      const score = getEvidenceScoreValue(step, evidence);
      return score !== undefined && score !== "" && Number(score) >= 0;
    });
  };

  const buildStudentReviewConditions = (nomination) => {
    const evidenceEntries = buildEvidenceEntries(nomination);
    const items = nomination.items || [];
    const awardCriteria = nomination.awardType?.criteria || [];
    const isAwardNomination = Boolean(nomination.awardTypeId || nomination.awardType);
    const missingEvidenceItems = items.filter((item) => !item.evidence?.trim());
    const missingAwardCriteria = awardCriteria.filter(
      (criterion) => !(nomination.evidences || []).some((evidence) => evidence.awardCriterionId === criterion.id)
    );
    const hasEnoughEvidenceFiles = items.length > 0 && evidenceEntries.length >= items.length;
    const evidencePerCriteriaPassed = isAwardNomination
      ? awardCriteria.length > 0 && missingAwardCriteria.length === 0
      : items.length > 0 && (missingEvidenceItems.length === 0 || hasEnoughEvidenceFiles);

    return [
      {
        label: "Người nộp là sinh viên",
        passed: nomination.applicant?.role === "SINHVIEN",
      },
      {
        label: "Hồ sơ có ít nhất một tiêu chí thành tích",
        passed: isAwardNomination ? awardCriteria.length > 0 : items.length > 0,
      },
      {
        label: "Tất cả tiêu chí trong hồ sơ đang được kích hoạt",
        passed: isAwardNomination ? nomination.awardType?.isActive !== false : items.every((item) => item.criteria?.isActive !== false),
      },
      {
        label: "Hồ sơ có ít nhất một minh chứng kèm theo",
        passed: evidenceEntries.length > 0,
      },
      {
        label: "Mỗi tiêu chí thành tích có minh chứng riêng",
        passed: evidencePerCriteriaPassed,
        detail: isAwardNomination
          ? missingAwardCriteria.map((criterion) => criterion.title)
          : missingEvidenceItems.map((item) => item.criteria?.code || `CRITERIA_${item.criteriaId}`),
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

  const awardFilterOptions = Array.from(
    new Map(
      pending
        .map((step) => step.nomination.awardType)
        .filter(Boolean)
        .map((award) => [award.id, award])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredPending = pending.filter((step) => {
    const nomination = step.nomination;
    const keyword = filters.keyword.trim().toLowerCase();
    const totalPoint = Number(nomination.totalSelfPoint || 0);
    const minPoint = filters.scoreMin === "" ? null : Number(filters.scoreMin);
    const maxPoint = filters.scoreMax === "" ? null : Number(filters.scoreMax);
    const council = councilByNominationId[step.nominationId];
    const voteSummary = council?.voteSummary;
    const evidences = buildEvidenceEntries(nomination);

    if (keyword) {
      const haystack = [
        nomination.title,
        nomination.applicant?.fullName,
        nomination.applicant?.email,
        nomination.awardType?.name,
        nomination.awardType?.code,
        nomination.periodYear,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }

    if (filters.level !== "ALL" && step.level !== filters.level) return false;
    if (filters.awardTypeId !== "ALL" && String(nomination.awardType?.id || "") !== filters.awardTypeId) return false;
    if (minPoint !== null && totalPoint < minPoint) return false;
    if (maxPoint !== null && totalPoint > maxPoint) return false;

    if (filters.readiness === "READY" && !canApproveStudentNomination(nomination)) return false;
    if (filters.readiness === "BLOCKED" && canApproveStudentNomination(nomination)) return false;

    if (filters.evidenceScore === "SCORED") {
      if (!evidences.length || evidences.some((evidence) => evidence.reviewPoint === null || evidence.reviewPoint === undefined)) {
        return false;
      }
    }
    if (filters.evidenceScore === "UNSCORED") {
      if (!evidences.length || evidences.every((evidence) => evidence.reviewPoint !== null && evidence.reviewPoint !== undefined)) {
        return false;
      }
    }

    if (filters.voteStatus !== "ALL") {
      if (step.level !== "TRUONG") return false;
      if (filters.voteStatus === "PASSED" && !voteSummary?.passed) return false;
      if (filters.voteStatus === "NEEDS_VOTES" && !voteSummary?.needsMoreVotes) return false;
      if (filters.voteStatus === "NOT_PASSED" && (voteSummary?.passed || voteSummary?.needsMoreVotes)) return false;
      if (filters.voteStatus === "TIE" && !voteSummary?.isTie) return false;
    }

    return true;
  });

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (["level", "awardTypeId", "readiness", "voteStatus", "evidenceScore"].includes(key)) {
      return value !== "ALL";
    }
    return String(value || "").trim() !== "";
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetReviewId = Number(params.get("reviewId"));
    const targetNominationId = Number(params.get("nominationId"));
    if (!targetReviewId && !targetNominationId) return;
    const targetKey = targetReviewId ? `review-${targetReviewId}` : `nomination-${targetNominationId}`;
    if (targetScrollKeyRef.current === targetKey) return;

    const targetStep = filteredPending.find((step) => {
      if (targetReviewId) return step.id === targetReviewId;
      return step.nominationId === targetNominationId;
    });

    if (!targetStep) return;

    const timer = window.setTimeout(() => {
      const element = reviewCardRefs.current[targetStep.id];
      if (!element) return;

      element.scrollIntoView({ behavior: "smooth", block: "start" });
      targetScrollKeyRef.current = targetKey;
      setHighlightedReviewId(targetStep.id);
      window.setTimeout(() => setHighlightedReviewId(null), 3500);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [filteredPending, location.search]);

  return (
    <div className="card">
      <h2>Danh sách hồ sơ chờ duyệt</h2>
      {user?.email === "canbo1@iuh.edu.vn" ? (
        <p style={{ marginTop: 0 }}>
          Bạn là cán bộ cấp khoa phụ trách kiểm tra thủ công từng file minh chứng và nhập điểm trước khi duyệt hồ sơ.
        </p>
      ) : null}
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
      <div className="review-filter-panel">
        <div className="review-filter-header">
          <div>
            <strong>Bộ lọc hồ sơ chờ duyệt</strong>
            <p>Đang hiển thị {filteredPending.length}/{pending.length} hồ sơ.</p>
          </div>
          <button type="button" className="secondary" onClick={clearFilters} disabled={!hasActiveFilters}>
            Xóa bộ lọc
          </button>
        </div>
        <div className="review-filter-grid">
          <label className="filter-field filter-wide">
            <span>Tìm kiếm</span>
            <input
              value={filters.keyword}
              onChange={(e) => updateFilter("keyword", e.target.value)}
              placeholder="Tên hồ sơ, người nộp, email, danh hiệu..."
            />
          </label>
          <label className="filter-field">
            <span>Cấp duyệt</span>
            <select value={filters.level} onChange={(e) => updateFilter("level", e.target.value)}>
              <option value="ALL">Tất cả</option>
              <option value="KHOA">Cấp khoa</option>
              <option value="TRUONG">Cấp trường</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Danh hiệu</span>
            <select value={filters.awardTypeId} onChange={(e) => updateFilter("awardTypeId", e.target.value)}>
              <option value="ALL">Tất cả danh hiệu</option>
              {awardFilterOptions.map((award) => (
                <option key={award.id} value={award.id}>
                  {award.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Điều kiện hồ sơ</span>
            <select value={filters.readiness} onChange={(e) => updateFilter("readiness", e.target.value)}>
              <option value="ALL">Tất cả</option>
              <option value="READY">Đủ điều kiện duyệt</option>
              <option value="BLOCKED">Chưa đủ điều kiện</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Điểm minh chứng</span>
            <select value={filters.evidenceScore} onChange={(e) => updateFilter("evidenceScore", e.target.value)}>
              <option value="ALL">Tất cả</option>
              <option value="SCORED">Đã chấm đủ</option>
              <option value="UNSCORED">Chưa chấm đủ</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Biểu quyết hội đồng</span>
            <select value={filters.voteStatus} onChange={(e) => updateFilter("voteStatus", e.target.value)}>
              <option value="ALL">Tất cả</option>
              <option value="PASSED">Đủ tỷ lệ thông qua</option>
              <option value="NEEDS_VOTES">Chưa đủ phiếu</option>
              <option value="NOT_PASSED">Chưa đạt tỷ lệ</option>
              <option value="TIE">Đang hòa phiếu</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Điểm từ</span>
            <input type="number" min="0" value={filters.scoreMin} onChange={(e) => updateFilter("scoreMin", e.target.value)} placeholder="0" />
          </label>
          <label className="filter-field">
            <span>Điểm đến</span>
            <input type="number" min="0" value={filters.scoreMax} onChange={(e) => updateFilter("scoreMax", e.target.value)} placeholder="100" />
          </label>
        </div>
      </div>

      {pending.length > 0 && filteredPending.length === 0 ? (
        <p className="empty-filter-state">Không có hồ sơ phù hợp với bộ lọc hiện tại.</p>
      ) : null}
      {filteredPending.map((step) => (
        <div
          className={`review-card ${highlightedReviewId === step.id ? "review-card-highlight" : ""}`}
          key={step.id}
          ref={(element) => {
            if (element) {
              reviewCardRefs.current[step.id] = element;
            } else {
              delete reviewCardRefs.current[step.id];
            }
          }}
        >
          <h3>
            {step.nomination.title} - {levelLabels[step.level] || step.level}
          </h3>
          <p>
            Người nộp: {step.nomination.applicant.fullName} | Tổng điểm: {step.nomination.totalSelfPoint}
          </p>
          {step.level === "KHOA" && user?.email !== "canbo1@iuh.edu.vn" ? (
            <div className="error-message">
              Chỉ tài khoản canbo1@iuh.edu.vn được chấm điểm và duyệt hồ sơ ở cấp khoa.
            </div>
          ) : null}

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
            <strong>{step.nomination.awardType ? "Danh hiệu và tiêu chí minh chứng:" : "Tiêu chí trong hồ sơ:"}</strong>
            {step.nomination.awardType ? (
              <table>
                <thead>
                  <tr>
                    <th>Danh hiệu</th>
                    <th>Tiêu chí xét</th>
                    <th>Điểm tối thiểu</th>
                  </tr>
                </thead>
                <tbody>
                  {(step.nomination.awardType.criteria || []).map((criterion) => (
                    <tr key={criterion.id}>
                      <td>{step.nomination.awardType.name}</td>
                      <td>{criterion.title}</td>
                      <td>{criterion.minPoint ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : step.nomination.items?.length ? (
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
            {step.level === "KHOA" ? (
              <div className="evidence-score-summary">
                <span>Chi tiết minh chứng và chấm điểm cấp khoa</span>
                <strong>Tổng điểm tạm tính: {getEvidenceScoreTotal(step)}</strong>
                <small>canbo1@iuh.edu.vn nhập điểm từng file. Hệ thống tự cộng thành tổng điểm hồ sơ khi duyệt.</small>
              </div>
            ) : null}
            {buildEvidenceEntries(step.nomination).length ? (
              <table>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Tiêu chí</th>
                    <th>Nhập điểm minh chứng</th>
                  </tr>
                </thead>
                <tbody>
                {buildEvidenceEntries(step.nomination).map((entry, idx) => (
                  <tr key={`${step.id}-${idx}`}>
                    <td>
                      <button type="button" className="text-action" onClick={() => openEvidence(entry, `minh-chung-${idx + 1}`)}>
                        Tệp minh chứng #{idx + 1}
                      </button>
                    </td>
                    <td>{entry.criterionTitle || "-"}</td>
                    <td>
                      {step.level === "KHOA" ? (
                        <label className="evidence-score-field">
                          <span>Điểm file #{idx + 1}</span>
                          <input
                            className="evidence-score-input"
                            type="number"
                            min="0"
                            value={getEvidenceScoreValue(step, entry)}
                            onChange={(e) => updateEvidenceScore(step.id, entry.id, e.target.value)}
                            placeholder="Nhập điểm"
                          />
                        </label>
                      ) : (
                        entry.reviewPoint ?? "-"
                      )}
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            ) : (
              <p>Chưa có minh chứng.</p>
            )}
          </div>

          {step.level === "TRUONG" ? (() => {
            const council = councilByNominationId[step.nominationId];
            const summary = council?.voteSummary;
            return (
              <div className="council-panel">
                <h4>Hội đồng thi đua khen thưởng</h4>
                {summary ? (
                  <div className="council-summary">
                    <span>Thành viên: <b>{summary.memberCount}</b></span>
                    <span>Đã bỏ phiếu: <b>{summary.votedCount}</b></span>
                    <span>Đồng ý: <b>{summary.agreeCount}</b> ({formatRatio(summary.agreeRatio)})</span>
                    <span>Ngưỡng thông qua: <b>{summary.passThreshold}</b> phiếu</span>
                    <span>{summary.isTie ? "Kết quả đang hòa" : summary.passed ? "Đủ điều kiện thông qua" : "Chưa đủ điều kiện thông qua"}</span>
                  </div>
                ) : <p>Đang tải dữ liệu hội đồng...</p>}

                {council?.members?.length ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Thành viên hội đồng</th>
                        <th>Phiếu</th>
                        <th>Nhận xét</th>
                      </tr>
                    </thead>
                    <tbody>
                      {council.members.map((member) => {
                        const vote = council.votes?.find((item) => item.voterId === member.id);
                        return (
                          <tr key={member.id}>
                            <td>{member.fullName}<br /><small>{member.email}</small></td>
                            <td>{vote ? voteLabels[vote.choice] : "Chưa bỏ phiếu"}</td>
                            <td>{vote?.comment || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : null}

                {user?.role === "HOIDONG" ? (
                  <div className="council-vote-form">
                    <select
                      value={voteForms[step.nominationId]?.choice || council?.currentUserVote?.choice || "AGREE"}
                      onChange={(e) => updateVoteForm(step.nominationId, "choice", e.target.value)}
                    >
                      <option value="AGREE">Đồng ý</option>
                      <option value="DISAGREE">Không đồng ý</option>
                      <option value="REVIEW_AGAIN">Đề nghị xem xét lại</option>
                    </select>
                    <input
                      value={voteForms[step.nominationId]?.comment ?? council?.currentUserVote?.comment ?? ""}
                      onChange={(e) => updateVoteForm(step.nominationId, "comment", e.target.value)}
                      placeholder="Nhận xét biểu quyết"
                    />
                    <button type="button" onClick={() => submitCouncilVote(step)} disabled={savingVoteStepId === step.id}>
                      {savingVoteStepId === step.id ? "\u0110ang l\u01b0u..." : "L\u01b0u phi\u1ebfu bi\u1ec3u quy\u1ebft"}
                    </button>
                  </div>
                ) : null}

                <div className="council-adjustment">
                  <strong>Điều chỉnh điểm minh chứng</strong>
                  <table>
                    <thead>
                      <tr>
                        <th>Minh chứng</th>
                        <th>Điểm hiện tại</th>
                        <th>Hành động</th>
                        <th>Điểm mới</th>
                        <th>Lý do</th>
                        <th>Lưu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildEvidenceEntries(step.nomination).map((entry, index) => {
                        const form = adjustmentForms[entry.id] || {};
                        return (
                          <tr key={entry.id}>
                            <td>
                              <button type="button" className="text-action" onClick={() => openEvidence(entry, `minh-chung-${index + 1}`)}>
                                Tệp #{index + 1}
                              </button>
                              <br /><small>{entry.criterionTitle || "-"}</small>
                            </td>
                            <td>{entry.reviewPoint ?? 0}</td>
                            <td>
                              <select value={form.action || "ADJUST"} onChange={(e) => updateAdjustmentForm(entry.id, "action", e.target.value)}>
                                <option value="KEEP">Giữ nguyên</option>
                                <option value="ADJUST">Điều chỉnh</option>
                                <option value="CANCEL">Hủy điểm</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={form.newPoint || ""}
                                onChange={(e) => updateAdjustmentForm(entry.id, "newPoint", e.target.value)}
                                disabled={(form.action || "ADJUST") !== "ADJUST"}
                              />
                            </td>
                            <td>
                              <input
                                value={form.reason || ""}
                                onChange={(e) => updateAdjustmentForm(entry.id, "reason", e.target.value)}
                                placeholder="Lý do (bắt buộc khi điều chỉnh/hủy)"
                              />
                            </td>
                            <td>
                              <button type="button" className="sm" onClick={() => submitScoreAdjustment(step, entry)}>
                                Lưu
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {council?.adjustments?.length ? (
                  <div>
                    <strong>Lịch sử chỉnh điểm</strong>
                    <ul>
                      {council.adjustments.map((item) => (
                        <li key={item.id}>
                          {adjustmentLabels[item.action]}: {item.oldPoint ?? 0} → {item.newPoint ?? 0}
                          {" "}bởi {item.adjustedBy?.fullName || "-"}; lý do: {item.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <textarea
                  placeholder="Nhận xét chốt kết quả hội đồng"
                  value={finalCommentByStepId[step.id] || ""}
                  onChange={(e) => setFinalCommentByStepId((prev) => ({ ...prev, [step.id]: e.target.value }))}
                />
                <div className="action-row">
                  <button type="button" disabled={!council?.canFinalize} onClick={() => finalizeCouncilReview(step, "APPROVED")}>
                    Chốt thông qua
                  </button>
                  <button type="button" className="danger" disabled={!council?.canFinalize} onClick={() => finalizeCouncilReview(step, "REJECTED")}>
                    Chốt từ chối
                  </button>
                  {!council?.canFinalize ? <small>Chỉ người được phân công phiên cấp trường hoặc admin được chốt kết quả.</small> : null}
                </div>
              </div>
            );
          })() : (
            <>
              <textarea
                placeholder="Nhận xét / lý do từ chối"
                value={commentById[step.id] || ""}
                onChange={(e) => setCommentById({ ...commentById, [step.id]: e.target.value })}
              />
              <div className="action-row">
                <button
                  onClick={() => decision(step, "APPROVED")}
                  disabled={!canApproveStudentNomination(step.nomination) || !canApproveWithEvidenceScores(step)}
                  title={
                    canApproveStudentNomination(step.nomination) && canApproveWithEvidenceScores(step)
                      ? undefined
                      : "Hồ sơ chưa đạt điều kiện hoặc cấp khoa chưa nhập điểm cho từng file minh chứng"
                  }
                >
                  Duyệt
                </button>
                <button
                  className="danger"
                  onClick={() => decision(step, "REJECTED")}
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
            </>
          )}
        </div>
      ))}
      {["ADMIN", "HOIDONG"].includes(user?.role) && rankings.length ? (
        <div className="review-card">
          <h3>Xếp hạng theo tổng điểm</h3>
          <table>
            <thead>
              <tr>
                <th>Hạng</th>
                <th>Hồ sơ</th>
                <th>Người nộp</th>
                <th>Danh hiệu</th>
                <th>Điểm</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {rankings.slice(0, 20).map((item) => (
                <tr key={item.id}>
                  <td>{item.rank}</td>
                  <td>{item.title}</td>
                  <td>{item.applicant?.fullName || "-"}</td>
                  <td>{item.awardType?.name || "-"}</td>
                  <td>{item.totalSelfPoint}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
