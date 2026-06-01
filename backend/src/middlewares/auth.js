const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return res.status(401).json({ message: "Người dùng không tồn tại" });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Chưa xác thực" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Không có quyền truy cập" });
    }
    return next();
  };
}

module.exports = {
  authenticate,
  authorize,
};
