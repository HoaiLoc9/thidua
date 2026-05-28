const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middlewares/auth");
const { createNotification } = require("../utils/notify");
const { logAudit } = require("../utils/audit");
const { sendReviewDecisionEmail } = require("../utils/email");

const router = express.Router();

const scoreSchema = z.object({
  nominationItemId: z.number().int().positive(),
  score: z.number().int().min(0),
});

const subScoreSchema = z.object({
  subItemId: z.number().int().positive(),
  score: z.number().int().min(0),
});

const detailedScoreSchema = z.object({
  nominationItemId: z.number().int().positive(),
  subScores: z.array(subScoreSchema).min(1),
});

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().optional(),
  scores: z.array(scoreSchema).optional(),
  detailedScores: z.array(detailedScoreSchema).optional(),
});

const reassignSchema = z.object({
  reviewerId: z.number().int().positive(),
});

const levelOrder = {
  DONVI: 1,
  KHOA: 2,
  TRUONG: 3,
};

function buildStudentReviewConditions(nomination) {
  const evidenceUrls = [
    ...(nomination.evidences || []).map((item) => item.fileUrl),
    ...(nomination.items || []).map((item) => item.evidence),
  ].filter(Boolean);
  const items = nomination.items || [];
  const missingEvidenceItems = items.filter((item) => !item.evidence?.trim());
  const hasEnoughEvidenceFiles = items.length > 0 && evidenceUrls.length >= items.length;
  const evidencePerCriteriaPassed = items.length > 0 && (missingEvidenceItems.length === 0 || hasEnoughEvidenceFiles);

  return [
    {
      code: "STUDENT_APPLICANT",
      label: "Nguoi nop la sinh vien",
      passed: nomination.applicant?.role === "SINHVIEN",
    },
    {
      code: "HAS_CRITERIA",
      label: "Ho so co it nhat mot tieu chi thanh tich",
      passed: items.length > 0,
    },
    {
      code: "ACTIVE_CRITERIA",
      label: "Tat ca tieu chi trong ho so dang duoc kich hoat",
      passed: items.every((item) => item.criteria?.isActive !== false),
    },
    {
      code: "HAS_EVIDENCE",
      label: "Ho so co minh chung kem theo",
      passed: evidenceUrls.length > 0,
    },
    {
      code: "EVIDENCE_PER_CRITERIA",
      label: "Moi tieu chi thanh tich co minh chung rieng",
      passed: evidencePerCriteriaPassed,
      detail: missingEvidenceItems.map((item) => item.criteria?.code || `CRITERIA_${item.criteriaId}`),
    },
    {
      code: "VALID_YEAR",
      label: "Nam xet thi dua hop le",
      passed: Number.isInteger(nomination.periodYear) && nomination.periodYear >= 2020,
    },
    {
      code: "TITLE_PRESENT",
      label: "Ten ho so ro rang",
      passed: Boolean(nomination.title && nomination.title.trim().length >= 3),
    },
  ];
}

