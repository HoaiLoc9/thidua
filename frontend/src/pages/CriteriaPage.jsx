import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const initialForm = {
  code: "",
  title: "",
  description: "",
  maxPoint: 10,
};

export default function CriteriaPage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canEdit = ["ADMIN", "CANBO", "HOIDONG"].includes(user?.role);

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
      setError(err?.response?.data?.error || "Không lưu được tiêu chí. Kiểm tra lại dữ liệu hoặc quyền đăng nhập.");
    }
  };

  const removeCriteria = async (id) => {
    await api.delete(`/criteria/${id}`);
    load();
  };

  return (
    <div className="page-grid">
      {error ? <div className="card error-message">{error}</div> : null}
      {message ? <div className="card">{message}</div> : null}
      {canEdit ? (
        <form className="card form-card" onSubmit={addCriteria}>
          <h2>Thêm tiêu chí</h2>
          <div className="form-grid">
            <label className="field-group">
              <span>Mã tiêu chí</span>
              <input
                placeholder="Ví dụ: NCKH"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                maxLength="20"
                required
              />
              <small>Mã ngắn để định danh tiêu chí trong hệ thống. (Tối đa 20 ký tự)</small>
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
              <small>Tổng điểm cao nhất được phép chấm cho tiêu chí này.</small>
            </label>

            <label className="field-group form-span-2">
              <span>Tên tiêu chí</span>
              <input
                placeholder="Ví dụ: Nghiên cứu khoa học"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength="100"
                required
              />
              <small>Tên hiển thị trên danh mục và hồ sơ xét duyệt. (Tối đa 100 ký tự)</small>
            </label>

            <label className="field-group form-span-2">
              <span>Mô tả</span>
              <textarea
                rows="3"
                placeholder="Mô tả ngắn về tiêu chí này"
                value={form.description}
                maxLength="500"
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <small>Mô tả chi tiết tiêu chí này. (Tối đa 500 ký tự)</small>
            </label>
          </div>

          <div className="form-actions">
            <button type="submit">Lưu tiêu chí</button>
          </div>
        </form>
      ) : null}

      <div className="card">
        <h2>Danh mục tiêu chí</h2>
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tiêu chí</th>
              <th>Điểm tối đa</th>
              {user.role === "ADMIN" ? <th>Thao tác</th> : null}
            </tr>
          </thead>
          <tbody>
            {list.map((item) => (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td>{item.title}</td>
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
      </div>
    </div>
  );
}
