import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import "../styles/DashboardPage.css";

const roleLabels = {
  ADMIN: "Quản trị hệ thống",
  CANBO: "Cán bộ xét duyệt",
  HOIDONG: "Hội đồng thi đua",
  GIANGVIEN: "Giảng viên",
  SINHVIEN: "Sinh viên",
};

const statusLabels = {
  DRAFT: "Nháp",
  SUBMITTED: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const isApplicant = ["GIANGVIEN", "SINHVIEN"].includes(user.role);
  const isAdmin = user.role === "ADMIN";

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/system/dashboard");
      setDashboard(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user.role]);

  const triggerScanPending = async () => {
    try {
      setScanning(true);
      await api.post("/system/scan-pending-evidence");
      await load();
      alert("Đã kích hoạt quét lại file chờ quét.");
    } catch (error) {
      alert(error.response?.data?.message || "Không thể quét lại lúc này.");
    } finally {
      setScanning(false);
    }
  };

  const todayText = useMemo(() => {
    return new Intl.DateTimeFormat("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date());
  }, []);

  const maxStatus = Math.max(...(dashboard?.statusChart || []).map((item) => item.total), 1);
  const kpis = dashboard?.kpis || {};

  const primaryAction = isApplicant
    ? { label: "Xem hồ sơ của tôi", path: "/nominations" }
    : user.role === "HOIDONG"
      ? { label: "Vào biểu quyết", path: "/reviews" }
      : user.role === "CANBO"
        ? { label: "Xem hồ sơ chờ duyệt", path: "/reviews" }
        : { label: "Theo dõi vận hành", path: "/reports" };

  if (loading && !dashboard) {
    return <div className="card">Đang tải dashboard...</div>;
  }

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span>{todayText}</span>
          <h2>Xin chào, {user.fullName}</h2>
          <p>{roleLabels[user.role] || user.role} · {user.department || "Chưa cập nhật đơn vị"}</p>
        </div>
        <div className="dashboard-hero-actions">
          <button type="button" onClick={() => navigate(primaryAction.path)}>
            {primaryAction.label}
          </button>
          {isApplicant ? (
            <button type="button" className="secondary" onClick={() => navigate("/nominations")}>
              Tạo hồ sơ
            </button>
          ) : (
            <button type="button" className="secondary" onClick={() => navigate("/reports")}>
              Báo cáo
            </button>
          )}
        </div>
      </section>

      <section className="dashboard-kpi-grid">
        <button className="dashboard-kpi" type="button" onClick={() => navigate("/nominations")}>
          <span>Tổng hồ sơ</span>
          <strong>{kpis.totalNominations ?? 0}</strong>
          <small>Không tính hồ sơ đã lưu trữ</small>
        </button>
        <button className="dashboard-kpi submitted" type="button" onClick={() => navigate("/nominations?status=SUBMITTED")}>
          <span>{isApplicant ? "Đang chờ duyệt" : "Cần xử lý"}</span>
          <strong>{isApplicant ? kpis.submitted ?? 0 : kpis.pendingTasks ?? 0}</strong>
          <small>{kpis.overdueTasks ?? 0} phiên quá hạn</small>
        </button>
        <button className="dashboard-kpi approved" type="button" onClick={() => navigate("/nominations?status=APPROVED")}>
          <span>Đã duyệt</span>
          <strong>{kpis.approved ?? 0}</strong>
          <small>{kpis.rejected ?? 0} hồ sơ bị từ chối</small>
        </button>
        <button className="dashboard-kpi warning" type="button" onClick={() => navigate(isAdmin ? "/reports" : "/notifications")}>
          <span>{isAdmin ? "An toàn minh chứng" : "Thông báo mới"}</span>
          <strong>{isAdmin ? kpis.evidencePending ?? 0 : dashboard?.recentNotifications?.filter((item) => item.status !== "READ").length ?? 0}</strong>
          <small>{isAdmin ? `${kpis.evidenceScanError ?? 0} lỗi quét, ${kpis.evidenceInfected ?? 0} nhiễm` : "Thông báo chưa đọc"}</small>
        </button>
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-panel todo-panel">
          <div className="panel-title">
            <h3>Việc cần làm</h3>
            <span>{dashboard?.todoItems?.length || 0} mục</span>
          </div>
          {dashboard?.todoItems?.length ? (
            <div className="todo-list">
              {dashboard.todoItems.map((item) => (
                <button type="button" key={`${item.label}-${item.path}`} onClick={() => navigate(item.path)}>
                  <strong>{item.count}</strong>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-dashboard-state">Không có việc cần xử lý.</p>
          )}
        </div>

        <div className="dashboard-panel chart-panel">
          <div className="panel-title">
            <h3>Trạng thái hồ sơ</h3>
            <span>Mini chart</span>
          </div>
          <div className="status-mini-chart">
            {(dashboard?.statusChart || []).map((item) => (
              <div className="status-chart-row" key={item.status}>
                <div>
                  <span>{statusLabels[item.status] || item.status}</span>
                  <strong>{item.total}</strong>
                </div>
                <div className="status-track">
                  <div
                    className={`status-fill ${String(item.status).toLowerCase()}`}
                    style={{ width: `${Math.max((item.total / maxStatus) * 100, item.total ? 8 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-main-grid wide-left">
        <div className="dashboard-panel">
          <div className="panel-title">
            <h3>Hồ sơ gần đây</h3>
            <button type="button" className="text-action" onClick={() => navigate("/nominations")}>Xem tất cả</button>
          </div>
          <div className="recent-nomination-list">
            {(dashboard?.recentNominations || []).map((item) => (
              <button type="button" key={item.id} onClick={() => navigate(`/nominations?title=${encodeURIComponent(item.title)}`)}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.awardType?.name || "Chưa chọn danh hiệu"} · {item.applicant?.fullName || "-"}</span>
                </div>
                <div>
                  <b>{item.totalSelfPoint}</b>
                  <small>{statusLabels[item.status] || item.status}</small>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="panel-title">
            <h3>Thông báo mới</h3>
            <button type="button" className="text-action" onClick={() => navigate("/notifications")}>Mở</button>
          </div>
          <div className="dashboard-notification-list">
            {(dashboard?.recentNotifications || []).map((item) => (
              <div key={item.id} className={item.status === "READ" ? "" : "unread"}>
                <p>{item.message}</p>
                <small>{item.status === "READ" ? "Đã đọc" : "Chưa đọc"}</small>
              </div>
            ))}
            {!dashboard?.recentNotifications?.length ? (
              <p className="empty-dashboard-state">Chưa có thông báo.</p>
            ) : null}
          </div>
        </div>
      </section>

      {isAdmin ? (
        <section className="dashboard-main-grid">
          <div className="dashboard-panel security-panel">
            <div className="panel-title">
              <h3>Bảo mật minh chứng</h3>
              <button type="button" onClick={triggerScanPending} disabled={scanning}>
                {scanning ? "Đang quét..." : "Quét lại"}
              </button>
            </div>
            <div className="security-grid">
              <div><span>Chờ quét</span><strong>{kpis.evidencePending ?? 0}</strong></div>
              <div><span>Lỗi quét</span><strong>{kpis.evidenceScanError ?? 0}</strong></div>
              <div><span>Nhiễm mã độc</span><strong>{kpis.evidenceInfected ?? 0}</strong></div>
              <div><span>Đã lưu trữ</span><strong>{kpis.archivedCount ?? 0}</strong></div>
            </div>
            <ul className="pending-evidence-list">
              {(dashboard?.adminSecurity?.pendingEvidenceRows || []).map((item) => (
                <li key={item.id}>
                  {item.nomination?.title || `Hồ sơ #${item.nominationId}`} · {item.nomination?.applicant?.fullName || "-"}
                </li>
              ))}
            </ul>
          </div>

          <div className="dashboard-panel audit-panel">
            <div className="panel-title">
              <h3>Audit gần đây</h3>
              <span>Admin</span>
            </div>
            <div className="audit-list">
              {(dashboard?.recentAuditLogs || []).map((item) => (
                <div key={item.id}>
                  <strong>{item.action}</strong>
                  <span>{item.description || "-"}</span>
                  <small>{item.user?.fullName || item.user?.email || "-"} · {new Date(item.timestamp).toLocaleString("vi-VN")}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
