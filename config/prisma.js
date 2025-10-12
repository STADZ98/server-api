// prisma.js
// ✅ ใช้ Prisma Client จริงใน production
// ✅ ใช้ mock data ใน development แบบปลอดภัย

const { PrismaClient } = require("@prisma/client");
const isProd = process.env.NODE_ENV === "production";

let prisma;

if (isProd) {
  // Production: ใช้ฐานข้อมูลจริง
  prisma = new PrismaClient();

  prisma
    .$connect()
    .then(() => console.log("✅ Prisma: successfully connected to database"))
    .catch((err) => {
      console.error("❌ Prisma: unable to connect to database!", err.message);
    });
} else {
  // Development: mock data
  console.log("⚙️ Prisma: running in local dev mode with mock data");

  const mockData = {
    category: [
      {
        id: 1,
        name: "อาหารสัตว์",
        images: "",
        slug: "อาหารสัตว์",
        isActive: true,
      },
      {
        id: 2,
        name: "อุปกรณ์สัตว์เลี้ยง",
        images: "",
        slug: "อุปกรณ์-สัตว์เลี้ยง",
        isActive: true,
      },
    ],
    subcategory: [
      {
        id: 1,
        name: "อาหารแมว",
        images: "",
        slug: "อาหารแมว",
        categoryId: 1,
        isActive: true,
      },
      {
        id: 2,
        name: "อาหารสุนัข",
        images: "",
        slug: "อาหารสุนัข",
        categoryId: 1,
        isActive: true,
      },
    ],
    brand: [{ id: 1, name: "PetPro", images: "" }],
    product: [
      {
        id: 1,
        title: "อาหารแมวสูตรปลาทะเล",
        description: "อุดมไปด้วยสารอาหารครบถ้วน",
        price: 199,
        sold: 10,
        quantity: 20,
        categoryId: 1,
        subcategoryId: 1,
        brandId: 1,
        images: "[]",
      },
      {
        id: 2,
        title: "ปลอกคอสุนัขหนังแท้",
        description: "ทนทานและดูดี",
        price: 299,
        sold: 5,
        quantity: 15,
        categoryId: 2,
        subcategoryId: 2,
        brandId: 1,
        images: "[]",
      },
    ],
    user: [
      {
        id: 1,
        email: "test@example.com",
        password: "hashedpassword",
        role: "user",
        enabled: true,
      },
    ],
  };

  const makeModelMock = (name) => ({
    findMany: async () => mockData[name] || [],
    findUnique: async (args) => {
      const list = mockData[name] || [];
      if (!args?.where) return list[0] || null;
      if (args.where.id) {
        return list.find((i) => i.id === Number(args.where.id)) || null;
      }
      return list[0] || null;
    },
    findFirst: async () => (mockData[name] || [])[0] || null,
    create: async ({ data }) => {
      const newItem = { id: Date.now(), ...data };
      (mockData[name] ||= []).push(newItem);
      return newItem;
    },
    update: async () => {
      throw new Error(`${name}.update() called but DB not connected`);
    },
    delete: async () => {
      throw new Error(`${name}.delete() called but DB not connected`);
    },
    count: async () => (mockData[name] || []).length,
  });

  // Mock Prisma Client
  prisma = new Proxy(
    {},
    {
      get(_, prop) {
        if (mockData[prop]) return makeModelMock(prop);
        return makeModelMock(prop); // fallback
      },
    }
  );
}

module.exports = prisma;
