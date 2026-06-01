const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate } = require("../middlewares/auth");

const router = express.Router();

router.get("/", authenticate, async (req, res, next) => {
  try {
    const list = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json(list);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/read", authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const updated = await prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { status: "READ" },
    });

    if (updated.count === 0) {
      return res.status(404).json({ message: "Không tìm thấy thông báo" });
    }

    return res.json({ message: "Đã đánh dấu đã đọc" });
  } catch (error) {
    return next(error);
  }
});

router.patch("/read-all", authenticate, async (req, res, next) => {
  try {
    const updated = await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        status: { not: "READ" },
      },
      data: { status: "READ" },
    });

    return res.json({
      message: "Đã đánh dấu tất cả thông báo là đã đọc",
      updated: updated.count,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
