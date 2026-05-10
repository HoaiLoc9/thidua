import { useEffect, useState } from "react";
import api from "../api/client";

export default function ReviewsPage() {
  const [pending, setPending] = useState([]);
  const [commentById, setCommentById] = useState({});

  const load = () => api.get("/reviews/pending").then((res) => setPending(res.data));

  useEffect(() => {
    load();
  }, []);

  const decision = async (id, value) => {
    await api.post(`/reviews/${id}/decision`, {
      decision: value,
      comment: commentById[id] || "",
    });
    load();
  };

  const buildEvidenceLinks = (nomination) => {
    const fromEvidenceTable = (nomination.evidences || []).map((ev) => ev.fileUrl).filter(Boolean);
    const fromItems = (nomination.items || []).map((item) => item.evidence).filter(Boolean);
    return [...new Set([...fromEvidenceTable, ...fromItems])];
  };

  return (
    <div className="card">
      <h2>Danh sách hồ sơ chờ duyệt</h2>
      {pending.length === 0 ? <p>Không có hồ sơ chờ duyệt.</p> : null}
      {pending.map((step) => (
        <div className="review-card" key={step.id}>
          <h3>
            {step.nomination.title} - {step.level}
          </h3>
          <p>
            Người nộp: {step.nomination.applicant.fullName} | Tổng điểm: {step.nomination.totalSelfPoint}
          </p>
          <div>
            <strong>Minh chứng:</strong>
            {buildEvidenceLinks(step.nomination).length ? (
              <ul>
                {buildEvidenceLinks(step.nomination).map((url, idx) => (
                  <li key={`${step.id}-${idx}`}>
                    <a href={`http://localhost:4000${url}`} target="_blank" rel="noreferrer">
                      Tệp minh chứng #{idx + 1}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Chưa có minh chứng.</p>
            )}
          </div>
          <textarea
            placeholder="Nhận xét"
            value={commentById[step.id] || ""}
            onChange={(e) => setCommentById({ ...commentById, [step.id]: e.target.value })}
          />
          <div className="action-row">
            <button onClick={() => decision(step.id, "APPROVED")}>Duyệt</button>
            <button className="danger" onClick={() => decision(step.id, "REJECTED")}>
              Từ chối
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
