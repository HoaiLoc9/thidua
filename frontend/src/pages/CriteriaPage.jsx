import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const levelLabels = {
  DONVI: "Cấp đơn vị",
  KHOA: "Cấp khoa",
  TRUONG: "Cấp trường / hội đồng",
};

const targetLabels = {
  SINHVIEN: "Sinh viên",
  GIANGVIEN: "Giảng viên",
};

const initialForm = {
  code: "",
  title: "",
  description: "",
  maxPoint: 10,
  target: "SINHVIEN",
  reviewLevel: "DONVI",
};

export default function CriteriaPage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [creatingCriteriaId, setCreatingCriteriaId] = useState(null);
  const [expandedCriteriaId, setExpandedCriteriaId] = useState(null);
  const [registeringCriteriaId, setRegisteringCriteriaId] = useState(null);
  const [registerForm, setRegisterForm] = useState({
    title: "",
    periodYear: new Date().getFullYear(),
  });
  const [subItemForms, setSubItemForms] = useState({});
  const [savingSubItemForCriteriaId, setSavingSubItemForCriteriaId] = useState(null);

  const canEdit = ["ADMIN", "HOIDONG"].includes(user?.role);
  const canCreateNomination = ["GIANGVIEN", "SINHVIEN"].includes(user?.role);
  const userTarget = user?.role === "SINHVIEN" ? "SINHVIEN" : user?.role === "GIANGVIEN" ? "GIANGVIEN" : null;

  const load = async () => {
    const res = await api.get("/criteria");
    setList(res.data);
  };

  useEffect(() => {
    load().catch(() => setError("Không tải được danh sách tiêu chí."));
  }, []);

  const addCriteria = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      await api.post("/criteria", { ...form, maxPoint: Number(form.maxPoint) });
      setForm(initialForm);
      setMessage("Đã lưu tiêu chí.");
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Không lưu được tiêu chí. Kiểm tra lại dữ liệu hoặc quyền đăng nhập.");
    }
  };

  const removeCriteria = async (id) => {
    await api.delete(`/criteria/${id}`);
    load();
  };

  const addSubItem = async (criteriaId) => {
    const criteria = list.find((item) => item.id === criteriaId);
    const formValue = subItemForms[criteriaId] || {};
    const payload = {
      title: (formValue.title || "").trim(),
      description: (formValue.description || "").trim(),
      maxPoint: Number(formValue.maxPoint),
      sortOrder: Number(formValue.sortOrder || 1),
    };

    if (!payload.title || !Number.isInteger(payload.maxPoint) || payload.maxPoint <= 0) {
      setError("Vui lòng nhập đầy đủ tên ý nhỏ và điểm tối đa hợp lệ.");
      return;
    }

    const currentSubTotal = (criteria?.subItems || []).reduce((sum, subItem) => sum + Number(subItem.maxPoint || 0), 0);
    const nextSubTotal = currentSubTotal + payload.maxPoint;
    if (criteria && nextSubTotal > Number(criteria.maxPoint)) {
      setError(
        `Không thể thêm ý nhỏ này. Tổng điểm các ý nhỏ sẽ là ${nextSubTotal}, vượt quá điểm tối đa của tiêu chí lớn là ${criteria.maxPoint}. Vui lòng nhập lại điểm nhỏ hơn.`
      );
      return;
    }

    setError("");
    setMessage("");
    setSavingSubItemForCriteriaId(criteriaId);
    try {
      await api.post(`/criteria/${criteriaId}/sub-items`, payload);
      setSubItemForms((prev) => ({
        ...prev,
        [criteriaId]: { title: "", description: "", maxPoint: "", sortOrder: 1 },
      }));
      setMessage("Đã thêm ý nhỏ cho tiêu chí.");
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Không thêm được ý nhỏ.");
    } finally {
      setSavingSubItemForCriteriaId(null);
    }
  };

  const getSubItemPointWarning = (item) => {
    const rawPoint = subItemForms[item.id]?.maxPoint;
    if (rawPoint === undefined || rawPoint === "") return "";
    const point = Number(rawPoint);
    if (!Number.isInteger(point) || point <= 0) return "Điểm tối đa phải là số nguyên lớn hơn 0.";
    const currentSubTotal = (item.subItems || []).reduce((sum, subItem) => sum + Number(subItem.maxPoint || 0), 0);
    const nextSubTotal = currentSubTotal + point;
    if (nextSubTotal > Number(item.maxPoint)) {
      return `Tổng điểm các ý nhỏ sẽ là ${nextSubTotal}/${item.maxPoint}, đã vượt điểm tối đa của tiêu chí lớn.`;
    }
    return "";
  };

  const removeSubItem = async (subItemId) => {
    await api.delete(`/criteria/sub-items/${subItemId}`);
    load();
  };

  const openRegisterForm = (item) => {
    if (!canCreateNomination) {
      return;
    }

    setError("");
    setMessage("");
    setRegisteringCriteriaId(item.id);
    setRegisterForm({
      title: `Hồ sơ tiêu chí ${item.code}`,
      periodYear: new Date().getFullYear(),
    });
  };

  const toggleCriteriaDetail = (itemId) => {
    setExpandedCriteriaId((current) => (current === itemId ? null : itemId));
    setRegisteringCriteriaId((current) => (current === itemId ? current : null));
  };

  const cancelRegisterForm = () => {
    setRegisteringCriteriaId(null);
    setRegisterForm({
      title: "",
      periodYear: new Date().getFullYear(),
    });
  };

  const submitRegisterForm = async (item) => {
    if (!canCreateNomination) {
      return;
    }

    const title = registerForm.title.trim();
    const periodYear = Number(registerForm.periodYear);

    if (!title) {
      setError("Vui lòng nhập tên hồ sơ.");
      return;
    }

    if (!Number.isInteger(periodYear) || periodYear < 2020) {
      setError("Năm không hợp lệ.");
      return;
    }

    setError("");
    setMessage("");
    setCreatingCriteriaId(item.id);

    try {
      await api.post("/nominations", {
        title,
        periodYear,
        items: [
          {
            criteriaId: item.id,
            selfPoint: 0,
            evidence: "",
          },
        ],
      });
      setMessage(`Đã tạo hồ sơ thi đua cho tiêu chí ${item.code}.`);
      cancelRegisterForm();
    } catch (err) {
      setError(err?.response?.data?.message || "Không tạo được hồ sơ cho tiêu chí này.");
    } finally {
      setCreatingCriteriaId(null);
    }
  };

  const grouped = ["DONVI", "KHOA", "TRUONG"].map((level) => ({
    level,
    items: list.filter((item) => item.reviewLevel === level),
  }));

  return (
    <div className="page-grid">
      {error ? <div className="card error-message">{error}</div> : null}
      {message ? <div className="card">{message}</div> : null}
      {canEdit ? (
        <form className="card form-card" onSubmit={addCriteria}>
          <h2>Thêm tiêu chí theo cấp duyệt</h2>
          <div className="form-grid">
            <label className="field-group">
              <span>Mã tiêu chí</span>
              <input
                placeholder="Ví dụ: DV_MINHCHUNG"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                maxLength="30"
                required
              />
            </label>

            <label className="field-group">
              <span>Điểm tối đa</span>
              <input
                type="number"
                placeholder="Ví dụ: 10"
                value={form.maxPoint}
                onChange={(e) => setForm({ ...form, maxPoint: e.target.value })}
                min="1"
                required
              />
            </label>

            <label className="field-group">
              <span>Đối tượng</span>
              <select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}>
                <option value="SINHVIEN">Sinh viên</option>
                <option value="GIANGVIEN">Giảng viên</option>
              </select>
            </label>

            <label className="field-group">
              <span>Cấp xét duyệt</span>
              <select value={form.reviewLevel} onChange={(e) => setForm({ ...form, reviewLevel: e.target.value })}>
                <option value="DONVI">{levelLabels.DONVI}</option>
                <option value="KHOA">{levelLabels.KHOA}</option>
                <option value="TRUONG">{levelLabels.TRUONG}</option>
              </select>
            </label>

            <label className="field-group form-span-2">
              <span>Tên tiêu chí</span>
              <input
                placeholder="Ví dụ: Hồ sơ đầy đủ minh chứng cho từng tiêu chí"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength="140"
                required
              />
            </label>

            <label className="field-group form-span-2">
              <span>Mô tả / điều kiện kiểm tra</span>
              <textarea
                rows="3"
                placeholder="Mô tả cách cán bộ kiểm tra tiêu chí ở cấp này"
                value={form.description}
                maxLength="700"
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
          </div>

          <div className="form-actions">
            <button type="submit">Lưu tiêu chí</button>
          </div>
        </form>
      ) : null}

      {grouped.map((group) => (
        <div className="card" key={group.level}>
          <h2>{levelLabels[group.level]}</h2>
          {group.items.length === 0 ? <p>Chưa có tiêu chí cho cấp này.</p> : null}
          {group.items.length ? (
            <table>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tiêu chí</th>
                  <th>Đối tượng</th>
                  <th>Điểm tối đa</th>
                  {user.role === "ADMIN" ? <th>Thao tác</th> : null}
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>
                      <div className="criteria-title-row">
                        <button
                          type="button"
                          className="criteria-detail-trigger"
                          onClick={() => toggleCriteriaDetail(item.id)}
                          aria-expanded={expandedCriteriaId === item.id}
                        >
                          {item.title}
                        </button>
                      </div>
                      {expandedCriteriaId === item.id ? (
                        <div className="criteria-detail-panel">
                          <div className="criteria-detail-grid">
                            <div><small><strong>Điều kiện xét:</strong> {item.description || "Hoàn thành đầy đủ yêu cầu của tiêu chí và có minh chứng hợp lệ."}</small></div>
                            <div><small><strong>Điểm tối đa:</strong> {item.maxPoint}</small></div>
                            <div><small><strong>Đối tượng:</strong> {targetLabels[item.target] || item.target}</small></div>
                            <div><small><strong>Cấp xét duyệt:</strong> {levelLabels[item.reviewLevel]}</small></div>
                          </div>
                          <div>
                            <small><strong>Ý nhỏ để chấm:</strong></small>
                            {item.subItems?.length ? (
                              <ul>
                                {item.subItems.map((subItem) => (
                                  <li key={subItem.id}>
                                    {subItem.title} ({subItem.maxPoint} điểm)
                                    {canEdit ? (
                                      <button
                                        type="button"
                                        className="danger sm"
                                        onClick={() => removeSubItem(subItem.id)}
                                      >
                                        Xóa
                                      </button>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <small>Chưa có ý nhỏ. Nếu để trống, hệ thống sẽ chấm theo tiêu chí lớn.</small>
                            )}
                          </div>
                          {canEdit ? (
                            <div className="criteria-register-form">
                              <label className="field-group">
                                <span>Tên ý nhỏ</span>
                                <input
                                  value={subItemForms[item.id]?.title || ""}
                                  onChange={(e) =>
                                    setSubItemForms((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        title: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Ví dụ: Chất lượng minh chứng"
                                />
                              </label>
                              <label className="field-group">
                                <span>Điểm tối đa</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={subItemForms[item.id]?.maxPoint || ""}
                                  onChange={(e) =>
                                    setSubItemForms((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        maxPoint: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                              {getSubItemPointWarning(item) ? (
                                <small className="field-warning form-span-2">{getSubItemPointWarning(item)}</small>
                              ) : null}
                              <div className="criteria-register-actions">
                                <button
                                  type="button"
                                  className="sm"
                                  onClick={() => addSubItem(item.id)}
                                  disabled={savingSubItemForCriteriaId === item.id || Boolean(getSubItemPointWarning(item))}
                                >
                                  {savingSubItemForCriteriaId === item.id ? "Đang lưu..." : "Thêm ý nhỏ"}
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {canCreateNomination && item.target === userTarget ? (
                            registeringCriteriaId === item.id ? (
                              <div className="criteria-register-form">
                                <label className="field-group">
                                  <span>Tên hồ sơ</span>
                                  <input
                                    value={registerForm.title}
                                    onChange={(e) => setRegisterForm({ ...registerForm, title: e.target.value })}
                                    placeholder="Nhập tên hồ sơ thi đua"
                                    maxLength="150"
                                  />
                                </label>

                                <label className="field-group">
                                  <span>Năm</span>
                                  <input
                                    type="number"
                                    value={registerForm.periodYear}
                                    onChange={(e) => setRegisterForm({ ...registerForm, periodYear: e.target.value })}
                                    min="2020"
                                  />
                                </label>

                                <div className="criteria-register-actions">
                                  <button
                                    type="button"
                                    className="sm"
                                    onClick={() => submitRegisterForm(item)}
                                    disabled={creatingCriteriaId === item.id}
                                  >
                                    {creatingCriteriaId === item.id ? "Đang tạo..." : "Tạo hồ sơ"}
                                  </button>
                                  <button
                                    type="button"
                                    className="sm danger"
                                    onClick={cancelRegisterForm}
                                    disabled={creatingCriteriaId === item.id}
                                  >
                                    Hủy
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="text-action"
                                onClick={() => openRegisterForm(item)}
                                disabled={creatingCriteriaId === item.id}
                              >
                                Đăng ký tiêu chí này
                              </button>
                            )
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    <td>{targetLabels[item.target] || item.target}</td>
                    <td>{item.maxPoint}</td>
                    {user.role === "ADMIN" ? (
                      <td>
                        <button className="danger" onClick={() => removeCriteria(item.id)}>
                          Xóa
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ))}
    </div>
  );
}
