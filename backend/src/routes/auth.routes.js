const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { signAccessToken } = require("../utils/jwt");
const { sendPasswordResetEmail } = require("../utils/email");
const { authenticate } = require("../middlewares/auth");

const router = express.Router();

function signPasswordResetToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

function verifyPasswordResetToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

const registerSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  department: z.string().optional(),
  phone: z.string().optional(),
  studentCode: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

function toNullableDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function userResponse(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    department: user.department,
    phone: user.phone,
    studentCode: user.studentCode,
    dateOfBirth: user.dateOfBirth,
  };
}

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
        phone: data.phone || null,
        studentCode: data.studentCode || null,
        dateOfBirth: toNullableDate(data.dateOfBirth),
      },
    });

    const token = signAccessToken(user);
    return res.status(201).json({
      token,
      user: userResponse(user),
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
      user: userResponse(user),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const data = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    const frontEndBase = process.env.FRONTEND_URL || "http://localhost:5173";
    const token = user ? signPasswordResetToken(user) : null;
    const resetUrl = token ? `${frontEndBase}/reset-password?token=${encodeURIComponent(token)}` : null;

    if (user && token) {
      const emailResult = await sendPasswordResetEmail({
        email: user.email,
        fullName: user.fullName,
        resetUrl,
      });

      if (!emailResult.sent) {
        return res.status(200).json({
          message: "Yeu cau dat lai mat khau da duoc ghi nhan. Vui long kiem tra email.",
        });
      }
    }

    return res.status(200).json({
      message: "Neu email ton tai trong he thong, ban se nhan duoc huong dan dat lai mat khau.",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const schema = z.object({
      token: z.string().min(1),
      password: z.string().min(6),
    });
    const data = schema.parse(req.body);

    let payload;
    try {
      payload = verifyPasswordResetToken(data.token);
    } catch (error) {
      return res.status(400).json({ message: "Lien ket dat lai mat khau khong hop le hoac da het han." });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return res.status(404).json({ message: "Nguoi dung khong ton tai." });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return res.status(200).json({ message: "Mat khau da duoc dat lai thanh cong." });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, async (req, res) => {
  return res.json(userResponse(req.user));
});

router.put("/me", authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      fullName: z.string().min(3).optional(),
      department: z.string().optional(),
      phone: z.string().optional(),
      studentCode: z.string().optional(),
      dateOfBirth: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const updateData = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.studentCode !== undefined) updateData.studentCode = data.studentCode || null;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = toNullableDate(data.dateOfBirth);

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        department: true,
        phone: true,
        studentCode: true,
        dateOfBirth: true,
      },
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.put("/change-password", authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(6),
      newPassword: z.string().min(6),
    });
    const data = schema.parse(req.body);

    const ok = await bcrypt.compare(data.currentPassword, req.user.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: "Mat khau hien tai khong dung" });
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    });

    return res.json({ message: "Doi mat khau thanh cong" });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
