const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

(async () => {
  const prisma = new PrismaClient();
  try {
    console.log("Checking for existing columns...");
    // MySQL: check information_schema for columns
    const [{ exists_carrier }] = await prisma.$queryRaw`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order' AND COLUMN_NAME = 'trackingCarrier'
      ) as exists_carrier
    `;

    const [{ exists_code }] = await prisma.$queryRaw`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order' AND COLUMN_NAME = 'trackingCode'
      ) as exists_code
    `;

    if (exists_carrier && exists_code) {
      console.log("Columns already exist. Nothing to do.");
      process.exit(0);
    }

    const statements = [];
    if (!exists_carrier)
      statements.push(
        "ALTER TABLE `order` ADD COLUMN `trackingCarrier` VARCHAR(255) NULL"
      );
    if (!exists_code)
      statements.push(
        "ALTER TABLE `order` ADD COLUMN `trackingCode` VARCHAR(255) NULL"
      );

    for (const s of statements) {
      console.log("Executing:", s);
      await prisma.$executeRawUnsafe(s);
    }

    console.log("Done. Columns added.");
  } catch (err) {
    console.error("Error running alter table:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
