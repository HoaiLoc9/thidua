// FRONTEND - COMPONENT DOCUMENTATION
// File: src/components/CriteriaScoreForm.jsx

/**
 * Component: CriteriaScoreForm
 * 
 * Một component form hiển thị danh sách tiêu chí từ API với các tính năng:
 * 1. Input điểm: Number input với validation (không âm, không vượt maxScore)
 * 2. Tính tổng điểm real-time: Tự động cập nhật khi người dùng nhập điểm
 * 3. Upload minh chứng: Custom file input UI với nút "Chọn file" và hiển thị tên file
 * 
 * Props:
 * - onScoreChange: Function callback, gọi khi điểm hoặc file thay đổi
 *   Nhận object: { scores: {[criteriaId]: score}, totalScore: number, files: {[criteriaId]: File} }
 * - onSubmit: Function callback khi nhấn nút submit (optional)
 * - loading: Boolean để vô hiệu hóa nút khi đang tải
 * 
 * Features:
 * ✓ Load danh sách tiêu chí từ GET /api/criteria
 * ✓ Validate input: số không âm, không vượt max của tiêu chí
 * ✓ Tính tổng điểm real-time (useMemo)
 * ✓ Upload file custom: ẩn input mặc định, button "Chọn file"
 * ✓ Hiển thị tên file, nút xóa (X)
 * ✓ Responsive design (mobile-friendly)
 * 
 * Cách sử dụng trong NominationsPage:
 * 
 * const [scoreData, setScoreData] = useState(null);
 * const [loading, setLoading] = useState(false);
 * 
 * const handleScoreChange = (data) => {
 *   setScoreData(data); // {scores, totalScore, files}
 * };
 * 
 * const handleSubmit = async (data) => {
 *   setLoading(true);
 *   try {
 *     // Upload files & create nomination
 *     const items = Object.entries(data.scores).map(([criteriaId, score]) => ({
 *       criteriaId: Number(criteriaId),
 *       selfPoint: Number(score),
 *       evidence: ""
 *     }));
 *     
 *     // Upload file evidence
 *     for (const [criteriaId, file] of Object.entries(data.files)) {
 *       if (file) {
 *         const formData = new FormData();
 *         formData.append("file", file);
 *         const res = await api.post("/nominations/upload-evidence", formData, {
 *           headers: { "Content-Type": "multipart/form-data" }
 *         });
 *         // Find corresponding item and set evidence URL
 *         const item = items.find(i => i.criteriaId === Number(criteriaId));
 *         if (item) item.evidence = res.data.fileUrl;
 *       }
 *     }
 *     
 *     // Create nomination
 *     await api.post("/nominations", { title, periodYear, items });
 *   } finally {
 *     setLoading(false);
 *   }
 * };
 * 
 * <CriteriaScoreForm
 *   onScoreChange={handleScoreChange}
 *   onSubmit={handleSubmit}
 *   loading={loading}
 * />
 */

// INPUT VALIDATION LOGIC
const handleScoreChange = useCallback((criteriaId, value) => {
  const maxScore = criteria.find((c) => c.id === criteriaId)?.maxPoint || 0;
  let numValue = Number(value) || 0;

  // Validation rules:
  // 1. Không cho phép số âm
  if (numValue < 0) numValue = 0;
  
  // 2. Không cho phép vượt quá maxScore
  if (numValue > maxScore) numValue = maxScore;

  setScores((prev) => ({
    ...prev,
    [criteriaId]: numValue,
  }));
}, [criteria]);

// REAL-TIME TOTAL SCORE CALCULATION
const totalScore = useMemo(() => {
  return Object.values(scores).reduce((sum, score) => sum + (Number(score) || 0), 0);
}, [scores]);

// Notify parent component khi tổng điểm thay đổi
useEffect(() => {
  if (onScoreChange) {
    onScoreChange({
      scores,
      totalScore,
      files,
    });
  }
}, [scores, totalScore, files, onScoreChange]);

// FILE UPLOAD CUSTOM UI
const handleFileSelect = useCallback((criteriaId, event) => {
  const file = event.target.files?.[0];
  if (file) {
    setFiles((prev) => ({
      ...prev,
      [criteriaId]: file,
    }));
  }
}, []);

const handleRemoveFile = useCallback((criteriaId) => {
  setFiles((prev) => {
    const newFiles = { ...prev };
    delete newFiles[criteriaId];
    return newFiles;
  });
}, []);

// UI: File input custom
<label className="file-label">
  <input
    type="file"
    onChange={(e) => handleFileSelect(criterion.id, e)}
    className="file-input-hidden"  // Display: none
    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
  />
  <button type="button" className="file-button">
    📎 Chọn file
  </button>
</label>

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

// CSS HIGHLIGHTS
.file-input-hidden {
  display: none; /* Ẩn input mặc định */
}

.file-button {
  padding: 6px 12px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-button:hover {
  background-color: #0056b3;
}

.file-selected {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: #e8f4f8;
  border: 1px solid #b3e5fc;
  border-radius: 4px;
}

.file-name {
  font-size: 12px;
  color: #0056b3;
  font-weight: 500;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-remove {
  background: transparent;
  border: none;
  color: #0056b3;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  border-radius: 2px;
  transition: background-color 0.2s;
}

.file-remove:hover {
  background-color: rgba(0, 86, 179, 0.1);
}
