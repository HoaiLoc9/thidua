import api from "../api/client";

export async function downloadEvidence(evidenceId, fallbackName = "minh-chung") {
  if (!evidenceId) {
    return;
  }

  const response = await api.get(`/nominations/evidences/${evidenceId}/download`, {
    responseType: "blob",
  });

  const contentType = response.headers["content-type"] || "application/octet-stream";
  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackName;
  const blob = new Blob([response.data], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
