const { PrismaClient } = require("@prisma/client");
(async () => {
  const p = new PrismaClient();
  try {
    const updated = await p.order.update({
      where: { id: 1 },
      data: { trackingCarrier: "ไปรษณีย์", trackingCode: "DIRECT123" },
    });
    console.log("Direct update result:", {
      id: updated.id,
      trackingCarrier: updated.trackingCarrier,
      trackingCode: updated.trackingCode,
    });
  } catch (e) {
    console.error(e);
  } finally {
    await p.$disconnect();
  }
})();
