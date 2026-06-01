function notFound(req, res) {
  return res.status(404).json({ message: "Không tìm thấy endpoint" });
}

function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.status && err.message) {
    return res.status(err.status).json({ message: err.message });
  }

  if (err.name === "ZodError") {
    return res.status(400).json({
      message: "Dữ liệu không hợp lệ",
      errors: err.issues,
    });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Kích thước tệp tối đa là 10MB" });
  }

  if (err.code === "P2002") {
    const fields = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : "dữ liệu";
    return res.status(409).json({
      message: `Giá trị ${fields} đã tồn tại`,
    });
  }

  return res.status(500).json({ message: "Lỗi hệ thống" });
}

module.exports = {
  notFound,
  errorHandler,
};
