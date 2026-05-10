const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middlewares/auth");

const router = express.Router();

router.get("/", authenticate, async (req, res, next) => {
  try {
    const list = await prisma.department.findMany({ orderBy: { departmentName: "asc" } });
    return res.json(list);
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const schema = z.object({
      departmentName: z.string().min(2),
      departmentType: z.string().min(2),
    });
    const data = schema.parse(req.body);
    const created = await prisma.department.create({ data });
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
