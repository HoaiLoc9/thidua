import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import "../styles/CriteriaScoreForm.css";

export default function CriteriaScoreForm({ onScoreChange, onSubmit, loading }) {
  const { isAuthenticated } = useAuth();
  const [criteria, setCriteria] = useState([]);
  const [scores, setScores] = useState({});
  const [files, setFiles] = useState({});
  const [error, setError] = useState("");
  const fileInputRefs = useRef({});

  // Load danh sách tiêu chí từ API
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const loadCriteria = async () => {
      try {
        const { data } = await api.get("/criteria");
        setCriteria(data);
        // Initialize scores
        const initialScores = {};
        data.forEach((c) => {
          initialScores[c.id] = 0;
        });
        setScores(initialScores);
        setError("");
      } catch (err) {
        console.error("Error loading criteria:", err);
        setError("Lỗi tải danh sách tiêu chí: " + (err.response?.data?.message || err.message));
      }
    };
    loadCriteria();
  }, [isAuthenticated]);

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

  return (
    <div className="criteria-score-form">
      {error && <div className="error-message">{error}</div>}

      {criteria.length > 0 ? (
        <div className="criteria-table-wrapper">
          <table className="criteria-table">
            <thead>
              <tr>
                <th className="col-criteria">Tiêu chí</th>
                <th className="col-score">Điểm</th>
                <th className="col-evidence">Minh chứng</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((criterion) => (
                <tr key={criterion.id} className="criteria-row">
                  {/* Cột tiêu chí */}
                  <td className="col-criteria">
                    <div className="criteria-info">
                      <div className="criteria-code">{criterion.code}</div>
                      <div className="criteria-title">{criterion.title}</div>
                      {criterion.description && (
                        <div className="criteria-desc">{criterion.description}</div>
                      )}
                      <div className="criteria-maxpoint">
                        Tối đa: <strong>{criterion.maxPoint}</strong> điểm
                      </div>
                    </div>
                  </td>

                  {/* Cột nhập điểm */}
                  <td className="col-score">
                    <input
                      type="number"
                      min="0"
                      max={criterion.maxPoint}
                      value={scores[criterion.id] || 0}
                      onChange={(e) => handleScoreChange(criterion.id, e.target.value)}
                      className="score-input"
                      placeholder="0"
                    />
                  </td>

                  {/* Cột upload file */}
                  <td className="col-evidence">
                    <div className="evidence-upload">
                      <input
                        ref={(el) => (fileInputRefs.current[criterion.id] = el)}
                        type="file"
                        onChange={(e) => handleFileSelect(criterion.id, e)}
                        className="file-input-hidden"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                      />
                      <button 
                        type="button" 
                        className="file-button"
                        onClick={() => handleFileButtonClick(criterion.id)}
                      >
                        📎 Chọn file
                      </button>

                      {files[criterion.id] && (
                        <div className="file-selected">
                          <span className="file-name">{files[criterion.id].name}</span>
                          <button
                            type="button"
                            className="file-remove"
                            onClick={() => handleRemoveFile(criterion.id)}
                            title="Xóa file"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-criteria">Không có tiêu chí nào</div>
      )}

      {/* Tổng điểm */}
      <div className="total-score-section">
        <div className="total-score-display">
          <span className="total-label">Tổng điểm:</span>
          <span className="total-value">{totalScore}</span>
          <span className="total-unit">điểm</span>
        </div>
      </div>

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
