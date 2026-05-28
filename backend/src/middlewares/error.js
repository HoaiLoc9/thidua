function notFound(req, res) {
  return res.status(404).json({ message: "Khong tim thay endpoint" });
}

function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.status && err.message) {
    return res.status(err.status).json({ message: err.message });
  }

  if (err.name === "ZodError") {
    return res.status(400).json({
      message: "Du lieu khong hop le",
      errors: err.issues,
    });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Kich thuoc tep toi da la 10MB" });
  }

  if (err.code === "P2002") {
    const fields = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : "du lieu";
    return res.status(409).json({
      message: `Gia tri ${fields} da ton tai`,
    });
  }

  return res.status(500).json({ message: "Loi he thong" });
}

module.exports = {
  notFound,
  errorHandler,
};
