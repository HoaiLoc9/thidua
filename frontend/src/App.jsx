import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import api from "./api/client";
import ProtectedRoute from "./components/ProtectedRoute";
import RuleBasedChatbot from "./components/RuleBasedChatbot";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import CriteriaPage from "./pages/CriteriaPage";
import NominationsPage from "./pages/NominationsPage";
import ReviewsPage from "./pages/ReviewsPage";
import UsersPage from "./pages/UsersPage";
import ProfilePage from "./pages/ProfilePage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import AwardsPage from "./pages/AwardsPage";
import ReportsPage from "./pages/ReportsPage";
import NotificationsPage from "./pages/NotificationsPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import "./App.css";
// import logo from "./public/logo.png";

function MainLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved === "true";
  });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const loadUnreadCount = async () => {
    try {
      const { data } = await api.get("/notifications");
      const unread = data.filter((n) => n.status !== "READ").length;
      setUnreadCount(unread);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", newState);
  };

  const menuItems = [
    { path: "/", label: "Bảng điều khiển", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { path: "/criteria", label: "Tiêu chí", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
    { path: "/awards", label: "Danh hiệu & Khen thưởng", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
    { path: "/nominations", label: "Hồ sơ", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  ];

  const adminItems = [
    { path: "/reviews", label: "Xét duyệt", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
    { path: "/reports", label: "Báo cáo", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
    { path: "/settings", label: "Quản trị hệ thống", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
    { path: "/users", label: "Người dùng", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  ];

  return (
    <div className={`layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <header className="top-header">
        <div className="header-brand">
          <img src="/logo.png" alt="Logo hệ thống thi đua" className="header-logo" />
        </div>
        <div className="header-title">
          <h2>RES IUH</h2>
          <p>Hệ thống thi đua</p>
        </div>
        <div className="header-actions">
          <Link to="/notifications" className="notification-icon" title="Thông báo">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </Link>
          <div className="profile-menu">
            <button
              type="button"
              className="user-logo"
              title="Tài khoản"
              onClick={() => setProfileMenuOpen((value) => !value)}
            >
              <div className="avatar-circle">
                {(user.fullName || user.email || "U").charAt(0).toUpperCase()}
              </div>
            </button>
            {profileMenuOpen ? (
              <div className="profile-dropdown">
                <Link to="/profile" onClick={() => setProfileMenuOpen(false)}>
                  Thông tin cá nhân
                </Link>
                <Link to="/change-password" onClick={() => setProfileMenuOpen(false)}>
                  Đổi mật khẩu
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    logout();
                  }}
                >
                  Đăng xuất
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <button className="sidebar-toggle" onClick={toggleSidebar} title={sidebarCollapsed ? "Mở rộng" : "Thu gọn"}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarCollapsed ? (
              <path d="M9 18l6-6-6-6" />
            ) : (
              <path d="M15 18l-6-6 6-6" />
            )}
          </svg>
        </button>
        <nav>
          {menuItems.map((item) => (
            <Link key={item.path} to={item.path} className={`nav-item ${location.pathname === item.path ? "active" : ""}`} title={sidebarCollapsed ? item.label : undefined}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
          {["CANBO", "HOIDONG", "ADMIN"].includes(user.role) && (
            <>
              <div className="nav-divider"><span>Quản lý</span></div>
              {adminItems.slice(0, 2).map((item) => (
                <Link key={item.path} to={item.path} className={`nav-item ${location.pathname === item.path ? "active" : ""}`} title={sidebarCollapsed ? item.label : undefined}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={item.icon} />
                  </svg>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              ))}
            </>
          )}
          {user.role === "ADMIN" && (
            <>
              <div className="nav-divider"><span>Hệ thống</span></div>
              {adminItems.slice(2).map((item) => (
                <Link key={item.path} to={item.path} className={`nav-item ${location.pathname === item.path ? "active" : ""}`} title={sidebarCollapsed ? item.label : undefined}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={item.icon} />
                  </svg>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              ))}
            </>
          )}
        </nav>
        <button onClick={logout} className="logout-btn" title={sidebarCollapsed ? "Đăng xuất" : undefined}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          {!sidebarCollapsed && <span>Đăng xuất</span>}
        </button>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/criteria" element={<CriteriaPage />} />
          <Route path="/awards" element={<AwardsPage />} />
          <Route path="/nominations" element={<NominationsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route
            path="/reviews"
            element={
              <ProtectedRoute roles={["ADMIN", "CANBO", "HOIDONG"]}>
                <ReviewsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute roles={["ADMIN", "CANBO", "HOIDONG"]}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <RuleBasedChatbot />
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
