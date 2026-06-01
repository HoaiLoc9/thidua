const express = require("express");
const fs = require("fs");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middlewares/auth");

const router = express.Router();

function buildNominationWhere(query) {
  const where = {};

  if (query.status) where.status = query.status;
  if (query.periodYear) where.periodYear = Number(query.periodYear);
  if (query.awardTypeId) where.awardTypeId = Number(query.awardTypeId);
  if (query.department) {
    where.applicant = {
      department: {
        contains: query.department,
        mode: "insensitive",
      },
    };
  }

  if (query.archived === "only") {
    where.isArchived = true;
  } else if (query.archived !== "all") {
    where.isArchived = false;
  }

  return where;
}

function statusLabel(status) {
  return {
    DRAFT: "Nháp",
    SUBMITTED: "Chờ duyệt",
    APPROVED: "Đã duyệt",
    REJECTED: "Từ chối",
  }[status] || status;
}

const cleanStatusLabels = {
  DRAFT: "Nh\u00e1p",
  SUBMITTED: "Ch\u1edd duy\u1ec7t",
  APPROVED: "\u0110\u00e3 duy\u1ec7t",
  REJECTED: "T\u1eeb ch\u1ed1i",
};

const cleanScanLabels = {
  PENDING_SCAN: "Ch\u1edd qu\u00e9t",
  CLEAN: "An to\u00e0n",
  INFECTED: "Nhi\u1ec5m m\u00e3 \u0111\u1ed9c",
  SCAN_ERROR: "L\u1ed7i qu\u00e9t",
};

function cleanStatusLabel(status) {
  return cleanStatusLabels[status] || status || "-";
}

function scanLabel(status) {
  return cleanScanLabels[status] || status || "-";
}

function archiveLabel(value) {
  return {
    active: "\u0110ang hi\u1ec3n th\u1ecb",
    only: "\u0110\u00e3 l\u01b0u tr\u1eef",
    all: "T\u1ea5t c\u1ea3",
  }[value || "active"] || "\u0110ang hi\u1ec3n th\u1ecb";
}

