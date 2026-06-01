const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middlewares/error");
const { blockPublicUploads, corsOptions, rateLimit, securityHeaders } = require("./middlewares/security");

const app = express();

app.use(securityHeaders);
app.use(cors(corsOptions()));
app.use(blockPublicUploads);
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  message: "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.",
});

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.UPLOAD_RATE_LIMIT_MAX || 20),
  message: "Bạn tải file quá nhiều lần. Vui lòng thử lại sau.",
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth/change-password/otp", authLimiter);
app.use("/api/nominations/upload-evidence", uploadLimiter);
app.use("/api/nominations/:id/evidences", uploadLimiter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