router.get("/pending", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const steps = await prisma.reviewStep.findMany({
      where: {
        reviewerId: req.user.id,
        decision: "PENDING",
        nomination: { status: "SUBMITTED" },
      },
      include: {
        nomination: {
          include: {
            applicant: {
              select: { id: true, fullName: true, department: true, role: true },
            },
            items: {
              include: {
                criteria: {
                  include: {
                    subItems: {
                      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                    },
                  },
                },
              },
            },
            evidences: {
              orderBy: { uploadedAt: "desc" },
            },
            reviews: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });

    const filtered = steps.filter((step) => {
      const prior = step.nomination.reviews.filter(
        (r) => levelOrder[r.level] < levelOrder[step.level]
      );
      return prior.every((p) => p.decision === "APPROVED");
    });

    return res.json(filtered);
  } catch (error) {
    return next(error);
  }
});

router.post("/:reviewId/decision", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const data = reviewSchema.parse(req.body);
    const hasScores = Array.isArray(data.scores) && data.scores.length > 0;
    const hasDetailedScores = Array.isArray(data.detailedScores) && data.detailedScores.length > 0;
    if (hasScores && hasDetailedScores) {
      return res.status(400).json({
        message: "Chi duoc gui mot trong hai truong: scores hoac detailedScores",
      });
    }

    const review = await prisma.reviewStep.findUnique({
      where: { id: reviewId },
      include: {
        nomination: {
          include: {
            reviews: true,
            applicant: {
              select: { id: true, fullName: true, department: true, role: true },
            },
            items: {
              include: {
                criteria: {
                  include: {
                    subItems: {
                      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                    },
                  },
                },
              },
            },
            evidences: true,
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({ message: "Khong tim thay phien duyet" });
    }

    if (review.reviewerId !== req.user.id) {
      return res.status(403).json({ message: "Khong co quyen duyet phien nay" });
    }

    if (review.decision !== "PENDING") {
      return res.status(400).json({ message: "Phien duyet da duoc xu ly" });
    }

    const prior = review.nomination.reviews.filter(
      (r) => levelOrder[r.level] < levelOrder[review.level]
    );
    if (!prior.every((p) => p.decision === "APPROVED")) {
      return res.status(400).json({ message: "Can hoan tat cac cap truoc" });
    }

    if (data.decision === "APPROVED" && review.nomination.applicant?.role === "SINHVIEN") {
      const failedConditions = buildStudentReviewConditions(review.nomination).filter((item) => !item.passed);
      if (failedConditions.length) {
        return res.status(400).json({
          message: "Ho so sinh vien chua dat dieu kien duyet",
          conditions: failedConditions,
        });
      }
    }

    let scoreUpdates = null;
    if (data.scores?.length || data.detailedScores?.length) {
      if (data.decision !== "APPROVED") {
        return res.status(400).json({ message: "Khong the cham diem khi tu choi ho so" });
      }

      const items = review.nomination.items || [];
      const itemById = new Map(items.map((item) => [item.id, item]));
      const isDetailedMode = Boolean(data.detailedScores?.length);
      const incomingScores = isDetailedMode ? data.detailedScores : data.scores;
      if ((incomingScores || []).length !== items.length) {
        return res.status(400).json({ message: "Can cham diem day du cho tat ca tieu chi lon" });
      }

      let totalScore = 0;
      const updates = [];
      for (const entry of incomingScores || []) {
        const item = itemById.get(entry.nominationItemId);
        if (!item) {
          return res.status(400).json({ message: "Tieu chi cham diem khong hop le" });
        }
        const maxScore = item.criteria?.maxPoint ?? 0;
        const subItems = item.criteria?.subItems || [];

        let finalScore = 0;
        if (isDetailedMode) {
          if (!subItems.length) {
            return res.status(400).json({
              message: `Tieu chi ${item.criteria?.code || item.id} chua duoc cau hinh y nho de cham chi tiet`,
            });
          }
          if (entry.subScores.length !== subItems.length) {
            return res.status(400).json({
              message: `Can cham day du tat ca y nho cua tieu chi ${item.criteria?.code || item.id}`,
            });
          }
          const subItemMap = new Map(subItems.map((subItem) => [subItem.id, subItem]));
          for (const subEntry of entry.subScores) {
            const subItem = subItemMap.get(subEntry.subItemId);
            if (!subItem) {
              return res.status(400).json({ message: "Y nho cham diem khong hop le" });
            }
            if (subEntry.score > subItem.maxPoint) {
              return res.status(400).json({
                message: `Diem vuot qua gioi han y nho (${subItem.maxPoint}) cua tieu chi ${item.criteria?.code || item.id}`,
              });
            }
            finalScore += subEntry.score;
          }
        } else {
          finalScore = entry.score;
        }

        if (finalScore < 0 || finalScore > maxScore) {
          return res.status(400).json({
            message: `Diem vuot qua gioi han toi da (${maxScore}) cho tieu chi ${item.criteria?.code || item.id}`,
          });
        }
        totalScore += finalScore;
        updates.push({ id: item.id, score: finalScore });
      }

      scoreUpdates = { totalScore, updates };
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (scoreUpdates) {
        await Promise.all(
          scoreUpdates.updates.map((update) =>
            tx.nominationItem.update({
              where: { id: update.id },
              data: { selfPoint: update.score },
            })
          )
        );

        await tx.nomination.update({
          where: { id: review.nominationId },
          data: { totalSelfPoint: scoreUpdates.totalScore },
        });
      }

      const updatedReview = await tx.reviewStep.update({
        where: { id: reviewId },
        data: {
          decision: data.decision,
          comment: data.comment,
          reviewedAt: new Date(),
        },
      });

      if (data.decision === "REJECTED") {
        await tx.nomination.update({
          where: { id: review.nominationId },
          data: { status: "REJECTED" },
        });
      }

      if (data.decision === "APPROVED" && review.level === "TRUONG") {
        await tx.nomination.update({
          where: { id: review.nominationId },
          data: { status: "APPROVED" },
        });
      }

      await tx.approvalResult.create({
        data: {
          nominationId: review.nominationId,
          approverId: req.user.id,
          status: data.decision,
          comment: data.comment,
        },
      });

      return updatedReview;
    });

    const nomination = await prisma.nomination.findUnique({
      where: { id: review.nominationId },
      include: {
        reviews: true,
        applicant: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    await logAudit(
      req.user.id,
      "REVIEW_DECISION",
      `Decision ${data.decision} for nomination ${review.nominationId}${scoreUpdates ? ` | totalScore=${scoreUpdates.totalScore}` : ""}`
    );

    if (data.decision === "REJECTED") {
      await createNotification(nomination.applicantId, `Hồ sơ ${nomination.title} bị từ chối`);
    }

    if (data.decision === "APPROVED" && review.level !== "TRUONG") {
      const nextReview = nomination.reviews
        .filter((r) => levelOrder[r.level] > levelOrder[review.level] && r.decision === "PENDING")
        .sort((a, b) => levelOrder[a.level] - levelOrder[b.level])[0];

      if (nextReview) {
        await createNotification(nextReview.reviewerId, `Có hồ sơ cần duyệt tiếp: ${nomination.title}`);
      }
    }

    if (data.decision === "APPROVED" && review.level === "TRUONG") {
      await createNotification(nomination.applicantId, `Hồ sơ ${nomination.title} đã được công nhận`);
    }

    let emailDelivery = { sent: false, to: nomination.applicant?.email, reason: "Email not attempted" };
    try {
      emailDelivery = await sendReviewDecisionEmail({
        nomination,
        student: nomination.applicant,
        decision: data.decision,
        level: review.level,
        comment: data.comment,
      });
      console.log("Review decision email delivery:", emailDelivery);
    } catch (emailError) {
      emailDelivery = {
        sent: false,
        to: nomination.applicant?.email,
        reason: emailError.message,
      };
      console.error("Review decision email failed:", emailError.message);
    }

    return res.json({ ...updated, emailDelivery });
  } catch (error) {
    return next(error);
  }
});

router.post("/:reviewId/forward", authenticate, authorize("CANBO", "ADMIN"), async (req, res, next) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const review = await prisma.reviewStep.findUnique({
      where: { id: reviewId },
      include: { nomination: { include: { reviews: true } } },
    });

    if (!review) {
      return res.status(404).json({ message: "Khong tim thay phien duyet" });
    }

    if (review.reviewerId !== req.user.id) {
      return res.status(403).json({ message: "Khong co quyen trinh ho so nay" });
    }

    if (review.level !== "KHOA") {
      return res.status(400).json({ message: "Chi cap khoa moi co the trinh len cap truong" });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.reviewStep.update({
        where: { id: reviewId },
        data: {
          decision: "APPROVED",
          comment: "Trinh ho so len cap truong",
          reviewedAt: new Date(),
        },
      });

      await tx.approvalResult.create({
        data: {
          nominationId: review.nominationId,
          approverId: req.user.id,
          status: "APPROVED",
          comment: "Trinh len cap truong",
        },
      });

      return tx.reviewStep.findFirst({
        where: {
          nominationId: review.nominationId,
          level: "TRUONG",
        },
      });
    });

    if (result) {
      await createNotification(result.reviewerId, `Có hồ sơ cần phiên cấp trường: ${review.nomination.title}`);
    }
    await logAudit(req.user.id, "FORWARD_NOMINATION", `Forwarded nomination ${review.nominationId} to school level`);

    return res.json({ message: "Da trinh ho so len cap truong" });
  } catch (error) {
    return next(error);
  }
});

router.post("/:reviewId/reassign", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const data = reassignSchema.parse(req.body);
    const review = await prisma.reviewStep.findUnique({ where: { id: reviewId } });
    if (!review) {
      return res.status(404).json({ message: "Khong tim thay phien duyet" });
    }
    if (review.decision !== "PENDING") {
      return res.status(400).json({ message: "Chi duoc phan cong lai phien dang cho duyet" });
    }

    const reviewer = await prisma.user.findUnique({ where: { id: data.reviewerId } });
    if (!reviewer) {
      return res.status(404).json({ message: "Khong tim thay nguoi duyet moi" });
    }
    if (!["ADMIN", "CANBO", "HOIDONG"].includes(reviewer.role)) {
      return res.status(400).json({ message: "Nguoi duyet moi khong thuoc nhom duyet hop le" });
    }

    const updated = await prisma.reviewStep.update({
      where: { id: reviewId },
      data: { reviewerId: data.reviewerId },
    });

    await createNotification(data.reviewerId, `Ban duoc phan cong duyet ho so #${review.nominationId}`);
    await logAudit(req.user.id, "REASSIGN_REVIEWER", `Reassigned review ${reviewId} to user ${data.reviewerId}`);

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.post("/send-overdue-reminders", authenticate, authorize("ADMIN", "CANBO"), async (req, res, next) => {
  try {
    const now = new Date();
    const overdue = await prisma.reviewStep.findMany({
      where: {
        decision: "PENDING",
        dueAt: { lt: now },
      },
      include: {
        nomination: { select: { title: true } },
      },
      take: 100,
    });

    for (const step of overdue) {
      await createNotification(step.reviewerId, `Nhac viec: Ho so "${step.nomination?.title || step.nominationId}" da qua han duyet`);
    }

    await logAudit(req.user.id, "SEND_OVERDUE_REMINDERS", `Sent reminders for ${overdue.length} overdue reviews`);
    return res.json({ reminded: overdue.length });
  } catch (error) {
    return next(error);
  }
});

router.get("/stats", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const [draft, submitted, approved, rejected] = await Promise.all([
      prisma.nomination.count({ where: { status: "DRAFT" } }),
      prisma.nomination.count({ where: { status: "SUBMITTED" } }),
      prisma.nomination.count({ where: { status: "APPROVED" } }),
      prisma.nomination.count({ where: { status: "REJECTED" } }),
    ]);

    return res.json({ draft, submitted, approved, rejected });
  } catch (error) {
    return next(error);
  }
});

router.get("/overdue", authenticate, authorize("ADMIN", "CANBO"), async (req, res, next) => {
  try {
    const now = new Date();
    const overdue = await prisma.reviewStep.findMany({
      where: {
        decision: "PENDING",
        dueAt: { lt: now },
      },
      include: {
        reviewer: {
          select: { id: true, fullName: true, role: true },
        },
        nomination: {
          select: { id: true, title: true, applicant: { select: { id: true, fullName: true } } },
        },
      },
      orderBy: { dueAt: "asc" },
      take: 200,
    });

    return res.json(overdue);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
