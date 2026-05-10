const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middlewares/auth");

const router = express.Router();

const awardSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(3),
  category: z.string().min(3),
  description: z.string().optional(),
  periodYear: z.number().int().min(2020),
  academicYearId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

router.get("/", authenticate, async (req, res, next) => {
  try {
    const list = await prisma.awardType.findMany({
      orderBy: [{ periodYear: "desc" }, { id: "asc" }],
    });
    return res.json(list);
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, authorize("ADMIN", "HOIDONG"), async (req, res, next) => {
  try {
    const data = awardSchema.parse(req.body);
    const item = await prisma.awardType.create({ data });
    return res.status(201).json(item);
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", authenticate, authorize("ADMIN", "HOIDONG"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = awardSchema.partial().parse(req.body);
    const item = await prisma.awardType.update({ where: { id }, data });
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
