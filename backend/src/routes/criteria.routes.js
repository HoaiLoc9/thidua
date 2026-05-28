const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middlewares/auth");
const { logAudit } = require("../utils/audit");

const router = express.Router();

const criteriaSchema = z.object({
  code: z.string().min(2),
  title: z.string().min(3),
  description: z.string().optional(),
  maxPoint: z.number().int().positive(),
  target: z.enum(["SINHVIEN", "GIANGVIEN"]).optional(),
  reviewLevel: z.enum(["DONVI", "KHOA", "TRUONG"]).optional(),
  periodYear: z.number().int().min(2020).optional(),
  academicYearId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

const subItemSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  maxPoint: z.number().int().positive(),
  sortOrder: z.number().int().positive().optional(),
});

async function ensureSubItemsNotExceedCriteriaMax(criteriaId, tx = prisma) {
  const [criteria, aggregate] = await Promise.all([
    tx.criteria.findUnique({ where: { id: criteriaId }, select: { maxPoint: true } }),
    tx.criteriaSubItem.aggregate({
      where: { criteriaId },
      _sum: { maxPoint: true },
    }),
  ]);

  if (!criteria) {
    return { ok: false, status: 404, message: "Không tìm thấy tiêu chí" };
  }

  const totalSubPoint = aggregate._sum.maxPoint || 0;
  if (totalSubPoint > criteria.maxPoint) {
    return {
      ok: false,
      status: 400,
      message: `Tổng điểm các ý nhỏ (${totalSubPoint}) vượt quá điểm tối đa của tiêu chí lớn (${criteria.maxPoint}). Vui lòng nhập lại điểm phù hợp.`,
    };
  }

  return { ok: true };
}

router.get("/", authenticate, async (req, res, next) => {
  try {
    const level = req.query.reviewLevel;
    const target = req.query.target || (req.user.role === "GIANGVIEN" ? "GIANGVIEN" : "SINHVIEN");
    const list = await prisma.criteria.findMany({
      where: {
        isActive: true,
        target,
        ...(level ? { reviewLevel: level } : {}),
        AND: [
          { code: { not: { contains: "POSTMAN" } } },
          { code: { not: { contains: "GIANGDAY" } } },
        ],
      },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        maxPoint: true,
        target: true,
        reviewLevel: true,
        subItems: {
          select: {
            id: true,
            title: true,
            description: true,
            maxPoint: true,
            sortOrder: true,
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
      },
      orderBy: { id: "asc" },
    });
    return res.json(list);
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, authorize("ADMIN", "HOIDONG"), async (req, res, next) => {
  try {
    const data = criteriaSchema.parse(req.body);
    const item = await prisma.criteria.create({ data });
    await logAudit(req.user.id, "CREATE_CRITERIA", `Created criteria ${item.code}`);
    return res.status(201).json(item);
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", authenticate, authorize("ADMIN", "HOIDONG"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = criteriaSchema.partial().parse(req.body);
    const item = await prisma.criteria.update({ where: { id }, data });
    await logAudit(req.user.id, "UPDATE_CRITERIA", `Updated criteria ${id}`);
    return res.json(item);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", authenticate, authorize("ADMIN", "HOIDONG"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.criteria.delete({ where: { id } });
    await logAudit(req.user.id, "DELETE_CRITERIA", `Deleted criteria ${id}`);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/sub-items", authenticate, authorize("ADMIN", "HOIDONG"), async (req, res, next) => {
  try {
    const criteriaId = Number(req.params.id);
    const data = subItemSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.criteriaSubItem.create({
        data: {
          criteriaId,
          title: data.title,
          description: data.description,
          maxPoint: data.maxPoint,
          sortOrder: data.sortOrder || 1,
        },
      });

      const validation = await ensureSubItemsNotExceedCriteriaMax(criteriaId, tx);
      if (!validation.ok) {
        throw Object.assign(new Error(validation.message), { status: validation.status });
      }

      return created;
    });
    await logAudit(req.user.id, "CREATE_CRITERIA_SUBITEM", `Created sub-item for criteria ${criteriaId}`);

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

router.put("/sub-items/:subItemId", authenticate, authorize("ADMIN", "HOIDONG"), async (req, res, next) => {
  try {
    const subItemId = Number(req.params.subItemId);
    const data = subItemSchema.partial().parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.criteriaSubItem.findUnique({
        where: { id: subItemId },
        select: { id: true, criteriaId: true },
      });
      if (!current) {
        throw Object.assign(new Error("Không tìm thấy ý nhỏ"), { status: 404 });
      }

      const updated = await tx.criteriaSubItem.update({
        where: { id: subItemId },
        data,
      });

      const validation = await ensureSubItemsNotExceedCriteriaMax(current.criteriaId, tx);
      if (!validation.ok) {
        throw Object.assign(new Error(validation.message), { status: validation.status });
      }

      return updated;
    });
    await logAudit(req.user.id, "UPDATE_CRITERIA_SUBITEM", `Updated sub-item ${subItemId}`);

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.delete("/sub-items/:subItemId", authenticate, authorize("ADMIN", "HOIDONG"), async (req, res, next) => {
  try {
    const subItemId = Number(req.params.subItemId);
    await prisma.criteriaSubItem.delete({ where: { id: subItemId } });
    await logAudit(req.user.id, "DELETE_CRITERIA_SUBITEM", `Deleted sub-item ${subItemId}`);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
