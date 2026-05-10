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

  const canManage = ["ADMIN", "HOIDONG"].includes(user.role);

  const load = async () => {
    const { data } = await api.get("/awards");
    setAwards(data);
  };

  useEffect(() => {
    load();
  }, []);

  const createAward = async (e) => {
    e.preventDefault();
    await api.post("/awards", { ...form, periodYear: Number(form.periodYear) });
    setForm(initialForm);
    load();
  };

  return (
    <div className="page-grid">
      {canManage ? (
        <form className="card form-card" onSubmit={createAward}>
          <h2>Quản lý danh hiệu/khen thưởng</h2>
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
              <small>Mã ngắn để định danh danh hiệu/khen thưởng. (Tối đa 30 ký tự)</small>
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
              <span>Tên</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Lao động tiên tiến"
                maxLength="100"
                required
              />
              <small>Tên hiển thị khi chọn danh hiệu/khen thưởng. (Tối đa 100 ký tự)</small>
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
                placeholder="Mô tả ngắn về danh hiệu/khen thưởng"
              />
              <small>Mô tả chi tiết. (Tối đa 500 ký tự)</small>
            </label>
          </div>

          <div className="form-actions">
            <button type="submit">Thêm danh mục</button>
          </div>
        </form>
      ) : null}

      <div className="card">
        <h2>Danh mục danh hiệu thi đua</h2>
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Loại</th>
              <th>Năm học</th>
            </tr>
          </thead>
          <tbody>
            {awards.map((a) => (
              <tr key={a.id}>
                <td>{a.code}</td>
                <td>{a.name}</td>
                <td>{a.category}</td>
                <td>{a.periodYear}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
