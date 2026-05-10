function notFound(req, res) {
  return res.status(404).json({ message: "Khong tim thay endpoint" });
}

function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.name === "ZodError") {
    return res.status(400).json({
      message: "Du lieu khong hop le",
      errors: err.issues,
    });
  }

  return res.status(500).json({ message: "Loi he thong" });
}

module.exports = {
  notFound,
  errorHandler,
};
