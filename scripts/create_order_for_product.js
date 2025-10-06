require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
(async () => {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({
      where: { email: "test@example.com" },
    });
    if (!user) {
      console.error("Test user not found");
      process.exit(1);
    }
    // Find product 48 and variant 5
    const product = await prisma.product.findUnique({ where: { id: 48 } });
    const variant = await prisma.productVariant.findFirst({ where: { id: 5 } });
    if (!product || !variant) {
      console.error("product/variant not found");
      process.exit(1);
    }
    const order = await prisma.order.create({
      data: {
        email: user.email,
        orderedById: user.id,
        cartTotal: product.price,
        orderStatus: "NOT_PROCESSED",
        amount: Math.round(product.price * 100),
        status: "PENDING",
        currency: "THB",
        stripePaymentId: "TEST2",
        products: {
          create: [
            {
              productId: product.id,
              variantId: variant.id,
              count: 1,
              price: product.price,
            },
          ],
        },
      },
      include: { products: true },
    });
    console.log("Created order id:", order.id);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
