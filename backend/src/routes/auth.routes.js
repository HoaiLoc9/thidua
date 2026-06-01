const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { signAccessToken } = require("../utils/jwt");
const { sendPasswordResetOtpEmail } = require("../utils/email");
const { authenticate } = require("../middlewares/auth");

const router = express.Router();

const PASSWORD_RESET_OTP_TTL_MINUTES = 10;

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
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

async function createAndSendOtp(user) {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetOtp.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetOtp.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt,
      },
    }),
  ]);

  return sendPasswordResetOtpEmail({
    email: user.email,
    fullName: user.fullName,
    otp,
    expiresInMinutes: PASSWORD_RESET_OTP_TTL_MINUTES,
  });
}

async function findLatestValidOtp(userId) {
  return prisma.passwordResetOtp.findFirst({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const existed = await prisma.user.findUnique({ where: { email: data.email } });
    if (existed) {
      return res.status(409).json({ message: "Email đã tồn tại" });
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
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
    }

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
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
    if (user) {
      try {
        await createAndSendOtp(user);
      } catch (emailError) {
        console.error("Password reset OTP email failed:", emailError.message);
      }
    }

    return res.status(200).json({
      message: "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã OTP đặt lại mật khẩu.",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      otp: z.string().regex(/^\d{6}$/, "Mã OTP phải gồm 6 chữ số"),
      password: z.string().min(6),
    });
    const data = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại." });
    }

    const otpRecord = await findLatestValidOtp(user.id);
    if (!otpRecord) {
      return res.status(400).json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn." });
    }

    const otpMatched = await bcrypt.compare(data.otp, otpRecord.otpHash);
    if (!otpMatched) {
      return res.status(400).json({ message: "Mã OTP không đúng." });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordResetOtp.update({
        where: { id: otpRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return res.status(200).json({ message: "Mật khẩu đã được đặt lại thành công." });
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

router.post("/change-password/otp", authenticate, async (req, res, next) => {
  try {
    const emailResult = await createAndSendOtp(req.user);

    if (!emailResult.sent) {
      return res.status(200).json({
        message: "Yêu cầu gửi mã OTP đã được ghi nhận. Vui lòng kiểm tra cấu hình email nếu chưa nhận được mã.",
      });
    }

    return res.json({
      message: `Mã OTP đã được gửi về email ${req.user.email}. Mã có hiệu lực trong ${PASSWORD_RESET_OTP_TTL_MINUTES} phút.`,
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/change-password", authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(6),
      newPassword: z.string().min(6),
      otp: z.string().regex(/^\d{6}$/, "Mã OTP phải gồm 6 chữ số"),
    });
    const data = schema.parse(req.body);

    const ok = await bcrypt.compare(data.currentPassword, req.user.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
    }

    const otpRecord = await findLatestValidOtp(req.user.id);
    if (!otpRecord) {
      return res.status(400).json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn." });
    }

    const otpMatched = await bcrypt.compare(data.otp, otpRecord.otpHash);
    if (!otpMatched) {
      return res.status(400).json({ message: "Mã OTP không đúng." });
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash },
      }),
      prisma.passwordResetOtp.update({
        where: { id: otpRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return res.json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
