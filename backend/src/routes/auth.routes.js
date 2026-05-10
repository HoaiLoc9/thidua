const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { signAccessToken } = require("../utils/jwt");
const { authenticate } = require("../middlewares/auth");

const router = express.Router();

const registerSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  department: z.string().optional(),
});

router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const existed = await prisma.user.findUnique({ where: { email: data.email } });
    if (existed) {
      return res.status(409).json({ message: "Email da ton tai" });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        passwordHash,
        role: "SINHVIEN",
        department: data.department,
      },
    });

    const token = signAccessToken(user);
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
    });
    const data = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      return res.status(401).json({ message: "Sai tai khoan hoac mat khau" });
    }

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Sai tai khoan hoac mat khau" });
    }

    const token = signAccessToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, async (req, res) => {
  return res.json({
    id: req.user.id,
    fullName: req.user.fullName,
    email: req.user.email,
    role: req.user.role,
    department: req.user.department,
  });
});

router.put("/me", authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      fullName: z.string().min(3).optional(),
      department: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        department: true,
      },
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
