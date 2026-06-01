import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import "../styles/AwardsPage.css";

const emptyCriterion = {
  title: "",
  description: "",
  minPoint: "",
};

const initialForm = {
  code: "",
  name: "",
  category: "Danh hiệu thi đua",
  description: "",
  periodYear: new Date().getFullYear(),
  criteria: [{ ...emptyCriterion }],
};

export default function AwardsPage() {
  const { user } = useAuth();
  const [awards, setAwards] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [detailAward, setDetailAward] = useState(null);
  const [editingAwardId, setEditingAwardId] = useState(null);

  const canManage = ["ADMIN", "HOIDONG"].includes(user.role);

  const load = async () => {
    const { data } = await api.get("/awards");
    setAwards(data);
  };

  useEffect(() => {
    load().catch(() => setError("Không tải được danh mục danh hiệu và khen thưởng."));
  }, []);

  const updateCriterion = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      criteria: prev.criteria.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addCriterion = () => {
    setForm((prev) => ({
      ...prev,
      criteria: [...prev.criteria, { ...emptyCriterion }],
    }));
  };

  const removeCriterion = (index) => {
    setForm((prev) => ({
      ...prev,
      criteria: prev.criteria.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const getCleanCriteria = () =>
    form.criteria
      .map((item, index) => ({
        title: item.title.trim(),
        description: item.description.trim(),
        minPoint: item.minPoint === "" ? null : Number(item.minPoint),
        sortOrder: index + 1,
      }))
      .filter((item) => item.title || item.description || item.minPoint !== null);

  const resetForm = () => {
    setEditingAwardId(null);
    setForm({
      ...initialForm,
      periodYear: new Date().getFullYear(),
      criteria: [{ ...emptyCriterion }],
    });
  };

  const startEditAward = (award) => {
    setError("");
    setMessage("");
    setEditingAwardId(award.id);
    setForm({
      code: award.code || "",
      name: award.name || "",
      category: award.category || "Danh hiệu thi đua",
      description: award.description || "",
      periodYear: award.periodYear || new Date().getFullYear(),
      criteria: award.criteria?.length
        ? award.criteria.map((criterion) => ({
            title: criterion.title || "",
            description: criterion.description || "",
            minPoint: criterion.minPoint ?? "",
          }))
        : [{ ...emptyCriterion }],
    });

    setTimeout(() => {
      document.querySelector(".award-form-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const saveAward = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const criteria = getCleanCriteria();
    if (criteria.some((item) => !item.title)) {
      setError("Vui lòng nhập tên tiêu chí hoặc xóa dòng tiêu chí còn trống.");
      return;
    }

    try {
      const payload = {
        ...form,
        periodYear: Number(form.periodYear),
        description: form.description || null,
        criteria,
      };

      if (editingAwardId) {
        await api.put(`/awards/${editingAwardId}`, payload);
        setMessage("Đã cập nhật danh hiệu/khen thưởng.");
      } else {
        await api.post("/awards", payload);
        setMessage("Đã thêm danh hiệu/khen thưởng.");
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Không lưu được danh hiệu/khen thưởng.");
    }
  };

  const closeDetail = () => {
    setDetailAward(null);
  };

  return (
    <div className="page-grid">
      {error ? <div className="card error-message">{error}</div> : null}
      {message ? <div className="card success-message">{message}</div> : null}

      {canManage ? (
        <form className="card form-card award-form-card" onSubmit={saveAward}>
          <h2>{editingAwardId ? "Cập nhật Danh hiệu & Khen thưởng" : "Danh hiệu & Khen thưởng"}</h2>
          <p>
            Quản lý các danh hiệu hoặc hình thức khen thưởng mà hồ sơ có thể đăng ký
            hoặc được hội đồng xét duyệt cuối cùng.
          </p>

          <div className="form-grid">
            <label className="field-group">
              <span>Mã</span>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Ví dụ: DHTD_LDTT"
                maxLength="30"
                required
              />
              <small>Mã ngắn để định danh danh hiệu/khen thưởng.</small>
            </label>

            <label className="field-group">
              <span>Năm áp dụng</span>
              <input
                type="number"
                value={form.periodYear}
                onChange={(e) => setForm({ ...form, periodYear: e.target.value })}
                min="2020"
                required
              />
              <small>Ví dụ: 2026.</small>
            </label>

            <label className="field-group form-span-2">
              <span>Tên danh hiệu/khen thưởng</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Sinh viên 5 tốt"
                maxLength="100"
                required
              />
              <small>Tên hiển thị khi người dùng đăng ký hoặc hội đồng xét duyệt.</small>
            </label>

            <label className="field-group form-span-2">
              <span>Loại</span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                <option value="Danh hiệu thi đua">Danh hiệu thi đua</option>
                <option value="Hình thức khen thưởng">Hình thức khen thưởng</option>
              </select>
              <small>Chọn đúng nhóm nghiệp vụ để hệ thống phân loại rõ ràng.</small>
            </label>

            <label className="field-group form-span-2">
              <span>Mô tả</span>
              <textarea
                rows="3"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength="500"
                placeholder="Mô tả ngắn về điều kiện hoặc phạm vi áp dụng"
              />
              <small>Mô tả chi tiết. Tối đa 500 ký tự.</small>
            </label>
          </div>

          <div className="award-criteria-editor">
            <div className="award-section-header">
              <div>
                <h3>Tiêu chí xét danh hiệu/khen thưởng</h3>
                <p>Nhập các điều kiện hoặc tiêu chí mà hồ sơ cần đáp ứng.</p>
              </div>
              <button type="button" className="btn-secondary" onClick={addCriterion}>
                Thêm tiêu chí
              </button>
            </div>

            <div className="award-criteria-list">
              {form.criteria.map((criterion, index) => (
                <div className="award-criterion-row" key={`criterion-${index}`}>
                  <label>
                    <span>Tên tiêu chí</span>
                    <input
                      value={criterion.title}
                      onChange={(e) => updateCriterion(index, "title", e.target.value)}
                      placeholder="Ví dụ: Điểm rèn luyện đạt loại tốt"
                    />
                  </label>
                  <label>
                    <span>Điểm tối thiểu</span>
                    <input
                      type="number"
                      min="0"
                      value={criterion.minPoint}
                      onChange={(e) => updateCriterion(index, "minPoint", e.target.value)}
                      placeholder="Nếu có"
                    />
                  </label>
                  <label className="criterion-description">
                    <span>Mô tả</span>
                    <input
                      value={criterion.description}
                      onChange={(e) => updateCriterion(index, "description", e.target.value)}
                      placeholder="Mô tả điều kiện, minh chứng hoặc phạm vi áp dụng"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-remove-criterion"
                    onClick={() => removeCriterion(index)}
                    disabled={form.criteria.length === 1}
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit">{editingAwardId ? "Lưu thay đổi" : "Thêm danh mục"}</button>
            {editingAwardId ? (
              <button type="button" className="btn-cancel-edit-award" onClick={resetForm}>
                Hủy chỉnh sửa
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="card">
        <h2>Danh mục Danh hiệu & Khen thưởng</h2>
        <p>
          Đây là danh sách các danh hiệu hoặc hình thức khen thưởng đang được áp dụng
          trong hệ thống.
        </p>
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Loại</th>
              <th>Năm áp dụng</th>
              <th>Tiêu chí</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {awards.length ? awards.map((award) => (
              <tr key={award.id}>
                <td>{award.code}</td>
                <td>{award.name}</td>
                <td>{award.category}</td>
                <td>{award.periodYear}</td>
                <td>{award.criteria?.length || 0} tiêu chí</td>
                <td>
                  <div className="award-action-row">
                    <button type="button" className="btn-detail-award" onClick={() => setDetailAward(award)}>
                      Chi tiết
                    </button>
                    {canManage ? (
                      <button type="button" className="btn-edit-award" onClick={() => startEditAward(award)}>
                        Sửa
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6">
                  <div className="empty-award-state">Chưa có danh hiệu hoặc hình thức khen thưởng.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detailAward ? createPortal(
        <div className="award-modal-overlay">
          <div className="award-detail-modal" role="dialog" aria-modal="true">
            <div className="award-modal-header">
              <div>
                <h3>Chi tiết Danh hiệu & Khen thưởng</h3>
                <p>{detailAward.name}</p>
              </div>
              <button type="button" onClick={closeDetail} aria-label="Đóng">×</button>
            </div>

            <div className="award-detail-grid">
              <div>
                <span>Mã</span>
                <strong>{detailAward.code}</strong>
              </div>
              <div>
                <span>Loại</span>
                <strong>{detailAward.category}</strong>
              </div>
              <div>
                <span>Năm áp dụng</span>
                <strong>{detailAward.periodYear}</strong>
              </div>
              <div>
                <span>Trạng thái</span>
                <strong>{detailAward.isActive ? "Đang áp dụng" : "Ngừng áp dụng"}</strong>
              </div>
            </div>

            <div className="award-detail-section">
              <h4>Mô tả</h4>
              <p>{detailAward.description || "Chưa có mô tả."}</p>
            </div>

            <div className="award-detail-section">
              <h4>Tiêu chí xét</h4>
              {detailAward.criteria?.length ? (
                <div className="award-detail-criteria">
                  {detailAward.criteria.map((criterion, index) => (
                    <div className="award-detail-criterion" key={criterion.id}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{criterion.title}</strong>
                        {criterion.minPoint !== null && criterion.minPoint !== undefined ? (
                          <small>Điểm tối thiểu: {criterion.minPoint}</small>
                        ) : null}
                        <p>{criterion.description || "Chưa có mô tả chi tiết."}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Danh mục này chưa có tiêu chí xét.</p>
              )}
            </div>

            <div className="award-modal-actions">
              <button type="button" onClick={closeDetail}>Đóng</button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
