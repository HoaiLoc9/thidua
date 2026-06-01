import { useEffect, useState } from "react";
import api from "../api/client";

const processTemplate = {
  processName: "",
  description: "",
  steps: [
    { stepOrder: 1, role: "CANBO", description: "Duyệt cấp khoa" },
    { stepOrder: 2, role: "HOIDONG", description: "Phê duyệt cấp trường" },
  ],
};

export default function AdminSettingsPage() {
  const [departments, setDepartments] = useState([]);
  const [years, setYears] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [departmentForm, setDepartmentForm] = useState({ departmentName: "", departmentType: "KHOA" });
  const [yearForm, setYearForm] = useState({ yearName: "", startDate: "", endDate: "" });
  const [processForm, setProcessForm] = useState(processTemplate);
  const [message, setMessage] = useState("");

  const load = async () => {
    const [depRes, yearRes, processRes] = await Promise.all([
      api.get("/departments"),
      api.get("/academic-years"),
      api.get("/approval-process"),
    ]);
    setDepartments(depRes.data);
    setYears(yearRes.data);
    setProcesses(processRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const addDepartment = async (e) => {
    e.preventDefault();
    await api.post("/departments", departmentForm);
    setDepartmentForm({ departmentName: "", departmentType: "KHOA" });
    load();
  };

  const addYear = async (e) => {
    e.preventDefault();
    await api.post("/academic-years", yearForm);
    setYearForm({ yearName: "", startDate: "", endDate: "" });
    load();
  };

  const saveProcess = async (e) => {
    e.preventDefault();
    if (processes.length) {
      await api.put(`/approval-process/${processes[0].id}`, processForm);
    } else {
      await api.post("/approval-process", processForm);
    }
    setMessage("Đã lưu cấu hình quy trình xét duyệt");
    load();
  };

  const backup = async () => {
    const { data } = await api.post("/system/backup");
    setMessage(`Đã sao lưu dữ liệu: ${data.filename}`);
  };

  return (
    <div className="page-grid">
      <div className="card">
        <h2>Quản lý đơn vị</h2>
        <form className="page-grid" onSubmit={addDepartment}>
          <input
            placeholder="Tên đơn vị"
            value={departmentForm.departmentName}
            onChange={(e) => setDepartmentForm({ ...departmentForm, departmentName: e.target.value })}
            required
          />
          <input
            placeholder="Loại đơn vị"
            value={departmentForm.departmentType}
            onChange={(e) => setDepartmentForm({ ...departmentForm, departmentType: e.target.value })}
            required
          />
          <button type="submit">Thêm đơn vị</button>
        </form>
        <ul>
          {departments.map((d) => (
            <li key={d.id}>{d.departmentName} - {d.departmentType}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Quản lý năm học</h2>
        <form className="page-grid" onSubmit={addYear}>
          <label className="field-group">
            <span>Tên năm học</span>
            <input
              placeholder="Ví dụ: 2025-2026"
              value={yearForm.yearName}
              onChange={(e) => setYearForm({ ...yearForm, yearName: e.target.value })}
              required
            />
            
          </label>
          <label className="field-group">
            <span>Ngày bắt đầu năm học</span>
            <input
              type="date"
              value={yearForm.startDate}
              onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
              required
            />
            
          </label>
          <label className="field-group">
            <span>Ngày kết thúc năm học</span>
            <input
              type="date"
              value={yearForm.endDate}
              onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
              required
            />
            
          </label>
          <button type="submit">Thêm năm học</button>
        </form>
        <ul>
          {years.map((y) => (
            <li key={y.id}>
              {y.yearName}
              {y.startDate && y.endDate ? ` (${new Date(y.startDate).getFullYear()}-${new Date(y.endDate).getFullYear()})` : ""}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Cấu hình quy trình xét duyệt</h2>
        <form className="page-grid" onSubmit={saveProcess}>
          <input
            placeholder="Tên quy trình"
            value={processForm.processName}
            onChange={(e) => setProcessForm({ ...processForm, processName: e.target.value })}
            required
          />
          <input
            placeholder="Mô tả"
            value={processForm.description}
            onChange={(e) => setProcessForm({ ...processForm, description: e.target.value })}
          />
          <button type="submit">Lưu quy trình</button>
        </form>
      </div>

      <div className="card">
        <h2>Sao lưu dữ liệu</h2>
        <button onClick={backup}>Thực hiện sao lưu</button>
      </div>

      {message ? <div className="card"><p>{message}</p></div> : null}
    </div>
  );
}
