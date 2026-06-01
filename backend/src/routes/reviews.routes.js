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

const evidenceScoreSchema = z.object({
  evidenceId: z.number().int().positive(),
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
  evidenceScores: z.array(evidenceScoreSchema).optional(),
});

const reassignSchema = z.object({
  reviewerId: z.number().int().positive(),
});

const councilVoteSchema = z.object({
  choice: z.enum(["AGREE", "DISAGREE", "REVIEW_AGAIN"]),
  comment: z.string().max(700).optional(),
});

const scoreAdjustmentSchema = z.object({
  evidenceId: z.number().int().positive(),
  action: z.enum(["KEEP", "ADJUST", "CANCEL"]),
  newPoint: z.number().int().min(0).optional(),
  reason: z.string().min(3).max(700),
});

const councilFinalizeSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().max(700).optional(),
});

const levelOrder = {
  KHOA: 1,
  TRUONG: 2,
};

const PASS_RATIO = 0.5;

function buildVoteSummary(members, votes) {
  const memberCount = members.length;
  const agreeCount = votes.filter((vote) => vote.choice === "AGREE").length;
  const disagreeCount = votes.filter((vote) => vote.choice === "DISAGREE").length;
  const reviewAgainCount = votes.filter((vote) => vote.choice === "REVIEW_AGAIN").length;
  const votedCount = votes.length;
  const agreeRatio = memberCount ? agreeCount / memberCount : 0;
  const disagreeRatio = memberCount ? disagreeCount / memberCount : 0;
  const isTie = memberCount > 0 && agreeCount === disagreeCount && votedCount === memberCount;

  return {
    memberCount,
    votedCount,
    agreeCount,
    disagreeCount,
    reviewAgainCount,
    agreeRatio,
    passThreshold: Math.floor(memberCount * PASS_RATIO) + 1,
    passed: memberCount > 0 && agreeCount > memberCount * PASS_RATIO,
    rejectedByVote: memberCount > 0 && disagreeCount > memberCount * PASS_RATIO,
    needsMoreVotes: votedCount < memberCount,
    isTie,
  };
}

