const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middlewares/auth");

const router = express.Router();

router.get("/", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const processes = await prisma.approvalProcess.findMany({
      include: { steps: { orderBy: { stepOrder: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
    return res.json(processes);
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const schema = z.object({
      processName: z.string().min(3),
      description: z.string().optional(),
      steps: z.array(
        z.object({
          stepOrder: z.number().int().positive(),
          role: z.enum(["CANBO", "HOIDONG", "ADMIN"]),
          description: z.string().optional(),
        })
      ).min(1),
    });

    const data = schema.parse(req.body);
    const created = await prisma.approvalProcess.create({
      data: {
        processName: data.processName,
        description: data.description,
        steps: { create: data.steps },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      processName: z.string().min(3),
      description: z.string().optional(),
      steps: z.array(
        z.object({
          stepOrder: z.number().int().positive(),
          role: z.enum(["CANBO", "HOIDONG", "ADMIN"]),
          description: z.string().optional(),
        })
      ).min(1),
    });

    const data = schema.parse(req.body);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.approvalStep.deleteMany({ where: { processId: id } });
      return tx.approvalProcess.update({
        where: { id },
        data: {
          processName: data.processName,
          description: data.description,
          steps: { create: data.steps },
        },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
