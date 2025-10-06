require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");

(async () => {
  const prisma = new PrismaClient();
  try {
    // try find a user by email
    let user = await prisma.user.findFirst({
      where: { email: "test@example.com" },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "test@example.com",
          password: null,
          role: "user",
          enabled: true,
        },
      });
      console.log("Created test user:", user.id);
    } else {
      console.log("Found test user:", user.id);
    }

    const payload = { id: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, process.env.SECRET || "PetShopOnline", {
      expiresIn: "7d",
    });
    console.log("TOKEN=" + token);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
})();