function getVietnameseFontPath() {
  const candidates = [
    "C:\\Windows\\Fonts\\arial.ttf",
    "C:\\Windows\\Fonts\\calibri.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  ];
  return candidates.find((item) => fs.existsSync(item)) || null;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function addSheet(workbook, name, rows, widths = []) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  if (widths.length) worksheet["!cols"] = widths.map((width) => ({ wch: width }));
  XLSX.utils.book_append_sheet(workbook, worksheet, name);
}

function drawTable(doc, headers, rows, widths) {
  const startX = doc.page.margins.left;
  const paddingX = 6;
  const paddingY = 6;
  const minRowHeight = 24;
  const pageBottom = doc.page.height - doc.page.margins.bottom;

  const measureRowHeight = (row, isHeader = false) => {
    doc.fontSize(isHeader ? 9.5 : 9);
    const heights = row.map((cell, index) => {
      const text = String(cell ?? "-");
      return doc.heightOfString(text, { width: widths[index] - paddingX * 2 }) + paddingY * 2;
    });
    return Math.max(minRowHeight, ...heights);
  };

  const ensureSpace = (height) => {
    if (doc.y + height > pageBottom) doc.addPage();
  };

  const drawRow = (row, options = {}) => {
    const rowHeight = measureRowHeight(row, options.header);
    ensureSpace(rowHeight);
    let x = startX;
    const y = doc.y;
    row.forEach((cell, index) => {
      if (options.header) {
        doc.rect(x, y, widths[index], rowHeight).fillAndStroke("#e6f0f7", "#d9e2ec");
      } else if (options.shaded) {
        doc.rect(x, y, widths[index], rowHeight).fillAndStroke("#fbfdff", "#d9e2ec");
      } else {
        doc.rect(x, y, widths[index], rowHeight).stroke("#d9e2ec");
      }
      doc
        .fillColor(options.header ? "#0f172a" : "#1f2937")
        .fontSize(options.header ? 9.5 : 9)
        .text(String(cell ?? "-"), x + paddingX, y + paddingY, {
          width: widths[index] - paddingX * 2,
          align: options.align?.[index] || "left",
        });
      x += widths[index];
    });
    doc.y = y + rowHeight;
  };

  drawRow(headers, { header: true });
  rows.forEach((row, index) => drawRow(row, { shaded: index % 2 === 1 }));
  doc.x = startX;
  doc.moveDown(0.7);
  doc.x = startX;
}

async function buildReportSummaryData(query) {
  const where = buildNominationWhere(query);
  const [
    totalNominations,
    approvedCount,
    rejectedCount,
    submittedCount,
    archivedCount,
    nominationByStatus,
    nominationByYear,
    scoreAggregate,
    topNominations,
    recentNominations,
    evidenceByScanStatus,
    pendingReviews,
    overdueReviews,
    nominationsForDepartment,
    nominationsForAward,
  ] = await Promise.all([
    prisma.nomination.count({ where }),
    prisma.nomination.count({ where: { ...where, status: "APPROVED" } }),
    prisma.nomination.count({ where: { ...where, status: "REJECTED" } }),
    prisma.nomination.count({ where: { ...where, status: "SUBMITTED" } }),
    prisma.nomination.count({ where: { ...where, isArchived: true } }),
    prisma.nomination.groupBy({ by: ["status"], _count: { status: true }, where }),
    prisma.nomination.groupBy({ by: ["periodYear"], _count: { periodYear: true }, where, orderBy: { periodYear: "desc" } }),
    prisma.nomination.aggregate({ where, _avg: { totalSelfPoint: true }, _max: { totalSelfPoint: true } }),
    prisma.nomination.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        totalSelfPoint: true,
        periodYear: true,
        applicant: { select: { fullName: true, email: true, department: true } },
        awardType: { select: { name: true, category: true } },
      },
      orderBy: [{ totalSelfPoint: "desc" }, { updatedAt: "desc" }],
      take: 15,
    }),
    prisma.nomination.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        totalSelfPoint: true,
        updatedAt: true,
        applicant: { select: { fullName: true, email: true, department: true } },
        awardType: { select: { name: true, category: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
    prisma.evidence.groupBy({ by: ["scanStatus"], _count: { scanStatus: true }, where: { nomination: where } }),
    prisma.reviewStep.count({ where: { decision: "PENDING", nomination: where } }),
    prisma.reviewStep.count({ where: { decision: "PENDING", dueAt: { lt: new Date() }, nomination: where } }),
    prisma.nomination.findMany({
      where,
      select: { id: true, status: true, totalSelfPoint: true, applicant: { select: { department: true } } },
    }),
    prisma.nomination.findMany({
      where,
      select: { id: true, status: true, totalSelfPoint: true, awardType: { select: { id: true, name: true, category: true } } },
    }),
  ]);

  const byDepartmentMap = new Map();
  nominationsForDepartment.forEach((item) => {
    const key = item.applicant?.department || "Chưa có đơn vị";
    const current = byDepartmentMap.get(key) || { department: key, total: 0, approved: 0, rejected: 0, scoreTotal: 0 };
    current.total += 1;
    if (item.status === "APPROVED") current.approved += 1;
    if (item.status === "REJECTED") current.rejected += 1;
    current.scoreTotal += Number(item.totalSelfPoint || 0);
    byDepartmentMap.set(key, current);
  });

  const byAwardMap = new Map();
  nominationsForAward.forEach((item) => {
    const key = item.awardType?.id || "none";
    const current = byAwardMap.get(key) || {
      awardTypeId: key,
      name: item.awardType?.name || "Chưa chọn danh hiệu",
      category: item.awardType?.category || "-",
      total: 0,
      approved: 0,
      scoreTotal: 0,
    };
    current.total += 1;
    if (item.status === "APPROVED") current.approved += 1;
    current.scoreTotal += Number(item.totalSelfPoint || 0);
    byAwardMap.set(key, current);
  });

  const departmentStats = [...byDepartmentMap.values()]
    .map((item) => ({ ...item, averageScore: item.total ? Math.round(item.scoreTotal / item.total) : 0 }))
    .sort((a, b) => b.total - a.total);
  const awardStats = [...byAwardMap.values()]
    .map((item) => ({ ...item, averageScore: item.total ? Math.round(item.scoreTotal / item.total) : 0 }))
    .sort((a, b) => b.total - a.total);

  return {
    generatedAt: new Date(),
    filters: {
      periodYear: query.periodYear || "Tất cả",
      status: query.status ? cleanStatusLabel(query.status) : "Tất cả",
      department: query.department || "Tất cả",
      archive: archiveLabel(query.archived),
    },
    kpis: {
      totalNominations,
      approvedCount,
      rejectedCount,
      submittedCount,
      archivedCount,
      approvalRate: totalNominations ? Math.round((approvedCount / totalNominations) * 100) : 0,
      averageScore: Math.round(scoreAggregate._avg.totalSelfPoint || 0),
      maxScore: scoreAggregate._max.totalSelfPoint || 0,
      pendingReviews,
      overdueReviews,
    },
    nominationByStatus: nominationByStatus.map((item) => ({ status: item.status, label: cleanStatusLabel(item.status), total: item._count.status })),
    nominationByYear: nominationByYear.map((item) => ({ periodYear: item.periodYear, total: item._count.periodYear })),
    evidenceByScanStatus: evidenceByScanStatus.map((item) => ({ scanStatus: item.scanStatus, label: scanLabel(item.scanStatus), total: item._count.scanStatus })),
    departmentStats,
    awardStats,
    topNominations,
    recentNominations,
  };
}

