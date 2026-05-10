// BACKEND - CONTROLLER EXAMPLE
// File: backend/src/routes/criteria.routes.js

// Query MongoDB/Prisma để lọc tiêu chí dành cho sinh viên, loại bỏ dữ liệu test/rác
router.get("/", authenticate, async (req, res, next) => {
  try {
    // Lọc chỉ lấy tiêu chí dành cho sinh viên, loại bỏ dữ liệu test/rác
    const list = await prisma.criteria.findMany({
      where: {
        isActive: true,
        isTest: false,
        target: "SINHVIEN",
        code: {
          not: { contains: "POSTMAN" }, // Loại bỏ POSTMAN test
        },
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

// Query Mongoose tương đương (nếu sử dụng MongoDB):
const criteriaSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: String,
  maxPoint: { type: Number, required: true, min: 1 },
  target: { type: String, enum: ["SINHVIEN", "GIANGVIEN", "CANBO"], default: "SINHVIEN" },
  isTest: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// Query lọc
Criteria.find({
  isActive: true,
  isTest: false,
  target: "SINHVIEN",
  code: { $not: /POSTMAN/ },
})
  .select("id code title description maxPoint")
  .sort({ id: 1 })
  .exec();

// SCHEMA UPDATE
// File: backend/prisma/schema.prisma

model Criteria {
  id          Int              @id @default(autoincrement())
  code        String           @unique
  title       String
  description String?
  maxPoint    Int
  target      String           @default("SINHVIEN")  // Thêm: SINHVIEN, GIANGVIEN, CANBO
  isTest      Boolean          @default(false)       // Thêm: để đánh dấu dữ liệu test
  periodYear  Int?
  academicYearId Int?
  isActive    Boolean          @default(true)
  createdAt   DateTime         @default(now())
  academicYear AcademicYear?   @relation(fields: [academicYearId], references: [id], onDelete: SetNull)
  items       NominationItem[]
}
