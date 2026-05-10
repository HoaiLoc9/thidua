import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [myCount, setMyCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (["GIANGVIEN", "SINHVIEN"].includes(user.role)) {
        const { data } = await api.get("/nominations");
        setMyCount(data.length);
      } else {
        const { data } = await api.get("/reviews/stats");
        setStats(data);
      }
    };
    load();
  }, [user.role]);

  return (
    <div className="page-grid">
      <div className="card">
        <h2>Xin chào, {user.fullName}</h2>
        <p>Vai trò: {user.role}</p>
        <p>Đơn vị: {user.department || "Chưa cập nhật"}</p>
      </div>

      {["GIANGVIEN", "SINHVIEN"].includes(user.role) ? (
        <div className="card stat-card">
          <h3>Hồ sơ của tôi</h3>
          <strong>{myCount}</strong>
        </div>
      ) : (
        <div className="stat-row">
          <div className="card stat-card" style={{cursor: 'pointer'}} onClick={() => navigate('/nominations?status=DRAFT')}>
            <h3>Nháp</h3>
            <strong>{stats?.draft ?? 0}</strong>
          </div>
          <div className="card stat-card" style={{ cursor: "pointer" }} onClick={() => navigate('/nominations?status=SUBMITTED')}>
            <h3>Đã nộp</h3>
            <strong>{stats?.submitted ?? 0}</strong>
          </div>
          <div className="card stat-card" style={{ cursor: "pointer" }} onClick={() => navigate('/nominations?status=APPROVED')}>
            <h3>Đã duyệt</h3>
            <strong>{stats?.approved ?? 0}</strong>
          </div>
          <div className="card stat-card" style={{ cursor: "pointer" }} onClick={() => navigate('/nominations?status=REJECTED')}>
            <h3>Từ chối</h3>
            <strong>{stats?.rejected ?? 0}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
