const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

  const departments = [
    { departmentName: "Khoa CNTT", departmentType: "KHOA" },
    { departmentName: "Phong To Chuc", departmentType: "PHONG" },
    { departmentName: "Phong Cong tac sinh vien", departmentType: "PHONG" },
  ];

  for (const dep of departments) {
    await prisma.department.upsert({
      where: { departmentName: dep.departmentName },
      update: dep,
      create: dep,
    });
  }

  const khoaCntt = await prisma.department.findUnique({ where: { departmentName: "Khoa CNTT" } });
  const phongToChuc = await prisma.department.findUnique({ where: { departmentName: "Phong To Chuc" } });
  const phongSinhVien = await prisma.department.findUnique({ where: { departmentName: "Phong Cong tac sinh vien" } });

  await prisma.academicYear.upsert({
    where: { yearName: "2025-2026" },
    update: {
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-07-31"),
      isActive: true,
    },
    create: {
      yearName: "2025-2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-07-31"),
      isActive: true,
    },
  });

  const activeYear = await prisma.academicYear.findUnique({ where: { yearName: "2025-2026" } });

  await prisma.user.upsert({
    where: { email: "admin@iuh.edu.vn" },
    update: {
      departmentId: phongToChuc.id,
    },
    create: {
      fullName: "Quan tri he thong",
      email: "admin@iuh.edu.vn",
      passwordHash,
      role: "ADMIN",
      department: "Phong To Chuc",
      departmentId: phongToChuc.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "canbo1@iuh.edu.vn" },
    update: {
      departmentId: khoaCntt.id,
    },
    create: {
      fullName: "Can bo Don vi",
      email: "canbo1@iuh.edu.vn",
      passwordHash,
      role: "CANBO",
      department: "Khoa CNTT",
      departmentId: khoaCntt.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "canbo2@iuh.edu.vn" },
    update: {
      departmentId: khoaCntt.id,
    },
    create: {
      fullName: "Can bo Khoa",
      email: "canbo2@iuh.edu.vn",
      passwordHash,
      role: "CANBO",
      department: "Khoa CNTT",
      departmentId: khoaCntt.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "gv@iuh.edu.vn" },
    update: {
      departmentId: khoaCntt.id,
    },
    create: {
      fullName: "Giang vien Mau",
      email: "gv@iuh.edu.vn",
      passwordHash,
      role: "GIANGVIEN",
      department: "Khoa CNTT",
      departmentId: khoaCntt.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "sv@iuh.edu.vn" },
    update: {
      departmentId: khoaCntt.id,
    },
    create: {
      fullName: "Sinh vien Mau",
      email: "sv@iuh.edu.vn",
      passwordHash,
      role: "SINHVIEN",
      department: "Khoa CNTT",
      departmentId: khoaCntt.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "hoidong@iuh.edu.vn" },
    update: {
      departmentId: phongSinhVien.id,
    },
    create: {
      fullName: "Hoi dong thi dua cap truong",
      email: "hoidong@iuh.edu.vn",
      passwordHash,
      role: "HOIDONG",
      department: "Phong Cong tac sinh vien",
      departmentId: phongSinhVien.id,
    },
  });

  const criteriaData = [
    {
      code: "NCKH",
      title: "Nghien cuu khoa hoc",
      description: "Bai bao, de tai, sang kien.",
      maxPoint: 40,
      periodYear: 2026,
      academicYearId: activeYear.id,
    },
    {
      code: "GIANGDAY",
      title: "Chat luong giang day",
      description: "Danh gia hoc phan, doi moi phuong phap.",
      maxPoint: 35,
      periodYear: 2026,
      academicYearId: activeYear.id,
    },
    {
      code: "DOAN_THE",
      title: "Cong tac doan the",
      description: "Hoat dong cong dong, phong trao.",
      maxPoint: 25,
      periodYear: 2026,
      academicYearId: activeYear.id,
    },
  ];

  for (const item of criteriaData) {
    await prisma.criteria.upsert({
      where: { code: item.code },
      update: {
        title: item.title,
        description: item.description,
        maxPoint: item.maxPoint,
        periodYear: item.periodYear,
        academicYearId: item.academicYearId,
      },
      create: item,
    });
  }

  const awardData = [
    {
      code: "DHTD_LDTT",
      name: "Lao dong tien tien",
      category: "Danh hieu thi dua",
      description: "Danh hieu cho ca nhan hoan thanh tot nhiem vu.",
      periodYear: 2026,
      academicYearId: activeYear.id,
    },
    {
      code: "DHTD_CSTD",
      name: "Chien si thi dua co so",
      category: "Danh hieu thi dua",
      description: "Danh hieu cho ca nhan co sang kien va ket qua noi bat.",
      periodYear: 2026,
      academicYearId: activeYear.id,
    },
    {
      code: "KT_BGH",
      name: "Giay khen cap truong",
      category: "Hinh thuc khen thuong",
      description: "Khen thuong do Hoi dong thi dua cap truong de xuat.",
      periodYear: 2026,
      academicYearId: activeYear.id,
    },
  ];

  for (const item of awardData) {
    await prisma.awardType.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });
  }

  const existingProcess = await prisma.approvalProcess.findFirst({
    where: { processName: "Quy trinh mac dinh" },
  });

  if (!existingProcess) {
    await prisma.approvalProcess.create({
      data: {
        processName: "Quy trinh mac dinh",
        description: "Xet duyet theo cap Khoa -> Truong",
        steps: {
          create: [
            { stepOrder: 1, role: "CANBO", description: "Duyet cap don vi" },
            { stepOrder: 2, role: "CANBO", description: "Duyet cap khoa" },
            { stepOrder: 3, role: "HOIDONG", description: "Phe duyet cap truong" },
          ],
        },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed completed");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