router.get("/summary", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const where = buildNominationWhere(req.query);
    const [
      totalNominations,
      approvedCount,
      rejectedCount,
      submittedCount,
      archivedCount,
      nominationByStatus,
      nominationByYear,
      usersByRole,
      awardsByYear,
      awards,
      scoreAggregate,
      topNominations,
      recentNominations,
      evidenceByScanStatus,
      pendingReviews,
      overdueReviews,
      nominationsForDepartment,
      nominationsForAward,
    ] = await Promise.all([
      prisma.nomination.count({ where }),
      prisma.nomination.count({ where: { ...where, status: "APPROVED" } }),
      prisma.nomination.count({ where: { ...where, status: "REJECTED" } }),
      prisma.nomination.count({ where: { ...where, status: "SUBMITTED" } }),
      prisma.nomination.count({ where: { ...where, isArchived: true } }),
      prisma.nomination.groupBy({
        by: ["status"],
        _count: { status: true },
        where,
      }),
      prisma.nomination.groupBy({
        by: ["periodYear"],
        _count: { periodYear: true },
        where,
        orderBy: { periodYear: "desc" },
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
      prisma.awardType.findMany({
        where: { isActive: true },
        select: { id: true, name: true, category: true, periodYear: true },
        orderBy: [{ periodYear: "desc" }, { name: "asc" }],
      }),
      prisma.nomination.aggregate({
        where,
        _avg: { totalSelfPoint: true },
        _max: { totalSelfPoint: true },
      }),
      prisma.nomination.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          totalSelfPoint: true,
          periodYear: true,
          applicant: { select: { fullName: true, department: true } },
          awardType: { select: { name: true, category: true } },
        },
        orderBy: [{ totalSelfPoint: "desc" }, { updatedAt: "desc" }],
        take: 8,
      }),
      prisma.nomination.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          totalSelfPoint: true,
          updatedAt: true,
          applicant: { select: { fullName: true, department: true } },
          awardType: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      prisma.evidence.groupBy({
        by: ["scanStatus"],
        _count: { scanStatus: true },
        where: { nomination: where },
      }),
      prisma.reviewStep.count({
        where: {
          decision: "PENDING",
          nomination: where,
        },
      }),
      prisma.reviewStep.count({
        where: {
          decision: "PENDING",
          dueAt: { lt: new Date() },
          nomination: where,
        },
      }),
      prisma.nomination.findMany({
        where,
        select: {
          id: true,
          status: true,
          totalSelfPoint: true,
          applicant: { select: { department: true } },
        },
      }),
      prisma.nomination.findMany({
        where,
        select: {
          id: true,
          status: true,
          totalSelfPoint: true,
          awardType: { select: { id: true, name: true, category: true } },
        },
      }),
    ]);

    const byDepartmentMap = new Map();
    nominationsForDepartment.forEach((item) => {
      const key = item.applicant?.department || "Chưa có đơn vị";
      const current = byDepartmentMap.get(key) || { department: key, total: 0, approved: 0, rejected: 0, scoreTotal: 0 };
      current.total += 1;
      if (item.status === "APPROVED") current.approved += 1;
      if (item.status === "REJECTED") current.rejected += 1;
      current.scoreTotal += Number(item.totalSelfPoint || 0);
      byDepartmentMap.set(key, current);
    });

    const byAwardMap = new Map();
    nominationsForAward.forEach((item) => {
      const key = item.awardType?.id || "none";
      const label = item.awardType?.name || "Chưa chọn danh hiệu";
      const current = byAwardMap.get(key) || { awardTypeId: key, name: label, category: item.awardType?.category || "-", total: 0, approved: 0, scoreTotal: 0 };
      current.total += 1;
      if (item.status === "APPROVED") current.approved += 1;
      current.scoreTotal += Number(item.totalSelfPoint || 0);
      byAwardMap.set(key, current);
    });

    const departmentStats = [...byDepartmentMap.values()]
      .map((item) => ({ ...item, averageScore: item.total ? Math.round(item.scoreTotal / item.total) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const awardStats = [...byAwardMap.values()]
      .map((item) => ({ ...item, averageScore: item.total ? Math.round(item.scoreTotal / item.total) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const years = await prisma.nomination.findMany({
      distinct: ["periodYear"],
      select: { periodYear: true },
      orderBy: { periodYear: "desc" },
    });

    const departments = await prisma.user.findMany({
      distinct: ["department"],
      where: { department: { not: null } },
      select: { department: true },
      orderBy: { department: "asc" },
    });

    return res.json({
      filters: {
        years: years.map((item) => item.periodYear).filter(Boolean),
        departments: departments.map((item) => item.department).filter(Boolean),
        awards,
      },
      kpis: {
        totalNominations,
        approvedCount,
        rejectedCount,
        submittedCount,
        archivedCount,
        approvalRate: totalNominations ? Math.round((approvedCount / totalNominations) * 100) : 0,
        averageScore: Math.round(scoreAggregate._avg.totalSelfPoint || 0),
        maxScore: scoreAggregate._max.totalSelfPoint || 0,
        pendingReviews,
        overdueReviews,
      },
      nominationByStatus: nominationByStatus.map((item) => ({
        status: item.status,
        label: statusLabel(item.status),
        total: item._count.status,
      })),
      nominationByYear: nominationByYear.map((item) => ({
        periodYear: item.periodYear,
        total: item._count.periodYear,
      })),
      usersByRole,
      awardsByYear,
      evidenceByScanStatus: evidenceByScanStatus.map((item) => ({
        scanStatus: item.scanStatus,
        total: item._count.scanStatus,
      })),
      departmentStats,
      awardStats,
      topNominations,
      recentNominations,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/summary.csv", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const where = buildNominationWhere(req.query);
    const nominationByStatus = await prisma.nomination.groupBy({
      by: ["status"],
      _count: { status: true },
      where,
    });

    const rows = ["status,label,total", ...nominationByStatus.map((r) => `${r.status},${statusLabel(r.status)},${r._count.status}`)];
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
    const report = await buildReportSummaryData(req.query);
    const workbook = XLSX.utils.book_new();

    addSheet(workbook, "Tong quan", [
      { "Chỉ số": "Tổng hồ sơ", "Giá trị": report.kpis.totalNominations },
      { "Chỉ số": "Hồ sơ đã duyệt", "Giá trị": report.kpis.approvedCount },
      { "Chỉ số": "Hồ sơ bị từ chối", "Giá trị": report.kpis.rejectedCount },
      { "Chỉ số": "Hồ sơ chờ xử lý", "Giá trị": report.kpis.submittedCount },
      { "Chỉ số": "Tỷ lệ duyệt", "Giá trị": `${report.kpis.approvalRate}%` },
      { "Chỉ số": "Điểm trung bình", "Giá trị": report.kpis.averageScore },
      { "Chỉ số": "Điểm cao nhất", "Giá trị": report.kpis.maxScore },
      { "Chỉ số": "Phiên duyệt chờ xử lý", "Giá trị": report.kpis.pendingReviews },
      { "Chỉ số": "Phiên duyệt quá hạn", "Giá trị": report.kpis.overdueReviews },
      { "Chỉ số": "Thời điểm xuất báo cáo", "Giá trị": formatDateTime(report.generatedAt) },
    ], [32, 24]);

    addSheet(workbook, "Bo loc", [
      { "Bộ lọc": "Năm xét", "Giá trị": report.filters.periodYear },
      { "Bộ lọc": "Trạng thái", "Giá trị": report.filters.status },
      { "Bộ lọc": "Đơn vị", "Giá trị": report.filters.department },
      { "Bộ lọc": "Lưu trữ", "Giá trị": report.filters.archive },
    ], [28, 40]);

    addSheet(workbook, "Trang thai", report.nominationByStatus.map((item) => ({
      "Trạng thái": item.label,
      "Số lượng": item.total,
    })), [28, 14]);

    addSheet(workbook, "Theo nam", report.nominationByYear.map((item) => ({
      "Năm xét": item.periodYear,
      "Số hồ sơ": item.total,
    })), [16, 14]);

    addSheet(workbook, "Theo don vi", report.departmentStats.map((item) => ({
      "Đơn vị": item.department,
      "Tổng hồ sơ": item.total,
      "Đã duyệt": item.approved,
      "Bị từ chối": item.rejected,
      "Điểm trung bình": item.averageScore,
    })), [34, 14, 14, 14, 18]);

    addSheet(workbook, "Danh hieu", report.awardStats.map((item) => ({
      "Danh hiệu/Khen thưởng": item.name,
      "Nhóm": item.category,
      "Tổng hồ sơ": item.total,
      "Đã duyệt": item.approved,
      "Điểm trung bình": item.averageScore,
    })), [38, 20, 14, 14, 18]);

    addSheet(workbook, "Minh chung", report.evidenceByScanStatus.map((item) => ({
      "Trạng thái quét": item.label,
      "Số lượng file": item.total,
    })), [24, 16]);

    addSheet(workbook, "Top ho so", report.topNominations.map((item, index) => ({
      "Hạng": index + 1,
      "Hồ sơ": item.title,
      "Người nộp": item.applicant?.fullName || "-",
      "Email": item.applicant?.email || "-",
      "Đơn vị": item.applicant?.department || "-",
      "Danh hiệu": item.awardType?.name || "-",
      "Trạng thái": cleanStatusLabel(item.status),
      "Điểm": item.totalSelfPoint,
      "Năm": item.periodYear,
    })), [8, 44, 24, 30, 24, 32, 18, 10, 10]);

    addSheet(workbook, "Gan day", report.recentNominations.map((item) => ({
      "Hồ sơ": item.title,
      "Người nộp": item.applicant?.fullName || "-",
      "Đơn vị": item.applicant?.department || "-",
      "Danh hiệu": item.awardType?.name || "-",
      "Trạng thái": cleanStatusLabel(item.status),
      "Điểm": item.totalSelfPoint,
      "Cập nhật": formatDateTime(item.updatedAt),
    })), [44, 24, 24, 32, 18, 10, 20]);

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
    const report = await buildReportSummaryData(req.query);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=thidua-summary.pdf");

    const doc = new PDFDocument({ margin: 42, size: "A4", bufferPages: true });
    const fontPath = getVietnameseFontPath();
    if (fontPath) {
      doc.registerFont("Vietnamese", fontPath);
      doc.font("Vietnamese");
    }

    doc.pipe(res);
    doc.fillColor("#0f4c81").fontSize(20).text("BÁO CÁO TỔNG HỢP THI ĐUA KHEN THƯỞNG", { align: "center" });
    doc.moveDown(0.4);
    doc.fillColor("#6b7280").fontSize(10).text(`Thời điểm xuất: ${formatDateTime(report.generatedAt)}`, { align: "center" });
    doc.moveDown();

    doc.fillColor("#0f172a").fontSize(12).text("1. Phạm vi báo cáo", { underline: true });
    drawTable(doc, ["Bộ lọc", "Giá trị"], [
      ["Năm xét", report.filters.periodYear],
      ["Trạng thái", report.filters.status],
      ["Đơn vị", report.filters.department],
      ["Lưu trữ", report.filters.archive],
    ], [160, 350]);

    doc.fillColor("#0f172a").fontSize(12).text("2. Chỉ số tổng quan", { underline: true });
    drawTable(doc, ["Chỉ số", "Giá trị"], [
      ["Tổng hồ sơ", report.kpis.totalNominations],
      ["Đã duyệt", report.kpis.approvedCount],
      ["Bị từ chối", report.kpis.rejectedCount],
      ["Chờ xử lý", report.kpis.submittedCount],
      ["Tỷ lệ duyệt", `${report.kpis.approvalRate}%`],
      ["Điểm trung bình", report.kpis.averageScore],
      ["Điểm cao nhất", report.kpis.maxScore],
      ["Phiên duyệt chờ xử lý", report.kpis.pendingReviews],
      ["Phiên duyệt quá hạn", report.kpis.overdueReviews],
    ], [260, 250]);

    doc.fontSize(12).text("3. Hồ sơ theo trạng thái", { underline: true });
    drawTable(doc, ["Trạng thái", "Số lượng"], report.nominationByStatus.map((item) => [item.label, item.total]), [260, 120]);

    doc.fontSize(12).text("4. Phân tích theo đơn vị", { underline: true });
    drawTable(doc, ["Đơn vị", "Tổng", "Duyệt", "Từ chối", "Điểm TB"], report.departmentStats.slice(0, 10).map((item) => [
      item.department,
      item.total,
      item.approved,
      item.rejected,
      item.averageScore,
    ]), [220, 65, 65, 70, 90]);

    doc.fontSize(12).text("5. Danh hiệu/Khen thưởng có nhiều hồ sơ", { underline: true });
    drawTable(doc, ["Danh hiệu", "Tổng", "Duyệt", "Điểm TB"], report.awardStats.slice(0, 10).map((item) => [
      item.name,
      item.total,
      item.approved,
      item.averageScore,
    ]), [300, 65, 65, 80]);

    doc.fontSize(12).text("6. Trạng thái quét minh chứng", { underline: true });
    drawTable(doc, ["Trạng thái quét", "Số lượng file"], report.evidenceByScanStatus.map((item) => [
      item.label,
      item.total,
    ]), [260, 140]);

    doc.addPage();
    doc.fontSize(12).fillColor("#0f172a").text("7. Top hồ sơ theo điểm", { underline: true });
    drawTable(doc, ["Hạng", "Hồ sơ", "Người nộp", "Điểm"], report.topNominations.slice(0, 10).map((item, index) => [
      index + 1,
      item.title,
      item.applicant?.fullName || "-",
      item.totalSelfPoint,
    ]), [45, 245, 150, 70]);

    doc.fontSize(12).text("8. Hồ sơ cập nhật gần đây", { underline: true });
    drawTable(doc, ["Hồ sơ", "Trạng thái", "Điểm", "Cập nhật"], report.recentNominations.slice(0, 10).map((item) => [
      item.title,
      cleanStatusLabel(item.status),
      item.totalSelfPoint,
      formatDateTime(item.updatedAt),
    ]), [245, 100, 55, 110]);

    doc.end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
