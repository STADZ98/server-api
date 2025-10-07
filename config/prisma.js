// prisma.js
// Prisma client สำหรับ production ใช้ฐานข้อมูลจริง
// Local dev fallback เป็น mock data

const { PrismaClient } = require("@prisma/client");
const isProd = process.env.NODE_ENV === "production";

let prisma;

if (isProd) {
  // Production: ต่อฐานข้อมูลจริง
  prisma = new PrismaClient();
  prisma
    .$connect()
    .then(() => console.log("Prisma: successfully connected to database"))
    .catch((err) => {
      console.error(
        "Prisma: unable to connect to database!",
        err.message || err
      );
    });
} else {
  // Local dev: mock data fallback
  const makeModelMock = (name) => {
    const samples = {
      category: [
        {
          id: 1,
          name: "ตัวอย่างหมวดหมู่",
          images: "",
          slug: "ตัวอย่างหมวดหมู่",
          isActive: true,
        },
        {
          id: 2,
          name: "อาหารสัตว์",
          images: "",
          slug: "อาหาร-สัตว์",
          isActive: true,
        },
      ],
      subcategory: [
        {
          id: 1,
          name: "แห้ง",
          images: "",
          slug: "แห้ง",
          categoryId: 2,
          isActive: true,
        },
        {
          id: 2,
          name: "เปียก",
          images: "",
          slug: "เปียก",
          categoryId: 2,
          isActive: true,
        },
      ],
      product: [
        {
          id: 1,
          title: "อาหารแมวตัวอย่าง",
          description: "คำอธิบายตัวอย่าง",
          price: 199,
          sold: 0,
          quantity: 10,
        },
        {
          id: 2,
          title: "อาหารสุนัขตัวอย่าง",
          description: "คำอธิบายตัวอย่าง",
          price: 299,
          sold: 0,
          quantity: 5,
        },
      ],
      brand: [{ id: 1, name: "ยี่ห้อA", images: "" }],
    };

    return {
      findMany: async () => samples[name] || [],
      findUnique: async (args) => {
        const list = samples[name] || [];
        if (!args || !args.where) return list[0] || null;
        if (args.where.id)
          return list.find((i) => i.id === Number(args.where.id)) || null;
        return list[0] || null;
      },
      findFirst: async () => (samples[name] || [])[0] || null,
      create: async ({ data }) => ({ id: Date.now(), ...data }),
      update: async () => {
        throw new Error(`${name}.update() called but DB not connected`);
      },
      delete: async () => {
        throw new Error(`${name}.delete() called but DB not connected`);
      },
      count: async () => (samples[name] || []).length,
    };
  };

  const mockPrisma = {
    category: makeModelMock("category"),
    subcategory: makeModelMock("subcategory"),
    subSubcategory: makeModelMock("subSubcategory"),
    brand: makeModelMock("brand"),
    product: makeModelMock("product"),
    order: makeModelMock("order"),
    cart: makeModelMock("cart"),
    productOnOrder: makeModelMock("productOnOrder"),
    productOnCart: makeModelMock("productOnCart"),
    productVariant: makeModelMock("productVariant"),
    // image and variantImage models removed; images are stored as JSON on product/productVariant
    review: makeModelMock("review"),
    address: makeModelMock("address"),
    user: makeModelMock("user"),
  };

  prisma = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop in mockPrisma) return mockPrisma[prop];
        return undefined;
      },
    }
  );

  console.log("Prisma: running in local dev mode with mock data");
}

module.exports = prisma;
