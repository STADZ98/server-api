require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

(async () => {
  const prisma = new PrismaClient();
  try {
    // find test user
    let user = await prisma.user.findFirst({
      where: { email: "test@example.com" },
    });
    if (!user) {
      console.log(
        "Test user not found. Run create_test_token.js first to create test user."
      );
      process.exit(1);
    }

    // create a product
    let product = await prisma.product.create({
      data: {
        title: "Test Product " + Date.now(),
        description: "Product for review tests",
        price: 99.99,
        quantity: 100,
      },
    });
    console.log("Created product id:", product.id);

    // create a variant for product
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        title: "Test Variant",
        price: 79.99,
        quantity: 50,
      },
    });
    console.log("Created variant id:", variant.id);

    // create an order for the user with this product and variant
    const order = await prisma.order.create({
      data: {
        email: user.email,
        orderedById: user.id,
        cartTotal: 199.98,
        orderStatus: "NOT_PROCESSED",
        amount: 19998,
        status: "PENDING",
        stripePaymentId: "TEST_PAYMENT",
        currency: "THB",
        products: {
          create: [
            {
              productId: product.id,
              variantId: variant.id,
              count: 2,
              price: 99.99,
            },
          ],
        },
      },
      include: { products: true },
    });

    console.log("Created order id:", order.id);
    console.log(
      "Order products:",
      order.products.map((p) => ({
        productId: p.productId,
        variantId: p.variantId,
      }))
    );
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
