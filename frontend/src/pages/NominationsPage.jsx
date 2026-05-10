import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import CriteriaScoreForm from "../components/CriteriaScoreForm";
import "../styles/NominationsPage.css";

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

  const canCreate = ["GIANGVIEN", "SINHVIEN"].includes(user.role);
  const canReview = ["CANBO", "HOIDONG", "ADMIN"].includes(user.role);
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

  const handleScoreChange = (data) => {
    setScoreData(data);
  };

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
        selfPoint: Number(score),
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

  const reviewFromList = async (reviewId, decision) => {
    try {
      setDecidingReviewId(reviewId);
      await api.post(`/reviews/${reviewId}/decision`, {
        decision,
        comment: "",
      });
      await load();
    } catch (err) {
      console.error("Error making decision:", err);
      alert("Lỗi duyệt hồ sơ: " + (err.response?.data?.message || err.message));
    } finally {
      setDecidingReviewId(null);
    }
  };

  const handleFileSelect = (nominationId, event) => {
    const file = event.target.files?.[0];
    if (file) {
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

  const params = new URLSearchParams(location.search);
  const statusFilter = params.get("status");

  const statusLabel = (s) => {
    switch (s) {
      case "DRAFT":
        return "Nháp";
      case "SUBMITTED":
        return "Đã nộp";
      case "APPROVED":
        return "Đã duyệt";
      case "REJECTED":
        return "Từ chối";
      default:
        return s || "Chưa rõ";
    }
  };

  const buildEvidenceLinks = (nomination) => {
    const urlsFromEvidenceTable = (nomination.evidences || []).map((ev) => ev.fileUrl).filter(Boolean);
    const urlsFromItems = (nomination.items || []).map((item) => item.evidence).filter(Boolean);
    return [...new Set([...urlsFromEvidenceTable, ...urlsFromItems])];
  };

  const toEvidenceHref = (url) => {
    if (!url) return "#";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `http://localhost:4000${url}`;
  };

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
        <table>
          <thead>
            <tr>
              <th>Tiêu đề</th>
              <th>Năm</th>
              <th>Người nộp</th>
              <th>Tổng điểm</th>
              <th>Trạng thái</th>
              <th>Minh chứng</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {nominations
              .filter((nom) => (statusFilter ? nom.status === statusFilter : true))
              .map((nom) => (
              <tr key={nom.id}>
                <td>{nom.title}</td>
                <td>{nom.periodYear}</td>
                <td>{nom.applicant?.fullName || "N/A"}</td>
                <td>{nom.totalSelfPoint}</td>
                <td>{statusLabel(nom.status)}</td>
                <td>
                  <div className="evidence-cell">
                    {buildEvidenceLinks(nom).length ? (
                      <div className="evidence-list">
                        {buildEvidenceLinks(nom).slice(0, 3).map((url, idx) => (
                          <div key={`${nom.id}-ev-${idx}`} className="evidence-item">
                            <a href={toEvidenceHref(url)} target="_blank" rel="noreferrer">
                              📄 Tệp minh chứng #{idx + 1}
                            </a>
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
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
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
                        <button
                          type="button"
                          className="btn-submit-small"
                          disabled={!unlocked || decidingReviewId === myPendingStep.id}
                          onClick={() => reviewFromList(myPendingStep.id, "APPROVED")}
                        >
                          {decidingReviewId === myPendingStep.id ? "Đang xử lý..." : "Duyệt"}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={!unlocked || decidingReviewId === myPendingStep.id}
                          onClick={() => reviewFromList(myPendingStep.id, "REJECTED")}
                        >
                          Từ chối
                        </button>
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
    </div>
  );
}
