const { PrismaClient } = require("@prisma/client");
(async () => {
  const p = new PrismaClient();
  try {
    const o = await p.order.findFirst();
    if (!o) {
      console.log("NO_ORDER_FOUND");
      return;
    }
    console.log(JSON.stringify(o, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await p.$disconnect();
  }
})();
