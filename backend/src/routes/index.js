const express = require("express");
const authRoutes = require("./auth.routes");
const usersRoutes = require("./users.routes");
const criteriaRoutes = require("./criteria.routes");
const nominationsRoutes = require("./nominations.routes");
const reviewsRoutes = require("./reviews.routes");
const awardsRoutes = require("./awards.routes");
const reportsRoutes = require("./reports.routes");
const systemRoutes = require("./system.routes");
const departmentsRoutes = require("./departments.routes");
const academicYearsRoutes = require("./academic-years.routes");
const notificationsRoutes = require("./notifications.routes");
const approvalProcessRoutes = require("./approval-process.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/criteria", criteriaRoutes);
router.use("/nominations", nominationsRoutes);
router.use("/reviews", reviewsRoutes);
router.use("/awards", awardsRoutes);
router.use("/reports", reportsRoutes);
router.use("/system", systemRoutes);
router.use("/departments", departmentsRoutes);
router.use("/academic-years", academicYearsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/approval-process", approvalProcessRoutes);

module.exports = router;
