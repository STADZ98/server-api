const { PrismaClient } = require("@prisma/client");

(async () => {
  const p = new PrismaClient();
  try {
    // Create a test user using available fields in schema
    const user = await p.user.create({
      data: { email: "test@example.com", password: null },
    });

    // Create a minimal test order
    const order = await p.order.create({
      data: {
        email: "customer@example.com",
        cartTotal: 1000.0,
        stripePaymentId: "test_pi_123",
        amount: 1000,
        status: "PENDING",
        currency: "THB",
        orderedById: user.id,
      },
    });

    console.log("Created order:", order.id);
  } catch (err) {
    console.error(err);
  } finally {
    await p.$disconnect();
  }
})();
