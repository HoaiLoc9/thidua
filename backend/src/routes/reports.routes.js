const express = require("express");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middlewares/auth");

const router = express.Router();

router.get("/summary", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const [nominationByStatus, usersByRole, awardsByYear] = await Promise.all([
      prisma.nomination.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.user.groupBy({
        by: ["role"],
        _count: { role: true },
      }),
      prisma.awardType.groupBy({
        by: ["periodYear"],
        _count: { periodYear: true },
        orderBy: { periodYear: "desc" },
      }),
    ]);

    return res.json({ nominationByStatus, usersByRole, awardsByYear });
  } catch (error) {
    return next(error);
  }
});

router.get("/summary.csv", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const nominationByStatus = await prisma.nomination.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    const rows = ["status,total", ...nominationByStatus.map((r) => `${r.status},${r._count.status}`)];
    const csv = rows.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=thidua-summary.csv");
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
});

router.get("/summary.xlsx", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const nominationByStatus = await prisma.nomination.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    const rows = nominationByStatus.map((item) => ({
      TrangThai: item.status,
      SoLuong: item._count.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TongHop");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=thidua-summary.xlsx");
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});

router.get("/summary.pdf", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const nominationByStatus = await prisma.nomination.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=thidua-summary.pdf");

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(18).text("Bao cao tong hop thi dua", { underline: true });
    doc.moveDown();

    nominationByStatus.forEach((item) => {
      doc.fontSize(12).text(`- ${item.status}: ${item._count.status}`);
    });

    doc.end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
