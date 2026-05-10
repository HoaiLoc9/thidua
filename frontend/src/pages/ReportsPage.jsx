import { useEffect, useState } from "react";
import api from "../api/client";

export default function ReportsPage() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.get("/reports/summary").then((res) => setReport(res.data));
  }, []);

  const download = async (path, filename) => {
    const res = await api.get(path, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="page-grid">
      <div className="card">
        <h2>Báo cáo tổng hợp thi đua</h2>
        <div className="action-row">
          <button onClick={() => download("/reports/summary.csv", "thidua-summary.csv")}>Tải báo cáo CSV</button>
          <button onClick={() => download("/reports/summary.xlsx", "thidua-summary.xlsx")}>Tải báo cáo Excel</button>
          <button onClick={() => download("/reports/summary.pdf", "thidua-summary.pdf")}>Tải báo cáo PDF</button>
        </div>
      </div>

      <div className="card">
        <h3>Thống kê hồ sơ theo trạng thái</h3>
        <table>
          <thead>
            <tr>
              <th>Trạng thái</th>
              <th>Số lượng</th>
            </tr>
          </thead>
          <tbody>
            {(report?.nominationByStatus || []).map((item) => {
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

              return (
                <tr key={item.status}>
                  <td>{statusLabel(item.status)}</td>
                  <td>{item._count.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
