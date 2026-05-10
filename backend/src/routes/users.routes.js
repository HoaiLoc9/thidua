const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middlewares/auth");
const { logAudit } = require("../utils/audit");

const router = express.Router();

router.get("/", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        department: true,
        createdAt: true,
      },
    });

    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const schema = z.object({
      fullName: z.string().min(3),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(["ADMIN", "CANBO", "GIANGVIEN", "SINHVIEN", "HOIDONG"]),
      department: z.string().optional(),
      departmentId: z.number().int().positive().optional(),
    });
    const data = schema.parse(req.body);

    const existed = await prisma.user.findUnique({ where: { email: data.email } });
    if (existed) {
      return res.status(409).json({ message: "Email da ton tai" });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const created = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        passwordHash,
        role: data.role,
        department: data.department,
        departmentId: data.departmentId,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        department: true,
        departmentId: true,
      },
    });

    await logAudit(req.user.id, "CREATE_USER", `Created user ${created.email}`);
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      fullName: z.string().min(3).optional(),
      role: z.enum(["ADMIN", "CANBO", "GIANGVIEN", "SINHVIEN", "HOIDONG"]).optional(),
      department: z.string().nullable().optional(),
      departmentId: z.number().int().positive().nullable().optional(),
      password: z.string().min(6).optional(),
    });
    const data = schema.parse(req.body);

    const updateData = {
      fullName: data.fullName,
      role: data.role,
      department: data.department === undefined ? undefined : data.department,
      departmentId: data.departmentId === undefined ? undefined : data.departmentId,
    };

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        department: true,
        departmentId: true,
      },
    });

    await logAudit(req.user.id, "UPDATE_USER", `Updated user ${updated.email}`);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ message: "Khong the xoa chinh tai khoan dang dang nhap" });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: "Khong tim thay nguoi dung" });
    }

    await prisma.user.delete({ where: { id } });
    await logAudit(req.user.id, "DELETE_USER", `Deleted user ${user.email}`);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
