import { useCallback, useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import CriteriaScoreForm from "../components/CriteriaScoreForm";
import "../styles/NominationsPage.css";

const ALLOWED_EVIDENCE_EXTENSIONS = ["pdf", "docx", "xlsx", "png", "jpg", "jpeg", "zip"];

function isAllowedEvidenceFile(file) {
  const extension = (file?.name?.split(".").pop() || "").toLowerCase();
  return ALLOWED_EVIDENCE_EXTENSIONS.includes(extension);
}

export default function NominationsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [nominations, setNominations] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [selectedFileNames, setSelectedFileNames] = useState({});
  const fileInputRefs = useRef({});
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [decidingReviewId, setDecidingReviewId] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [openRejectReviewId, setOpenRejectReviewId] = useState(null);
  const [rejectReasonByReviewId, setRejectReasonByReviewId] = useState({});
  const [scoreModal, setScoreModal] = useState({ open: false, reviewId: null, nomination: null });
  const [scoreModalScores, setScoreModalScores] = useState({});
  const [scoreModalSubScores, setScoreModalSubScores] = useState({});
  const [scoreModalComment, setScoreModalComment] = useState("");

  const canCreate = ["GIANGVIEN", "SINHVIEN"].includes(user.role);
  const canReview = ["CANBO", "HOIDONG", "ADMIN"].includes(user.role);
  const canEditScores = user.role !== "SINHVIEN";
  const showCreateScores = user.role !== "SINHVIEN";
  const levelRank = { DONVI: 1, KHOA: 2, TRUONG: 3 };

  const load = async () => {
    try {
      const { data } = await api.get("/nominations");
      setNominations(data);
    } catch (err) {
      console.error("Error loading nominations:", err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleScoreChange = useCallback((data) => {
    setScoreData(data);
  }, []);

  const handleSubmitNomination = async (data) => {
    if (!title.trim()) {
      alert("Vui lòng nhập tên hồ sơ");
      return;
    }

    setLoading(true);
    try {
      // Build items array
      const items = Object.entries(data.scores).map(([criteriaId, score]) => ({
        criteriaId: Number(criteriaId),
        selfPoint: canEditScores ? Number(score) : 0,
        evidence: "",
      }));

      // Upload file evidence nếu có
      for (let i = 0; i < items.length; i++) {
        const criteriaId = items[i].criteriaId;
        const file = data.files[criteriaId];
        if (file) {
          const formData = new FormData();
          formData.append("file", file);
          try {
            const res = await api.post("/nominations/upload-evidence", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            items[i].evidence = res.data.fileUrl || "";
          } catch (err) {
            console.error("Upload failed for criteria", criteriaId, err);
          }
        }
      }

      // Create nomination
      await api.post("/nominations", {
        title,
        periodYear: Number(year),
        items,
      });

      alert("Lưu hồ sơ thành công!");
      setTitle("");
      setYear(new Date().getFullYear());
      setScoreData(null);
      await load();
    } catch (err) {
      console.error("Error creating nomination:", err);
      alert("Lỗi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitNomination = async (id) => {
    try {
      await api.post(`/nominations/${id}/submit`);
      await load();
    } catch (err) {
      console.error("Error submitting nomination:", err);
      alert("Lỗi: " + err.message);
    }
  };

  const reopenNomination = async (id) => {
    try {
      await api.post(`/nominations/${id}/reopen`);
      await load();
    } catch (err) {
      console.error("Error reopening nomination:", err);
      alert("Lỗi mở lại hồ sơ: " + (err.response?.data?.message || err.message));
    }
  };

  const canReviewStepNow = (nomination, step) => {
    const priorSteps = (nomination.reviews || []).filter(
      (r) => (levelRank[r.level] || 0) < (levelRank[step.level] || 0)
    );
    return priorSteps.every((r) => r.decision === "APPROVED");
  };

  const reviewFromList = async (reviewId, decision, comment = "", scorePayload = null) => {
    try {
      setDecidingReviewId(reviewId);
      await api.post(`/reviews/${reviewId}/decision`, {
        decision,
        comment,
        ...(scorePayload || {}),
      });
      await load();
    } catch (err) {
      console.error("Error making decision:", err);
      const message = err.response?.data?.message || err.message;
      const failedConditions = err.response?.data?.conditions;

      if (Array.isArray(failedConditions) && failedConditions.length) {
        const conditionText = failedConditions
          .map((condition, index) => {
            const detailText = condition.detail?.length ? ` (${condition.detail.join(", ")})` : "";
            return `${index + 1}. ${condition.label}${detailText}`;
          })
          .join("\n");
        alert(`Lỗi duyệt hồ sơ: ${message}\n\nĐiều kiện chưa đạt:\n${conditionText}`);
      } else {
        alert("Lỗi duyệt hồ sơ: " + message);
      }
    } finally {
      setDecidingReviewId(null);
    }
  };

  const openScoreModal = (reviewId, nomination) => {
    const initialScores = {};
    const initialSubScores = {};
    (nomination.items || []).forEach((item) => {
      initialScores[item.id] = "";
      (item.criteria?.subItems || []).forEach((subItem) => {
        initialSubScores[`${item.id}_${subItem.id}`] = "";
      });
    });
    setScoreModalScores(initialScores);
    setScoreModalSubScores(initialSubScores);
    setScoreModalComment("");
    setScoreModal({ open: true, reviewId, nomination });
  };

  const closeScoreModal = () => {
    setScoreModal({ open: false, reviewId: null, nomination: null });
    setScoreModalScores({});
    setScoreModalSubScores({});
    setScoreModalComment("");
  };

  const confirmScoreModal = async () => {
    const nomination = scoreModal.nomination;
    if (!nomination) return;

    for (const item of nomination.items || []) {
      const score = scoreModalScores[item.id];
      if (score === "" || score === undefined || score === null) {
        alert("Vui lòng nhập điểm cho tất cả tiêu chí.");
        return;
      }
      const max = item.criteria?.maxPoint || 0;
      if (Number(score) < 0 || Number(score) > max) {
        alert(`Điểm không hợp lệ cho tiêu chí ${item.criteria?.code || item.id}.`);
        return;
      }
    }

    const scoresPayload = Object.keys(scoreModalScores).map((key) => ({
      nominationItemId: Number(key),
      score: Number(scoreModalScores[key]),
    }));

    await reviewFromList(scoreModal.reviewId, "APPROVED", scoreModalComment, scoresPayload);
    closeScoreModal();
  };

  const handleFileSelect = (nominationId, event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!isAllowedEvidenceFile(file)) {
        alert("Chỉ được tải lên file PDF, DOCX, XLSX, PNG/JPG hoặc ZIP.");
        event.target.value = "";
        return;
      }

      setSelectedFiles((prev) => ({ ...prev, [nominationId]: file }));
      setSelectedFileNames((prev) => ({ ...prev, [nominationId]: file.name }));
    }
  };

  const handleFileButtonClick = (nominationId) => {
    fileInputRefs.current[nominationId]?.click();
  };

  const uploadEvidence = async (nominationId) => {
    const file = selectedFiles[nominationId];
    if (!file) {
      alert("Vui lòng chọn file trước khi tải lên");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/nominations/${nominationId}/evidences`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Tải file thành công!");
      setSelectedFiles((prev) => ({ ...prev, [nominationId]: null }));
      setSelectedFileNames((prev) => ({ ...prev, [nominationId]: null }));
      await load();
    } catch (err) {
      console.error("Error uploading evidence:", err);
      alert("Lỗi tải file: " + (err.response?.data?.message || err.message));
    }
  };

  const handleClearFile = (nominationId) => {
    setSelectedFiles((prev) => ({ ...prev, [nominationId]: null }));
    setSelectedFileNames((prev) => ({ ...prev, [nominationId]: null }));
    if (fileInputRefs.current[nominationId]) {
      fileInputRefs.current[nominationId].value = "";
    }
  };

  const openRejectForm = (reviewId) => {
    setOpenRejectReviewId(reviewId);
  };

  const closeRejectForm = () => {
    setOpenRejectReviewId(null);
  };

  const confirmRejectFromList = async (reviewId) => {
    const reason = (rejectReasonByReviewId[reviewId] || "").trim();

    if (!reason) {
      alert("Vui lòng nhập lý do trước khi từ chối hồ sơ.");
      return;
    }

    await reviewFromList(reviewId, "REJECTED", reason);
    setOpenRejectReviewId(null);
    setRejectReasonByReviewId((prev) => ({ ...prev, [reviewId]: "" }));
  };

  const params = new URLSearchParams(location.search);
  const statusFilter = params.get("status");
  const titleFilter = params.get("title") || "";
  const normalizedTitleFilter = titleFilter.trim().toLowerCase();
  const reviewerVisibleStatuses = ["SUBMITTED", "REJECTED", "APPROVED"];

  const statusLabel = (s) => {
    switch (s) {
      case "DRAFT":
        return "Nháp";
      case "SUBMITTED":
        return "Chờ duyệt";
      case "APPROVED":
        return "Đã duyệt";
      case "REJECTED":
        return "Từ chối";
      default:
        return s || "Chưa rõ";
    }
  };

  const getRejectedReason = (nomination) => {
    const rejectedReview = [...(nomination.reviews || [])]
      .reverse()
      .find((review) => review.decision === "REJECTED");
    return rejectedReview?.comment?.trim() || "";
  };

  const getLatestReviewComment = (nomination) => {
    const reviewWithComment = [...(nomination.reviews || [])]
      .reverse()
      .find((review) => review.comment && review.comment.trim());
    return reviewWithComment?.comment?.trim() || "";
  };

  const buildEvidenceEntries = (nomination) => {
    const fromEvidenceTable = (nomination.evidences || [])
      .filter((ev) => ev.fileUrl)
      .map((ev) => ({
        id: ev.id,
        url: ev.fileUrl,
      }));

    const fromItems = (nomination.items || [])
      .map((item) => item.evidence)
      .filter(Boolean)
      .map((url) => ({
        id: null,
        url,
      }));

    const map = new Map();
    [...fromEvidenceTable, ...fromItems].forEach((entry) => {
      if (!map.has(entry.url)) {
        map.set(entry.url, entry);
      }
    });

    return [...map.values()];
  };

  const deleteEvidence = async (nominationId, evidenceId) => {
    if (!evidenceId) {
      alert("Không thể xóa minh chứng này.");
      return;
    }

    if (!window.confirm("Bạn có chắc muốn xóa tệp minh chứng này không?")) {
      return;
    }

    try {
      await api.delete(`/nominations/${nominationId}/evidences/${evidenceId}`);
      await load();
    } catch (err) {
      console.error("Error deleting evidence:", err);
      alert("Lỗi xóa tệp: " + (err.response?.data?.message || err.message));
    }
  };

  const toEvidenceHref = (entry) => {
    if (!entry?.id) return "#";
    return `http://localhost:4000/api/nominations/evidences/${entry.id}/download`;
  };

  const reviewLevelLabel = {
    DONVI: "Don vi",
    KHOA: "Khoa",
    TRUONG: "Truong",
  };

  const renderReviewTimeline = (nomination) => {
    const reviewsByLevel = Object.fromEntries((nomination.reviews || []).map((review) => [review.level, review]));
    const steps = [
      {
        key: "SUBMITTED",
        label: "Da nop",
        state: nomination.status === "DRAFT" ? "pending" : "done",
      },
      ...["DONVI", "KHOA", "TRUONG"].map((level) => {
        const review = reviewsByLevel[level];
        let state = "pending";
        if (review?.decision === "APPROVED") state = "done";
        if (review?.decision === "REJECTED" || nomination.status === "REJECTED") state = "rejected";
        return {
          key: level,
          label: reviewLevelLabel[level],
          state,
          reviewer: review?.reviewer?.fullName,
        };
      }),
      {
        key: "RESULT",
        label: "Ket qua",
        state:
          nomination.status === "APPROVED"
            ? "done"
            : nomination.status === "REJECTED"
              ? "rejected"
              : "pending",
      },
    ];

    return (
      <div className="review-timeline" aria-label="Tien trinh xet duyet">
        {steps.map((step) => (
          <div key={step.key} className={`timeline-step ${step.state}`}>
            <span className="timeline-dot" />
            <span className="timeline-label">{step.label}</span>
            {step.reviewer ? <small>{step.reviewer}</small> : null}
          </div>
        ))}
      </div>
    );
  };

  const visibleNominations = nominations.filter((nom) => {
    if (statusFilter && nom.status !== statusFilter) {
      return false;
    }

    if (normalizedTitleFilter && !String(nom.title || "").toLowerCase().includes(normalizedTitleFilter)) {
      return false;
    }

    if (canReview && !canCreate && !reviewerVisibleStatuses.includes(nom.status)) {
      return false;
    }

    return true;
  });

  // Keep the current order for all items, only move SUBMITTED to the front.
  const visibleNominationsSorted = [
    ...visibleNominations.filter((nom) => nom.status === "SUBMITTED"),
    ...visibleNominations.filter((nom) => nom.status !== "SUBMITTED"),
  ];

  return (
    <div className="page-grid">
      {canCreate ? (
        <form className="card form-card" onSubmit={(e) => { e.preventDefault(); handleSubmitNomination(scoreData); }}>
          <h2>Tạo hồ sơ thi đua</h2>

          <div className="form-group-section">
            <div className="form-group">
              <label>Tên hồ sơ <span className="required">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tên hồ sơ"
                maxLength="150"
                required
              />
            </div>

            <div className="form-group">
              <label>Năm <span className="required">*</span></label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min="2020"
                required
              />
            </div>
          </div>

          <CriteriaScoreForm 
            onScoreChange={handleScoreChange}
            loading={loading}
            canEditScores={canEditScores}
            showScores={showCreateScores}
            reviewLevel="DONVI"
          />

          <div className="form-actions-bottom">
            <button type="submit" disabled={loading || !scoreData} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu hồ sơ"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="card">
        <h2>Danh sách hồ sơ</h2>
        <p><small>Định dạng minh chứng cho phép: PDF, DOCX, XLSX, PNG, JPG, JPEG, ZIP.</small></p>
        <table>
          <thead>
            <tr>
              <th>Tiêu đề</th>
              <th>Năm</th>
              <th>Người nộp</th>
              <th>Tổng điểm</th>
              <th>Trạng thái</th>
              <th>Tiến trình</th>
              <th>Minh chứng</th>
              <th>Nhận xét</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {visibleNominationsSorted.map((nom) => (
              <tr key={nom.id}>
                <td>{nom.title}</td>
                <td>{nom.periodYear}</td>
                <td>{nom.applicant?.fullName || "N/A"}</td>
                <td>{nom.totalSelfPoint}</td>
                <td>
                  <div className={`status-cell status-${nom.status.toLowerCase()}`}>
                    <span>{statusLabel(nom.status)}</span>
                    {nom.status === "REJECTED" && getRejectedReason(nom) ? (
                      <small className="rejected-reason">Lý do: {getRejectedReason(nom)}</small>
                    ) : null}
                  </div>
                </td>
                <td>{renderReviewTimeline(nom)}</td>
                <td>
                  <div className="evidence-cell">
                    {buildEvidenceEntries(nom).length ? (
                      <div className="evidence-list">
                        {buildEvidenceEntries(nom).slice(0, 3).map((entry, idx) => (
                          <div key={`${nom.id}-ev-${idx}`} className="evidence-item">
                            <a href={toEvidenceHref(entry)} target="_blank" rel="noreferrer">
                              📄 Tệp minh chứng #{idx + 1}
                            </a>
                            {canCreate && nom.applicantId === user.id && nom.status !== "APPROVED" && entry.id ? (
                              <button
                                type="button"
                                className="btn-delete-evidence"
                                title="Xóa tệp minh chứng"
                                onClick={() => deleteEvidence(nom.id, entry.id)}
                              >
                                ✕
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="no-evidence">Chưa có</span>
                    )}
                    {canCreate && nom.applicantId === user.id && nom.status !== "APPROVED" ? (
                      <div className="evidence-upload-small">
                        <input
                          ref={(el) => (fileInputRefs.current[nom.id] = el)}
                          type="file"
                          onChange={(e) => handleFileSelect(nom.id, e)}
                          className="file-input-small"
                          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.zip"
                        />
                        <button 
                          type="button"
                          onClick={() => handleFileButtonClick(nom.id)}
                          className="btn-upload-small"
                        >
                          📎 Chọn file
                        </button>
                        {selectedFileNames[nom.id] && (
                          <div className="file-name-small-display">
                            <span>{selectedFileNames[nom.id]}</span>
                            <button
                              type="button"
                              onClick={() => handleClearFile(nom.id)}
                              className="btn-clear-file"
                              title="Xóa file"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        {selectedFiles[nom.id] && (
                          <button 
                            type="button"
                            onClick={() => uploadEvidence(nom.id)}
                            className="btn-upload-confirm"
                          >
                            ⬆️ Tải lên
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </td>
                <td>{getLatestReviewComment(nom) || "-"}</td>
                <td>
                  {canCreate && nom.applicantId === user.id && nom.status === "DRAFT" ? (
                    <button
                      type="button"
                      onClick={() => submitNomination(nom.id)}
                      className="btn-submit-small"
                    >
                      Nộp duyệt
                    </button>
                  ) : null}

                  {canCreate && nom.applicantId === user.id && nom.status === "REJECTED" ? (
                    <button
                      type="button"
                      onClick={() => reopenNomination(nom.id)}
                      className="btn-upload-confirm"
                    >
                      Mở lại hồ sơ
                    </button>
                  ) : null}

                  {canCreate && nom.applicantId === user.id && nom.status === "SUBMITTED" ? (
                    <button type="button" className="btn-submit-small" disabled>
                      Đã nộp duyệt
                    </button>
                  ) : null}

                  {canReview && nom.status === "SUBMITTED" ? (() => {
                    const myPendingStep = (nom.reviews || []).find(
                      (r) => r.reviewerId === user.id && r.decision === "PENDING"
                    );

                    if (!myPendingStep) {
                      return <span>-</span>;
                    }

                    const unlocked = canReviewStepNow(nom, myPendingStep);

                    return (
                      <div className="review-actions-inline">
                        {user.role === "HOIDONG" && myPendingStep.level === "TRUONG" ? (
                          <button
                            type="button"
                            className="btn-submit-small"
                            disabled={!unlocked || decidingReviewId === myPendingStep.id}
                            onClick={() => {
                              setOpenRejectReviewId(null);
                              openScoreModal(myPendingStep.id, nom);
                            }}
                          >
                            {decidingReviewId === myPendingStep.id ? "Đang xử lý..." : "Chấm điểm"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-submit-small"
                            disabled={!unlocked || decidingReviewId === myPendingStep.id}
                            onClick={() => {
                              setOpenRejectReviewId(null);
                              reviewFromList(myPendingStep.id, "APPROVED");
                            }}
                          >
                            {decidingReviewId === myPendingStep.id ? "Đang xử lý..." : "Duyệt"}
                          </button>
                        )}
                        {openRejectReviewId === myPendingStep.id ? (
                          <div className="reject-review-form">
                            <textarea
                              className="reject-reason-input"
                              placeholder="Nhập lý do từ chối"
                              value={rejectReasonByReviewId[myPendingStep.id] || ""}
                              onChange={(e) =>
                                setRejectReasonByReviewId((prev) => ({
                                  ...prev,
                                  [myPendingStep.id]: e.target.value,
                                }))
                              }
                              rows={3}
                            />
                            <div className="reject-review-actions">
                              <button
                                type="button"
                                className="danger"
                                disabled={!unlocked || decidingReviewId === myPendingStep.id}
                                onClick={() => confirmRejectFromList(myPendingStep.id)}
                              >
                                {decidingReviewId === myPendingStep.id ? "Đang xử lý..." : "Xác nhận từ chối"}
                              </button>
                              <button
                                type="button"
                                className="btn-cancel-reject"
                                disabled={decidingReviewId === myPendingStep.id}
                                onClick={closeRejectForm}
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="danger"
                            disabled={!unlocked || decidingReviewId === myPendingStep.id}
                            onClick={() => openRejectForm(myPendingStep.id)}
                          >
                            Từ chối
                          </button>
                        )}
                        {!unlocked ? <small>Chờ cấp trước duyệt</small> : null}
                      </div>
                    );
                  })() : null}

                  {!((canCreate && nom.applicantId === user.id && (nom.status === "DRAFT" || nom.status === "REJECTED" || nom.status === "SUBMITTED")) || (canReview && nom.status === "SUBMITTED")) ? "-" : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {scoreModal.open && scoreModal.nomination ? (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Chấm điểm hồ sơ</h3>
              <button type="button" className="modal-close" onClick={closeScoreModal} aria-label="Dong">
                ✕
              </button>
            </div>
            <p>
              Hồ sơ: <strong>{scoreModal.nomination.title}</strong> — Người nộp: {scoreModal.nomination.applicant?.fullName || ""}
            </p>
            <div className="modal-body">
              <table>
                <thead>
                  <tr>
                    <th>Tiêu chí</th>
                    <th>Minh chứng</th>
                    <th>Điểm (tối đa)</th>
                  </tr>
                </thead>
                <tbody>
                  {(scoreModal.nomination.items || []).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div>{item.criteria?.code || "-"} — {item.criteria?.title || ""}</div>
                        {item.criteria?.description ? (
                          <small>{item.criteria.description}</small>
                        ) : null}
                      </td>
                      <td>{item.evidence ? "Có" : "Chưa có"}</td>
                      <td>
                        {(item.criteria?.subItems || []).length ? (
                          <div>
                            {(item.criteria?.subItems || []).map((subItem) => {
                              const key = `${item.id}_${subItem.id}`;
                              return (
                                <div key={subItem.id}>
                                  <small>{subItem.title}</small>
                                  <input
                                    type="number"
                                    min="0"
                                    max={subItem.maxPoint || 0}
                                    value={scoreModalSubScores[key] ?? ""}
                                    onChange={(e) => {
                                      const nextValue = e.target.value === "" ? "" : Number(e.target.value);
                                      setScoreModalSubScores((prev) => {
                                        const next = { ...prev, [key]: nextValue };
                                        const total = (item.criteria?.subItems || []).reduce((sum, currentSubItem) => {
                                          const currentKey = `${item.id}_${currentSubItem.id}`;
                                          const currentValue = next[currentKey];
                                          return sum + (currentValue === "" || currentValue === undefined ? 0 : Number(currentValue));
                                        }, 0);
                                        setScoreModalScores((prevScores) => ({
                                          ...prevScores,
                                          [item.id]: total,
                                        }));
                                        return next;
                                      });
                                    }}
                                  />
                                  <small> / {subItem.maxPoint || 0}</small>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            <input
                              type="number"
                              min="0"
                              max={item.criteria?.maxPoint || 0}
                              value={scoreModalScores[item.id] ?? ""}
                              onChange={(e) =>
                                setScoreModalScores((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value === "" ? "" : Number(e.target.value),
                                }))
                              }
                            />
                            <small> / {item.criteria?.maxPoint || 0}</small>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="form-group">
                <label>Nhận xét</label>
                <textarea
                  value={scoreModalComment}
                  onChange={(e) => setScoreModalComment(e.target.value)}
                  placeholder="Nhập nhận xét (nếu có)"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={confirmScoreModal}>Xác nhận duyệt</button>
              <button type="button" className="btn-cancel" onClick={closeScoreModal}>Hủy</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
