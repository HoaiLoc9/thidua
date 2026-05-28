import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [ops, setOps] = useState(null);
  const [myCount, setMyCount] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [pendingEvidence, setPendingEvidence] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (["GIANGVIEN", "SINHVIEN"].includes(user.role)) {
        const { data } = await api.get("/nominations");
        setMyCount(data.length);
      } else {
        const [{ data: reviewStats }, { data: opsSummary }] = await Promise.all([
          api.get("/reviews/stats"),
          api.get("/system/ops-summary"),
        ]);
        setStats(reviewStats);
        setOps(opsSummary);
        if (user.role === "ADMIN") {
          const { data: pendingEvidenceData } = await api.get("/system/pending-evidence");
          setPendingEvidence(pendingEvidenceData);
        }
      }
    };
    load();
  }, [user.role]);

  const triggerScanPending = async () => {
    try {
      setScanning(true);
      await api.post("/system/scan-pending-evidence");
      const [{ data }, { data: pendingEvidenceData }] = await Promise.all([
        api.get("/system/ops-summary"),
        api.get("/system/pending-evidence"),
      ]);
      setOps(data);
      setPendingEvidence(pendingEvidenceData);
      alert("Đã kích hoạt quét lại file chờ quét.");
    } catch (error) {
      alert(error.response?.data?.message || "Không thể quét lại lúc này.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="page-grid">
      <div className="card">
        <h2>Xin chào, {user.fullName}</h2>
        <p>Vai trò: {user.role}</p>
        <p>Đơn vị: {user.department || "Chưa cập nhật"}</p>
      </div>

      {["GIANGVIEN", "SINHVIEN"].includes(user.role) ? (
        <div className="card stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/nominations")}>
          <h3>Hồ sơ của tôi</h3>
          <strong>{myCount}</strong>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="card stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/nominations?status=SUBMITTED")}>
              <h3>Đã nộp</h3>
              <strong>{stats?.submitted ?? 0}</strong>
            </div>
            <div className="card stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/nominations?status=APPROVED")}>
              <h3>Đã duyệt</h3>
              <strong>{stats?.approved ?? 0}</strong>
            </div>
            <div className="card stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/nominations?status=REJECTED")}>
              <h3>Từ chối</h3>
              <strong>{stats?.rejected ?? 0}</strong>
            </div>
          </div>

          <div className="stat-row">
            <div className="card stat-card">
              <h3>Review quá hạn</h3>
              <strong>{ops?.overdueReviews ?? 0}</strong>
            </div>
            <div className="card stat-card">
              <h3>File chờ quét</h3>
              <strong>{ops?.evidencePending ?? 0}</strong>
            </div>
            <div className="card stat-card">
              <h3>File nhiễm mã độc</h3>
              <strong>{ops?.evidenceInfected ?? 0}</strong>
            </div>
          </div>

          {user.role === "ADMIN" ? (
            <div className="card">
              <button type="button" onClick={triggerScanPending} disabled={scanning}>
                {scanning ? "Đang quét..." : "Quét lại file chờ quét"}
              </button>
              {pendingEvidence.length ? (
                <div style={{ marginTop: 12 }}>
                  <strong>File đang chờ quét:</strong>
                  <ul>
                    {pendingEvidence.slice(0, 10).map((evidence) => (
                      <li key={evidence.id}>
                        {evidence.nomination?.title || `Hồ sơ #${evidence.nominationId}`} - {evidence.nomination?.applicant?.fullName || "N/A"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p style={{ marginTop: 12 }}>Không có file chờ quét.</p>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
