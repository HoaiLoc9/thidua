import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import "../styles/ReportsPage.css";

const initialFilters = {
  periodYear: "",
  status: "",
  awardTypeId: "",
  department: "",
  archived: "active",
};

const statusLabels = {
  DRAFT: "Nháp",
  SUBMITTED: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
};

const scanLabels = {
  PENDING_SCAN: "Chờ quét",
  CLEAN: "An toàn",
  INFECTED: "Nhiễm mã độc",
  SCAN_ERROR: "Lỗi quét",
};

export default function ReportsPage() {
  const [report, setReport] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/summary${queryString ? `?${queryString}` : ""}`);
      setReport(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [queryString]);

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  const download = async (path, filename) => {
    const res = await api.get(`${path}${queryString ? `?${queryString}` : ""}`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const maxStatus = Math.max(...(report?.nominationByStatus || []).map((item) => item.total), 1);
  const maxYear = Math.max(...(report?.nominationByYear || []).map((item) => item.total), 1);
  const maxAward = Math.max(...(report?.awardStats || []).map((item) => item.total), 1);

  return (
    <div className="reports-page">
      <section className="reports-hero">
        <div>
          <span>Báo cáo tổng hợp</span>
          <h2>Dashboard thi đua khen thưởng</h2>
          <p>Theo dõi hồ sơ, điểm, kết quả xét duyệt, minh chứng và hiệu quả xử lý theo thời gian thực.</p>
        </div>
        <div className="report-export-actions">
          <button onClick={() => download("/reports/summary.xlsx", "bao-cao-thi-dua.xlsx")}>Xuất Excel</button>
          <button onClick={() => download("/reports/summary.pdf", "bao-cao-thi-dua.pdf")}>Xuất PDF</button>
        </div>
      </section>

      <section className="reports-filter-panel">
        <div className="filter-field">
          <label>Năm xét</label>
          <select value={filters.periodYear} onChange={(e) => updateFilter("periodYear", e.target.value)}>
            <option value="">Tất cả năm</option>
            {(report?.filters?.years || []).map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label>Trạng thái</label>
          <select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="filter-field filter-wide">
          <label>Danh hiệu/Khen thưởng</label>
          <select value={filters.awardTypeId} onChange={(e) => updateFilter("awardTypeId", e.target.value)}>
            <option value="">Tất cả danh hiệu</option>
            {(report?.filters?.awards || []).map((award) => (
              <option key={award.id} value={award.id}>
                {award.name} - {award.category} ({award.periodYear})
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label>Đơn vị</label>
          <select value={filters.department} onChange={(e) => updateFilter("department", e.target.value)}>
            <option value="">Tất cả đơn vị</option>
            {(report?.filters?.departments || []).map((department) => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label>Lưu trữ</label>
          <select value={filters.archived} onChange={(e) => updateFilter("archived", e.target.value)}>
            <option value="active">Đang hiển thị</option>
            <option value="only">Đã lưu trữ</option>
            <option value="all">Tất cả</option>
          </select>
        </div>

        <button type="button" className="btn-reset-report" onClick={resetFilters}>
          Xóa bộ lọc
        </button>
      </section>

      {loading ? <div className="card">Đang tải dữ liệu báo cáo...</div> : null}

      <section className="report-kpi-grid">
        <div className="report-kpi primary">
          <span>Tổng hồ sơ</span>
          <strong>{report?.kpis?.totalNominations ?? 0}</strong>
          <small>{report?.kpis?.submittedCount ?? 0} hồ sơ đang chờ xử lý</small>
        </div>
        <div className="report-kpi success">
          <span>Tỷ lệ duyệt</span>
          <strong>{report?.kpis?.approvalRate ?? 0}%</strong>
          <small>{report?.kpis?.approvedCount ?? 0} hồ sơ đã duyệt</small>
        </div>
        <div className="report-kpi warning">
          <span>Điểm trung bình</span>
          <strong>{report?.kpis?.averageScore ?? 0}</strong>
          <small>Cao nhất: {report?.kpis?.maxScore ?? 0} điểm</small>
        </div>
        <div className="report-kpi danger">
          <span>Quá hạn duyệt</span>
          <strong>{report?.kpis?.overdueReviews ?? 0}</strong>
          <small>{report?.kpis?.pendingReviews ?? 0} phiên duyệt đang chờ</small>
        </div>
      </section>

      <section className="reports-grid-two">
        <div className="report-panel">
          <div className="panel-heading">
            <h3>Hồ sơ theo trạng thái</h3>
            <span>{report?.kpis?.totalNominations ?? 0} hồ sơ</span>
          </div>
          <div className="bar-list">
            {(report?.nominationByStatus || []).map((item) => (
              <div className="bar-row" key={item.status}>
                <div>
                  <strong>{item.label || statusLabels[item.status] || item.status}</strong>
                  <span>{item.total}</span>
                </div>
                <div className="bar-track">
                  <div className={`bar-fill status-${String(item.status).toLowerCase()}`} style={{ width: `${(item.total / maxStatus) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="report-panel">
          <div className="panel-heading">
            <h3>Xu hướng theo năm</h3>
            <span>Hồ sơ phát sinh</span>
          </div>
          <div className="year-chart">
            {(report?.nominationByYear || []).map((item) => (
              <div className="year-column" key={item.periodYear}>
                <div className="year-bar" style={{ height: `${Math.max((item.total / maxYear) * 100, 8)}%` }} />
                <strong>{item.total}</strong>
                <span>{item.periodYear}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="reports-grid-two">
        <div className="report-panel">
          <div className="panel-heading">
            <h3>Danh hiệu có nhiều hồ sơ</h3>
            <span>Top 10</span>
          </div>
          <div className="award-bars">
            {(report?.awardStats || []).map((item) => (
              <div className="award-bar-row" key={item.awardTypeId}>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.total} hồ sơ · TB {item.averageScore} điểm</small>
                </div>
                <div className="bar-track">
                  <div className="bar-fill award" style={{ width: `${(item.total / maxAward) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="report-panel">
          <div className="panel-heading">
            <h3>Trạng thái quét minh chứng</h3>
            <span>ClamAV</span>
          </div>
          <div className="scan-grid">
            {(report?.evidenceByScanStatus || []).map((item) => (
              <div className="scan-card" key={item.scanStatus}>
                <span>{scanLabels[item.scanStatus] || item.scanStatus}</span>
                <strong>{item.total}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="report-panel">
        <div className="panel-heading">
          <h3>Phân tích theo đơn vị</h3>
          <span>Top đơn vị có hồ sơ</span>
        </div>
        <table className="report-table">
          <thead>
            <tr>
              <th>Đơn vị</th>
              <th>Tổng hồ sơ</th>
              <th>Đã duyệt</th>
              <th>Bị từ chối</th>
              <th>Điểm TB</th>
            </tr>
          </thead>
          <tbody>
            {(report?.departmentStats || []).map((item) => (
              <tr key={item.department}>
                <td>{item.department}</td>
                <td>{item.total}</td>
                <td>{item.approved}</td>
                <td>{item.rejected}</td>
                <td>{item.averageScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="reports-grid-two">
        <div className="report-panel">
          <div className="panel-heading">
            <h3>Top hồ sơ theo điểm</h3>
            <span>Xếp hạng hiện tại</span>
          </div>
          <table className="report-table compact">
            <thead>
              <tr>
                <th>Hồ sơ</th>
                <th>Người nộp</th>
                <th>Điểm</th>
              </tr>
            </thead>
            <tbody>
              {(report?.topNominations || []).map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    <small>{item.awardType?.name || "-"}</small>
                  </td>
                  <td>{item.applicant?.fullName || "-"}</td>
                  <td>{item.totalSelfPoint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="report-panel">
          <div className="panel-heading">
            <h3>Hồ sơ cập nhật gần đây</h3>
            <span>Theo thời gian cập nhật</span>
          </div>
          <table className="report-table compact">
            <thead>
              <tr>
                <th>Hồ sơ</th>
                <th>Trạng thái</th>
                <th>Điểm</th>
              </tr>
            </thead>
            <tbody>
              {(report?.recentNominations || []).map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    <small>{item.applicant?.department || "-"}</small>
                  </td>
                  <td>{statusLabels[item.status] || item.status}</td>
                  <td>{item.totalSelfPoint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
