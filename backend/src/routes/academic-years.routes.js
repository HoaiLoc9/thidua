const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middlewares/auth");

const router = express.Router();

router.get("/", authenticate, async (req, res, next) => {
  try {
    const list = await prisma.academicYear.findMany({ orderBy: { startDate: "desc" } });
    return res.json(list);
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const schema = z.object({
      yearName: z.string().min(4),
      startDate: z.string(),
      endDate: z.string(),
      isActive: z.boolean().optional(),
    });
    const data = schema.parse(req.body);

    const created = await prisma.academicYear.create({
      data: {
        yearName: data.yearName,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: data.isActive ?? true,
      },
    });

    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
