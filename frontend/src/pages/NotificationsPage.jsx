import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  const load = async () => {
    const { data } = await api.get("/notifications");
    setNotifications(data);
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    load();
  };

  const extractNominationTitle = (message) => {
    const idx = message.indexOf(":");
    if (idx === -1) return "";
    return message.slice(idx + 1).trim();
  };

  const buildNotificationTarget = (message) => {
    const lower = message.toLowerCase();
    const params = new URLSearchParams();
    const nominationTitle = extractNominationTitle(message);

    if (nominationTitle) {
      params.set("title", nominationTitle);
    }

    if (lower.includes("cần duyệt") || lower.includes("phiên cấp trường")) {
      params.set("status", "SUBMITTED");
    } else if (lower.includes("bị từ chối")) {
      params.set("status", "REJECTED");
    } else if (lower.includes("đã được công nhận")) {
      params.set("status", "APPROVED");
    }

    return `/nominations${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const openNotificationTarget = async (item) => {
    if (item.status !== "READ") {
      await api.patch(`/notifications/${item.id}/read`);
    }

    navigate(buildNotificationTarget(item.message));
  };

  return (
    <div className="card">
      <h2>Thông báo của tôi</h2>
      {notifications.length === 0 ? <p>Chưa có thông báo.</p> : null}
      <div className="page-grid">
        {notifications.map((item) => (
          <div
            className="review-card notification-item"
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => openNotificationTarget(item)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openNotificationTarget(item);
              }
            }}
          >
            <p>{item.message}</p>
            <p>Trạng thái: {item.status === "READ" ? "Đã đọc" : "Chưa đọc"}</p>
            {item.status !== "READ" ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markRead(item.id);
                }}
              >
                Đánh dấu đã đọc
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
