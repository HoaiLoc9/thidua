import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const initialForm = {
  code: "",
  name: "",
  category: "Danh hiệu thi đua",
  description: "",
  periodYear: new Date().getFullYear(),
};

export default function AwardsPage() {
  const { user } = useAuth();
  const [awards, setAwards] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canManage = ["ADMIN", "HOIDONG"].includes(user.role);

  const load = async () => {
    const { data } = await api.get("/awards");
    setAwards(data);
  };

  useEffect(() => {
    load().catch(() => setError("Không tải được danh mục danh hiệu và khen thưởng."));
  }, []);

  const createAward = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      await api.post("/awards", { ...form, periodYear: Number(form.periodYear) });
      setForm(initialForm);
      setMessage("Đã thêm danh hiệu/khen thưởng.");
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Không thêm được danh hiệu/khen thưởng.");
    }
  };

  return (
    <div className="page-grid">
      {error ? <div className="card error-message">{error}</div> : null}
      {message ? <div className="card">{message}</div> : null}

      {canManage ? (
        <form className="card form-card" onSubmit={createAward}>
          <h2>Danh hiệu & Khen thưởng</h2>
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
              <small>Mã ngắn để định danh danh hiệu/khen thưởng. Tối đa 30 ký tự.</small>
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
                placeholder="Ví dụ: Lao động tiên tiến"
                maxLength="100"
                required
              />
              <small>Tên hiển thị khi người dùng đăng ký hoặc hội đồng xét duyệt. Tối đa 100 ký tự.</small>
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

          <div className="form-actions">
            <button type="submit">Thêm danh mục</button>
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
            </tr>
          </thead>
          <tbody>
            {awards.map((award) => (
              <tr key={award.id}>
                <td>{award.code}</td>
                <td>{award.name}</td>
                <td>{award.category}</td>
                <td>{award.periodYear}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
