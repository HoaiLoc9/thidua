const prisma = require("../lib/prisma");

async function logAudit(userId, action, description) {
  if (!userId) return;
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        description,
      },
    });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
}

module.exports = {
  logAudit,
};
