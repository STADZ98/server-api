const prisma = require("../config/prisma");

const email = process.argv[2];
if (!email) {
  console.error("Usage: node makeAdmin.js <email>");
  process.exit(1);
}

async function run() {
  try {
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      console.error("User not found with email:", email);
      process.exit(2);
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: "admin" },
    });
    // console.log("Updated user to admin:", updated.email, updated.role);
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(3);
  }
}
run();
