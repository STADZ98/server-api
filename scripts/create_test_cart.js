require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

(async () => {
  const prisma = new PrismaClient();
  try {
    // ensure test user
    let user = await prisma.user.findFirst({
      where: { email: "dev@example.com" },
    });
    if (!user) {
      user = await prisma.user.create({
        data: { email: "dev@example.com", password: null },
      });
      console.log("Created test user:", user.email);
    } else {
      console.log("Test user exists:", user.email);
    }

    // ensure a product
    let product = await prisma.product.findFirst();
    if (!product) {
      product = await prisma.product.create({
        data: {
          title: "Dev Test Product",
          description: "Auto-created test product",
          price: 49.99,
          quantity: 100,
        },
      });
      console.log("Created product id:", product.id);
    } else {
      console.log("Using existing product id:", product.id);
    }

    // delete existing carts for this user to avoid duplicates
    await prisma.cart.deleteMany({ where: { orderedById: user.id } });

    // create cart and ProductOnCart
    const cart = await prisma.cart.create({
      data: { orderedById: user.id, cartTotal: 0 },
    });

    const poc = await prisma.productOnCart.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        count: 2,
        price: product.price,
      },
    });

    // update cart total
    const total = Number((poc.count * poc.price).toFixed(2));
    await prisma.cart.update({
      where: { id: cart.id },
      data: { cartTotal: total },
    });

    console.log("Created cart id:", cart.id, "total:", total);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
