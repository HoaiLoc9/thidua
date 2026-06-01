const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middlewares/auth");

const router = express.Router();

const awardCriterionSchema = z.object({
  title: z.string().min(2),
  description: z.string().nullable().optional(),
  minPoint: z.number().int().min(0).nullable().optional(),
  sortOrder: z.number().int().min(1).optional(),
});

const awardSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(3),
  category: z.string().min(3),
  description: z.string().nullable().optional(),
  periodYear: z.number().int().min(2020),
  academicYearId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  criteria: z.array(awardCriterionSchema).optional(),
});

const toAwardData = (data) => ({
  code: data.code,
  name: data.name,
  category: data.category,
  description: data.description === undefined ? undefined : data.description || null,
  periodYear: data.periodYear,
  academicYearId: data.academicYearId === undefined ? undefined : data.academicYearId || null,
  isActive: data.isActive,
});

const toCriteriaCreateMany = (criteria = []) =>
  criteria
    .map((item, index) => ({
      title: item.title.trim(),
      description: item.description?.trim() || null,
      minPoint: item.minPoint === undefined ? null : item.minPoint,
      sortOrder: item.sortOrder || index + 1,
    }))
    .filter((item) => item.title);

router.get("/", authenticate, async (req, res, next) => {
  try {
    const list = await prisma.awardType.findMany({
      orderBy: [{ periodYear: "desc" }, { id: "asc" }],
      include: {
        criteria: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
      },
    });
    return res.json(list);
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, authorize("ADMIN", "HOIDONG"), async (req, res, next) => {
  try {
    const data = awardSchema.parse(req.body);
    const criteria = toCriteriaCreateMany(data.criteria);
    const item = await prisma.awardType.create({
      data: {
        ...toAwardData(data),
        criteria: criteria.length ? { create: criteria } : undefined,
      },
      include: {
        criteria: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
      },
    });
    return res.status(201).json(item);
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", authenticate, authorize("ADMIN", "HOIDONG"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = awardSchema.partial().parse(req.body);
    const { criteria, ...awardFields } = data;
    const item = await prisma.$transaction(async (tx) => {
      await tx.awardType.update({
        where: { id },
        data: toAwardData(awardFields),
      });

      if (Array.isArray(criteria)) {
        await tx.awardCriterion.deleteMany({ where: { awardTypeId: id } });
        const nextCriteria = toCriteriaCreateMany(criteria);
        if (nextCriteria.length) {
          await tx.awardCriterion.createMany({
            data: nextCriteria.map((criterion) => ({ ...criterion, awardTypeId: id })),
          });
        }
      }

      return tx.awardType.findUnique({
        where: { id },
        include: {
          criteria: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          },
        },
      });
    });
    return res.json(item);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.awardType.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
