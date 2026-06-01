const DEFAULT_ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const buckets = new Map();

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  return next();
}

function corsOptions() {
  const allowedOrigins = parseOrigins(process.env.CORS_ORIGIN || process.env.FRONTEND_URL);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Nguồn truy cập không được phép bởi CORS"));
    },
    methods: DEFAULT_ALLOWED_METHODS,
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  };
}

function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.originalUrl.split("?")[0]}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ message });
    }

    return next();
  };
}

function blockPublicUploads(req, res, next) {
  if (req.path.startsWith("/uploads/")) {
    return res.status(403).json({
      message: "Không được truy cập trực tiếp thư mục minh chứng. Vui lòng tải file qua chức năng của hệ thống.",
    });
  }
  return next();
}

module.exports = {
  blockPublicUploads,
  corsOptions,
  rateLimit,
  securityHeaders,
};
