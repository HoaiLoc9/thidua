const prisma = require("../lib/prisma");

async function createNotification(userId, message) {
  if (!userId) return;
  try {
    await prisma.notification.create({
      data: {
        userId,
        message,
      },
    });
  } catch (error) {
    console.error("Notification create failed:", error.message);
  }
}

module.exports = {
  createNotification,
};