function buildStudentReviewConditions(nomination) {
  const evidenceUrls = [
    ...(nomination.evidences || []).map((item) => item.fileUrl),
    ...(nomination.items || []).map((item) => item.evidence),
  ].filter(Boolean);
  const items = nomination.items || [];
  const awardCriteria = nomination.awardType?.criteria || [];
  const isAwardNomination = Boolean(nomination.awardTypeId || nomination.awardType);
  const missingEvidenceItems = items.filter((item) => !item.evidence?.trim());
  const missingAwardCriteria = awardCriteria.filter(
    (criterion) => !(nomination.evidences || []).some((evidence) => evidence.awardCriterionId === criterion.id)
  );
  const hasEnoughEvidenceFiles = items.length > 0 && evidenceUrls.length >= items.length;
  const evidencePerCriteriaPassed = isAwardNomination
    ? awardCriteria.length > 0 && missingAwardCriteria.length === 0
    : items.length > 0 && (missingEvidenceItems.length === 0 || hasEnoughEvidenceFiles);

  return [
    {
      code: "STUDENT_APPLICANT",
      label: "Người nộp là sinh viên",
      passed: nomination.applicant?.role === "SINHVIEN",
    },
    {
      code: "HAS_CRITERIA",
      label: "Hồ sơ có ít nhất một tiêu chí thành tích",
      passed: isAwardNomination ? awardCriteria.length > 0 : items.length > 0,
    },
    {
      code: "ACTIVE_CRITERIA",
      label: "Tất cả tiêu chí trong hồ sơ đang được kích hoạt",
      passed: isAwardNomination ? nomination.awardType?.isActive !== false : items.every((item) => item.criteria?.isActive !== false),
    },
    {
      code: "HAS_EVIDENCE",
      label: "Hồ sơ có minh chứng kèm theo",
      passed: evidenceUrls.length > 0,
    },
    {
      code: "EVIDENCE_PER_CRITERIA",
      label: "Mỗi tiêu chí thành tích có minh chứng riêng",
      passed: evidencePerCriteriaPassed,
      detail: isAwardNomination
        ? missingAwardCriteria.map((criterion) => criterion.title)
        : missingEvidenceItems.map((item) => item.criteria?.code || `CRITERIA_${item.criteriaId}`),
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
        ...(req.user.role === "ADMIN"
          ? {}
          : req.user.role === "HOIDONG"
            ? { OR: [{ reviewerId: req.user.id }, { level: "TRUONG" }] }
            : { reviewerId: req.user.id }),
        decision: "PENDING",
        nomination: { status: "SUBMITTED" },
      },
      include: {
        nomination: {
          include: {
            applicant: {
              select: { id: true, fullName: true, department: true, role: true },
            },
            awardType: {
              include: {
                criteria: {
                  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                },
              },
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
              include: {
                awardCriterion: true,
              },
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

router.get("/rankings", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const periodYear = req.query.periodYear ? Number(req.query.periodYear) : undefined;
    const awardTypeId = req.query.awardTypeId ? Number(req.query.awardTypeId) : undefined;

    const nominations = await prisma.nomination.findMany({
      where: {
        status: { in: ["SUBMITTED", "APPROVED"] },
        ...(Number.isInteger(periodYear) ? { periodYear } : {}),
        ...(Number.isInteger(awardTypeId) ? { awardTypeId } : {}),
      },
      select: {
        id: true,
        title: true,
        periodYear: true,
        totalSelfPoint: true,
        status: true,
        applicant: {
          select: { fullName: true, email: true, department: true },
        },
        awardType: {
          select: { name: true, category: true },
        },
      },
      orderBy: [{ totalSelfPoint: "desc" }, { updatedAt: "asc" }],
    });

    return res.json(nominations.map((nomination, index) => ({
      rank: index + 1,
      ...nomination,
    })));
  } catch (error) {
    return next(error);
  }
});

router.get("/council/:nominationId", authenticate, authorize("ADMIN", "HOIDONG"), async (req, res, next) => {
  try {
    const nominationId = Number(req.params.nominationId);
    const [nomination, members, votes, adjustments] = await Promise.all([
      prisma.nomination.findUnique({
        where: { id: nominationId },
        include: {
          applicant: { select: { id: true, fullName: true, email: true, department: true } },
          awardType: { include: { criteria: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } },
          evidences: { include: { awardCriterion: true }, orderBy: { uploadedAt: "asc" } },
          reviews: { include: { reviewer: { select: { id: true, fullName: true, email: true, role: true } } } },
        },
      }),
      prisma.user.findMany({
        where: { role: "HOIDONG" },
        select: { id: true, fullName: true, email: true, department: true },
        orderBy: { id: "asc" },
      }),
      prisma.councilVote.findMany({
        where: { nominationId },
        include: { voter: { select: { id: true, fullName: true, email: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.scoreAdjustment.findMany({
        where: { nominationId },
        include: {
          adjustedBy: { select: { id: true, fullName: true, email: true } },
          evidence: { include: { awardCriterion: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!nomination) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    }

    const truongReview = nomination.reviews.find((review) => review.level === "TRUONG");
    const voteSummary = buildVoteSummary(members, votes);
    return res.json({
      nomination,
      members,
      votes,
      adjustments,
      voteSummary,
      finalizer: truongReview?.reviewer || null,
      canFinalize: req.user.role === "ADMIN" || truongReview?.reviewerId === req.user.id,
      currentUserVote: votes.find((vote) => vote.voterId === req.user.id) || null,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:reviewId/council/vote", authenticate, authorize("HOIDONG"), async (req, res, next) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const data = councilVoteSchema.parse(req.body);
    const review = await prisma.reviewStep.findUnique({
      where: { id: reviewId },
      include: { nomination: { include: { reviews: true } } },
    });

    if (!review) return res.status(404).json({ message: "Không tìm thấy phiên duyệt" });
    if (review.level !== "TRUONG") return res.status(400).json({ message: "Chỉ phiên cấp trường mới được biểu quyết" });
    if (review.decision !== "PENDING") return res.status(400).json({ message: "Phiên cấp trường đã được chốt" });
    const prior = review.nomination.reviews.filter((item) => levelOrder[item.level] < levelOrder[review.level]);
    if (!prior.every((item) => item.decision === "APPROVED")) {
      return res.status(400).json({ message: "Cần hoàn tất cấp khoa trước khi hội đồng biểu quyết" });
    }

    const vote = await prisma.councilVote.upsert({
      where: { nominationId_voterId: { nominationId: review.nominationId, voterId: req.user.id } },
      create: {
        nominationId: review.nominationId,
        voterId: req.user.id,
        choice: data.choice,
        comment: data.comment,
      },
      update: {
        choice: data.choice,
        comment: data.comment,
      },
    });

    await logAudit(req.user.id, "COUNCIL_VOTE", `Council vote ${data.choice} for nomination ${review.nominationId}`);
    return res.json(vote);
  } catch (error) {
    return next(error);
  }
});

router.post("/:reviewId/council/adjust-evidence", authenticate, authorize("ADMIN", "HOIDONG"), async (req, res, next) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const data = scoreAdjustmentSchema.parse(req.body);
    const review = await prisma.reviewStep.findUnique({
      where: { id: reviewId },
      include: { nomination: { include: { evidences: true } } },
    });

    if (!review) return res.status(404).json({ message: "Không tìm thấy phiên duyệt" });
    if (review.level !== "TRUONG") return res.status(400).json({ message: "Chỉ hội đồng mới được điều chỉnh điểm cấp trường" });
    if (review.decision !== "PENDING") return res.status(400).json({ message: "Phiên cấp trường đã được chốt" });

    const evidence = review.nomination.evidences.find((item) => item.id === data.evidenceId);
    if (!evidence) return res.status(400).json({ message: "Minh chứng không thuộc hồ sơ này" });
    if (data.action === "ADJUST" && data.newPoint === undefined) {
      return res.status(400).json({ message: "Cần nhập điểm mới khi điều chỉnh điểm" });
    }

    const oldPoint = evidence.reviewPoint;
    const nextPoint = data.action === "KEEP"
      ? oldPoint
      : data.action === "CANCEL"
        ? 0
        : data.newPoint;

    const result = await prisma.$transaction(async (tx) => {
      await tx.evidence.update({
        where: { id: evidence.id },
        data: { reviewPoint: nextPoint },
      });

      const evidences = await tx.evidence.findMany({
        where: { nominationId: review.nominationId },
        select: { id: true, reviewPoint: true },
      });
      const total = evidences.reduce((sum, item) => {
        if (item.id === evidence.id) return sum + Number(nextPoint || 0);
        return sum + Number(item.reviewPoint || 0);
      }, 0);

      await tx.nomination.update({
        where: { id: review.nominationId },
        data: { totalSelfPoint: total },
      });

      const adjustment = await tx.scoreAdjustment.create({
        data: {
          nominationId: review.nominationId,
          evidenceId: evidence.id,
          adjustedById: req.user.id,
          action: data.action,
          oldPoint,
          newPoint: nextPoint,
          reason: data.reason,
        },
      });

      return { adjustment, total };
    });

    await logAudit(req.user.id, "COUNCIL_SCORE_ADJUSTMENT", `Adjusted evidence ${evidence.id} for nomination ${review.nominationId}: ${oldPoint} -> ${nextPoint}`);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/:reviewId/council/finalize", authenticate, authorize("ADMIN", "HOIDONG"), async (req, res, next) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const data = councilFinalizeSchema.parse(req.body);
    const review = await prisma.reviewStep.findUnique({
      where: { id: reviewId },
      include: {
        nomination: {
          include: {
            reviews: true,
            applicant: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    if (!review) return res.status(404).json({ message: "Không tìm thấy phiên duyệt" });
    if (review.level !== "TRUONG") return res.status(400).json({ message: "Chỉ phiên cấp trường mới được chốt" });
    if (review.decision !== "PENDING") return res.status(400).json({ message: "Phiên cấp trường đã được chốt" });
    if (req.user.role !== "ADMIN" && review.reviewerId !== req.user.id) {
      return res.status(403).json({ message: "Chỉ người được phân công phiên cấp trường hoặc admin mới được chốt kết quả" });
    }

    const [members, votes] = await Promise.all([
      prisma.user.findMany({ where: { role: "HOIDONG" }, select: { id: true } }),
      prisma.councilVote.findMany({ where: { nominationId: review.nominationId } }),
    ]);
    const voteSummary = buildVoteSummary(members, votes);

    if (voteSummary.needsMoreVotes) {
      return res.status(400).json({ message: "Chưa đủ phiếu biểu quyết của hội đồng", voteSummary });
    }
    if (voteSummary.isTie) {
      return res.status(400).json({ message: "Kết quả biểu quyết đang hòa. Cần thảo luận hoặc bỏ phiếu lại trước khi chốt", voteSummary });
    }
    if (data.decision === "APPROVED" && !voteSummary.passed) {
      return res.status(400).json({ message: "Không đủ tỷ lệ đồng ý để thông qua hồ sơ", voteSummary });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReview = await tx.reviewStep.update({
        where: { id: reviewId },
        data: {
          decision: data.decision,
          comment: data.comment,
          reviewedAt: new Date(),
        },
      });

      await tx.nomination.update({
        where: { id: review.nominationId },
        data: { status: data.decision === "APPROVED" ? "APPROVED" : "REJECTED" },
      });

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

    await logAudit(req.user.id, "COUNCIL_FINALIZE", `Finalized nomination ${review.nominationId} with ${data.decision}`);
    await createNotification(
      review.nomination.applicantId,
      data.decision === "APPROVED"
        ? `Hồ sơ ${review.nomination.title} đã được hội đồng công nhận`
        : `Hồ sơ ${review.nomination.title} bị hội đồng từ chối`
    );

    let emailDelivery = { sent: false, to: review.nomination.applicant?.email, reason: "Email not attempted" };
    try {
      emailDelivery = await sendReviewDecisionEmail({
        nomination: review.nomination,
        student: review.nomination.applicant,
        decision: data.decision,
        level: review.level,
        comment: data.comment,
      });
      console.log("Council final decision email delivery:", emailDelivery);
    } catch (emailError) {
      emailDelivery = {
        sent: false,
        to: review.nomination.applicant?.email,
        reason: emailError.message,
      };
      console.error("Council final decision email failed:", emailError.message);
    }

    return res.json({ ...updated, voteSummary, emailDelivery });
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
    const hasEvidenceScores = Array.isArray(data.evidenceScores) && data.evidenceScores.length > 0;
    if ([hasScores, hasDetailedScores, hasEvidenceScores].filter(Boolean).length > 1) {
      return res.status(400).json({
        message: "Chỉ được gửi một trong các trường: scores, detailedScores hoặc evidenceScores",
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
            awardType: {
              include: {
                criteria: {
                  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                },
              },
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
              include: {
                awardCriterion: true,
              },
            },
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({ message: "Không tìm thấy phiên duyệt" });
    }

    if (review.reviewerId !== req.user.id) {
      return res.status(403).json({ message: "Không có quyền duyệt phiên này" });
    }

    if (review.decision !== "PENDING") {
      return res.status(400).json({ message: "Phiên duyệt đã được xử lý" });
    }

    const prior = review.nomination.reviews.filter(
      (r) => levelOrder[r.level] < levelOrder[review.level]
    );
    if (!prior.every((p) => p.decision === "APPROVED")) {
      return res.status(400).json({ message: "Cần hoàn tất các cấp trước" });
    }

    if (review.level === "KHOA" && req.user.email !== "canbo1@iuh.edu.vn") {
      return res.status(403).json({ message: "Chỉ canbo1@iuh.edu.vn mới được chấm điểm và duyệt cấp khoa" });
    }

    if (data.decision === "APPROVED" && review.nomination.applicant?.role === "SINHVIEN") {
      const failedConditions = buildStudentReviewConditions(review.nomination).filter((item) => !item.passed);
      if (failedConditions.length) {
        return res.status(400).json({
          message: "Hồ sơ sinh viên chưa đạt điều kiện duyệt",
          conditions: failedConditions,
        });
      }
    }

    let scoreUpdates = null;
    let evidenceScoreUpdates = null;
    if (data.decision === "APPROVED" && review.level === "KHOA") {
      const evidences = review.nomination.evidences || [];
      if (!evidences.length) {
        return res.status(400).json({ message: "Hồ sơ chưa có file minh chứng để cấp khoa chấm điểm" });
      }

      if (!data.evidenceScores?.length) {
        return res.status(400).json({ message: "Cấp khoa phải chấm điểm từng file minh chứng trước khi duyệt" });
      }
    }

    if (data.evidenceScores?.length) {
      if (data.decision !== "APPROVED") {
        return res.status(400).json({ message: "Không thể chấm điểm khi từ chối hồ sơ" });
      }
      if (review.level !== "KHOA") {
        return res.status(400).json({ message: "Chỉ cấp khoa mới chấm điểm từng file minh chứng" });
      }

      const evidences = review.nomination.evidences || [];
      const evidenceById = new Map(evidences.map((evidence) => [evidence.id, evidence]));
      if (data.evidenceScores.length !== evidences.length) {
        return res.status(400).json({ message: "Cần chấm điểm đầy đủ cho tất cả file minh chứng" });
      }

      let totalScore = 0;
      const updates = [];
      for (const entry of data.evidenceScores) {
        const evidence = evidenceById.get(entry.evidenceId);
        if (!evidence) {
          return res.status(400).json({ message: "File minh chứng chấm điểm không hợp lệ" });
        }
        totalScore += entry.score;
        updates.push({ id: evidence.id, score: entry.score });
      }
      evidenceScoreUpdates = { totalScore, updates };
    }

    if (data.scores?.length || data.detailedScores?.length) {
      if (data.decision !== "APPROVED") {
        return res.status(400).json({ message: "Không thể chấm điểm khi từ chối hồ sơ" });
      }

      const items = review.nomination.items || [];
      const itemById = new Map(items.map((item) => [item.id, item]));
      const isDetailedMode = Boolean(data.detailedScores?.length);
      const incomingScores = isDetailedMode ? data.detailedScores : data.scores;
      if ((incomingScores || []).length !== items.length) {
        return res.status(400).json({ message: "Cần chấm điểm đầy đủ cho tất cả tiêu chí lớn" });
      }

      let totalScore = 0;
      const updates = [];
      for (const entry of incomingScores || []) {
        const item = itemById.get(entry.nominationItemId);
        if (!item) {
          return res.status(400).json({ message: "Tiêu chí chấm điểm không hợp lệ" });
        }
        const maxScore = item.criteria?.maxPoint ?? 0;
        const subItems = item.criteria?.subItems || [];

        let finalScore = 0;
        if (isDetailedMode) {
          if (!subItems.length) {
            return res.status(400).json({
              message: `Tiêu chí ${item.criteria?.code || item.id} chưa được cấu hình ý nhỏ để chấm chi tiết`,
            });
          }
          if (entry.subScores.length !== subItems.length) {
            return res.status(400).json({
              message: `Cần chấm đầy đủ tất cả ý nhỏ của tiêu chí ${item.criteria?.code || item.id}`,
            });
          }
          const subItemMap = new Map(subItems.map((subItem) => [subItem.id, subItem]));
          for (const subEntry of entry.subScores) {
            const subItem = subItemMap.get(subEntry.subItemId);
            if (!subItem) {
              return res.status(400).json({ message: "Ý nhỏ chấm điểm không hợp lệ" });
            }
            if (subEntry.score > subItem.maxPoint) {
              return res.status(400).json({
                message: `Điểm vượt quá giới hạn ý nhỏ (${subItem.maxPoint}) của tiêu chí ${item.criteria?.code || item.id}`,
              });
            }
            finalScore += subEntry.score;
          }
        } else {
          finalScore = entry.score;
        }

        if (finalScore < 0 || finalScore > maxScore) {
          return res.status(400).json({
            message: `Điểm vượt quá giới hạn tối đa (${maxScore}) cho tiêu chí ${item.criteria?.code || item.id}`,
          });
        }
        totalScore += finalScore;
        updates.push({ id: item.id, score: finalScore });
      }

      scoreUpdates = { totalScore, updates };
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (evidenceScoreUpdates) {
        await Promise.all(
          evidenceScoreUpdates.updates.map((update) =>
            tx.evidence.update({
              where: { id: update.id },
              data: { reviewPoint: update.score },
            })
          )
        );

        await tx.nomination.update({
          where: { id: review.nominationId },
          data: { totalSelfPoint: evidenceScoreUpdates.totalScore },
        });
      }

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
      `Decision ${data.decision} for nomination ${review.nominationId}${scoreUpdates ? ` | totalScore=${scoreUpdates.totalScore}` : ""}${evidenceScoreUpdates ? ` | evidenceTotalScore=${evidenceScoreUpdates.totalScore}` : ""}`
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
      return res.status(404).json({ message: "Không tìm thấy phiên duyệt" });
    }

    if (review.reviewerId !== req.user.id) {
      return res.status(403).json({ message: "Không có quyền trình hồ sơ này" });
    }

    if (review.level !== "KHOA") {
      return res.status(400).json({ message: "Chỉ cấp khoa mới có thể trình lên cấp trường" });
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

    return res.json({ message: "Đã trình hồ sơ lên cấp trường" });
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
      return res.status(404).json({ message: "Không tìm thấy phiên duyệt" });
    }
    if (review.decision !== "PENDING") {
      return res.status(400).json({ message: "Chỉ được phân công lại phiên đang chờ duyệt" });
    }

    const reviewer = await prisma.user.findUnique({ where: { id: data.reviewerId } });
    if (!reviewer) {
      return res.status(404).json({ message: "Không tìm thấy người duyệt mới" });
    }
    if (!["ADMIN", "CANBO", "HOIDONG"].includes(reviewer.role)) {
      return res.status(400).json({ message: "Người duyệt mới không thuộc nhóm duyệt hợp lệ" });
    }

    const updated = await prisma.reviewStep.update({
      where: { id: reviewId },
      data: { reviewerId: data.reviewerId },
    });

    await createNotification(data.reviewerId, `Bạn được phân công duyệt hồ sơ #${review.nominationId}`);
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
      await createNotification(step.reviewerId, `Nhắc việc: Hồ sơ "${step.nomination?.title || step.nominationId}" đã quá hạn duyệt`);
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
