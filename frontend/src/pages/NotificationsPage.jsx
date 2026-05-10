import { useEffect, useState } from "react";
import api from "../api/client";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);

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

  return (
    <div className="card">
      <h2>Thông báo của tôi</h2>
      {notifications.length === 0 ? <p>Chưa có thông báo.</p> : null}
      <div className="page-grid">
        {notifications.map((item) => (
          <div className="review-card" key={item.id}>
            <p>{item.message}</p>
            <p>Trạng thái: {item.status === "READ" ? "Đã đọc" : "Chưa đọc"}</p>
            {item.status !== "READ" ? (
              <button onClick={() => markRead(item.id)}>Đánh dấu đã đọc</button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
