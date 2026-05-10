const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middlewares/auth");

const router = express.Router();

const criteriaSchema = z.object({
  code: z.string().min(2),
  title: z.string().min(3),
  description: z.string().optional(),
  maxPoint: z.number().int().positive(),
  periodYear: z.number().int().min(2020).optional(),
  academicYearId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

router.get("/", authenticate, async (req, res, next) => {
  try {
    const list = await prisma.criteria.findMany({
      where: {
        isActive: true,
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
      },
      orderBy: { id: "asc" },
    });
    return res.json(list);
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const data = criteriaSchema.parse(req.body);
    const item = await prisma.criteria.create({ data });
    return res.status(201).json(item);
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = criteriaSchema.partial().parse(req.body);
    const item = await prisma.criteria.update({ where: { id }, data });
    return res.json(item);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.criteria.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
