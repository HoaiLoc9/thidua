const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middlewares/auth");
const { createNotification } = require("../utils/notify");
const { logAudit } = require("../utils/audit");

const router = express.Router();

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().optional(),
});

const levelOrder = {
  DONVI: 1,
  KHOA: 2,
  TRUONG: 3,
};

router.get("/pending", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const steps = await prisma.reviewStep.findMany({
      where: {
        ...(req.user.role === "HOIDONG" ? { level: "TRUONG" } : { reviewerId: req.user.id }),
        decision: "PENDING",
        nomination: { status: "SUBMITTED" },
      },
      include: {
        nomination: {
          include: {
            applicant: {
              select: { id: true, fullName: true, department: true },
            },
            items: {
              include: {
                criteria: true,
              },
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

    const review = await prisma.reviewStep.findUnique({
      where: { id: reviewId },
      include: {
        nomination: {
          include: {
            reviews: true,
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({ message: "Khong tim thay phien duyet" });
    }

    const councilCanHandle = req.user.role === "HOIDONG" && review.level === "TRUONG";
    if (review.reviewerId !== req.user.id && !councilCanHandle) {
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

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReview = await tx.reviewStep.update({
        where: { id: reviewId },
        data: {
          reviewerId: councilCanHandle ? req.user.id : review.reviewerId,
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
      include: { reviews: true },
    });

    await logAudit(req.user.id, "REVIEW_DECISION", `Decision ${data.decision} for nomination ${review.nominationId}`);

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

    return res.json(updated);
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

module.exports = router;
