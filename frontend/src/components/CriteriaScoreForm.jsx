import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import "../styles/CriteriaScoreForm.css";

const ALLOWED_EVIDENCE_EXTENSIONS = ["pdf", "docx", "xlsx", "png", "jpg", "jpeg", "zip"];

function isAllowedEvidenceFile(file) {
  const extension = (file?.name?.split(".").pop() || "").toLowerCase();
  return ALLOWED_EVIDENCE_EXTENSIONS.includes(extension);
}

export default function CriteriaScoreForm({
  onScoreChange,
  onSubmit,
  loading,
  canEditScores = true,
  showScores = true,
  reviewLevel = "DONVI",
}) {
  const { isAuthenticated } = useAuth();
  const [criteria, setCriteria] = useState([]);
  const [selectedCriteriaId, setSelectedCriteriaId] = useState("");
  const [scores, setScores] = useState({});
  const [files, setFiles] = useState({});
  const [error, setError] = useState("");
  const fileInputRefs = useRef({});

  // Load danh sách tiêu chí từ API
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const loadCriteria = async () => {
      try {
        const { data } = await api.get(`/criteria?reviewLevel=${reviewLevel}`);
        setCriteria(data);
        // Initialize scores
        const initialScores = {};
        data.forEach((c) => {
          initialScores[c.id] = 0;
        });
        setScores(initialScores);
        setSelectedCriteriaId(data.length ? String(data[0].id) : "");
        setError("");
      } catch (err) {
        console.error("Error loading criteria:", err);
        setError("Lỗi tải danh sách tiêu chí: " + (err.response?.data?.message || err.message));
      }
    };
    loadCriteria();
  }, [isAuthenticated, reviewLevel]);

  // Tính tổng điểm real-time
  const totalScore = useMemo(() => {
    return Object.values(scores).reduce((sum, score) => sum + (Number(score) || 0), 0);
  }, [scores]);

  // Notify parent khi tổng điểm thay đổi
  useEffect(() => {
    if (onScoreChange) {
      onScoreChange({
        scores,
        totalScore,
        files,
      });
    }
  }, [scores, totalScore, files, onScoreChange]);

  // Xử lý thay đổi điểm
  const handleScoreChange = useCallback((criteriaId, value) => {
    const maxScore = criteria.find((c) => c.id === criteriaId)?.maxPoint || 0;
    let numValue = Number(value) || 0;

    // Validate: không âm, không vượt max
    if (numValue < 0) numValue = 0;
    if (numValue > maxScore) numValue = maxScore;

    setScores((prev) => ({
      ...prev,
      [criteriaId]: numValue,
    }));
  }, [criteria]);

  // Xử lý chọn file
  const handleFileSelect = useCallback((criteriaId, event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!isAllowedEvidenceFile(file)) {
        setError("Chỉ được tải lên minh chứng dạng PDF, DOCX, XLSX, PNG/JPG hoặc ZIP.");
        event.target.value = "";
        return;
      }

      setError("");
      setFiles((prev) => ({
        ...prev,
        [criteriaId]: file,
      }));
    }
  }, []);

  // Trigger file input click
  const handleFileButtonClick = useCallback((criteriaId) => {
    fileInputRefs.current[criteriaId]?.click();
  }, []);

  // Xoá file đã chọn
  const handleRemoveFile = useCallback((criteriaId) => {
    setFiles((prev) => {
      const newFiles = { ...prev };
      delete newFiles[criteriaId];
      return newFiles;
    });
  }, []);

  const selectedCriterion = criteria.find((item) => String(item.id) === String(selectedCriteriaId));

  return (
    <div className="criteria-score-form">
      {error && <div className="error-message">{error}</div>}

      {criteria.length > 0 ? (
        <div className="criteria-select-wrapper">
          <label className="field-group">
            <span>Chọn tiêu chí</span>
            <select
              value={selectedCriteriaId}
              onChange={(e) => setSelectedCriteriaId(e.target.value)}
            >
              {criteria.map((criterion) => (
                <option key={criterion.id} value={criterion.id}>
                  {criterion.code} - {criterion.title}
                </option>
              ))}
            </select>
          </label>

          {selectedCriterion ? (
            <div className="criteria-detail-card">
              <div className="criteria-info">
                <div className="criteria-code">{selectedCriterion.code}</div>
                <div className="criteria-title">{selectedCriterion.title}</div>
                {selectedCriterion.description && (
                  <div className="criteria-desc">{selectedCriterion.description}</div>
                )}
                {showScores ? (
                  <div className="criteria-maxpoint">
                    Tối đa: <strong>{selectedCriterion.maxPoint}</strong> điểm
                  </div>
                ) : null}
              </div>

              <div className="criteria-inputs-row">
                {showScores ? (
                  <div className="criteria-input-block">
                    <label className="criteria-inline-label">Điểm</label>
                    <input
                      type="number"
                      min="0"
                      max={selectedCriterion.maxPoint}
                      value={scores[selectedCriterion.id] || 0}
                      onChange={(e) => handleScoreChange(selectedCriterion.id, e.target.value)}
                      className="score-input"
                      placeholder="0"
                      disabled={!canEditScores}
                    />
                  </div>
                ) : null}

                <div className="criteria-input-block">
                  <label className="criteria-inline-label">Minh chứng</label>
                  <div className="evidence-upload">
                    <input
                      ref={(el) => (fileInputRefs.current[selectedCriterion.id] = el)}
                      type="file"
                      onChange={(e) => handleFileSelect(selectedCriterion.id, e)}
                      className="file-input-hidden"
                      accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.zip"
                    />
                    <button
                      type="button"
                      className="file-button"
                      onClick={() => handleFileButtonClick(selectedCriterion.id)}
                    >
                      📎 Chọn file
                    </button>

                    {files[selectedCriterion.id] && (
                      <div className="file-selected">
                        <span className="file-name">{files[selectedCriterion.id].name}</span>
                        <button
                          type="button"
                          className="file-remove"
                          onClick={() => handleRemoveFile(selectedCriterion.id)}
                          title="Xóa file"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                  <small className="evidence-format-note">
                    Dinh dang cho phep: PDF, DOCX, XLSX, PNG, JPG, JPEG, ZIP.
                  </small>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="no-criteria">Không có tiêu chí nào</div>
      )}

      {/* Tổng điểm */}
      {showScores ? (
        <div className="total-score-section">
          <div className="total-score-display">
            <span className="total-label">Tổng điểm:</span>
            <span className="total-value">{totalScore}</span>
            <span className="total-unit">điểm</span>
          </div>
        </div>
      ) : null}

      {/* Nút submit */}
      {onSubmit && (
        <div className="form-actions">
          <button
            type="button"
            onClick={() => onSubmit({ scores, files })}
            disabled={loading}
            className="btn-submit"
          >
            {loading ? "Đang lưu..." : "Lưu hồ sơ"}
          </button>
        </div>
      )}
    </div>
  );
}
