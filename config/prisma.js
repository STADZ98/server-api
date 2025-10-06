// prisma.js
// Resilient Prisma client: try to connect on startup; if connection fails,
// export a lightweight mock that lets read endpoints return empty results
// instead of crashing the server. This is intended for local dev fallback only.
const { PrismaClient } = require("@prisma/client");

const realPrisma = new PrismaClient();
let isConnected = false;

// attempt to connect immediately; set isConnected flag accordingly
realPrisma
  .$connect()
  .then(() => {
    isConnected = true;
    console.log("Prisma: successfully connected to database");
  })
  .catch((err) => {
    isConnected = false;
    console.error(
      "Prisma: unable to connect to database. Falling back to mock.",
      err.message || err
    );
  });

// Minimal mock implementation for common operations used by controllers.
// Read operations return empty arrays / nulls. Create/update/delete throw so
// writes are clearly not supported when DB is down.
const makeModelMock = (name) => {
  // small sample datasets for read endpoints
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
        price: 199.0,
        sold: 0,
        quantity: 10,
      },
      {
        id: 2,
        title: "อาหารสุนัขตัวอย่าง",
        description: "คำอธิบายตัวอย่าง",
        price: 299.0,
        sold: 0,
        quantity: 5,
      },
    ],
    brand: [{ id: 1, name: "ยี่ห้อA", images: "" }],
  };

  return {
    findMany: async () => {
      console.warn(
        `Prisma mock: ${name}.findMany() called — returning sample data`
      );
      return samples[name] || [];
    },
    findUnique: async (args) => {
      console.warn(
        `Prisma mock: ${name}.findUnique() called — returning first sample or null`
      );
      const list = samples[name] || [];
      if (!args || !args.where) return list[0] || null;
      // try to match by id
      if (args.where.id)
        return list.find((i) => i.id === Number(args.where.id)) || null;
      return list[0] || null;
    },
    findFirst: async () => {
      console.warn(
        `Prisma mock: ${name}.findFirst() called — returning first sample or null`
      );
      const list = samples[name] || [];
      return list[0] || null;
    },
    create: async ({ data }) => {
      console.warn(`Prisma mock: ${name}.create() called — returning stub`);
      return { id: Date.now(), ...data };
    },
    update: async () => {
      throw new Error(
        `Prisma mock: ${name}.update() called but DB is not connected`
      );
    },
    delete: async () => {
      throw new Error(
        `Prisma mock: ${name}.delete() called but DB is not connected`
      );
    },
    count: async () => {
      const list = samples[name] || [];
      return list.length;
    },
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
  image: makeModelMock("image"),
  variantImage: makeModelMock("variantImage"),
  review: makeModelMock("review"),
  address: makeModelMock("address"),
  user: makeModelMock("user"),
  // basic $queryRaw passthrough that throws when used in mock mode
  $queryRaw: async () => {
    throw new Error(
      "Prisma mock: $queryRaw not supported while DB is disconnected"
    );
  },
  $executeRaw: async () => {
    throw new Error(
      "Prisma mock: $executeRaw not supported while DB is disconnected"
    );
  },
};

// Export a proxy that delegates to the real prisma when connected, otherwise
// returns the mock implementations for model methods and no-op for lifecycle methods.
const exported = new Proxy(
  {},
  {
    get(_, prop) {
      // allow access to connection state
      if (prop === "isConnected") return () => isConnected;

      // lifecycle helpers — delegate or no-op
      if (prop === "$connect") return async () => realPrisma.$connect();
      if (prop === "$disconnect") return async () => realPrisma.$disconnect();

      // if connected, return the real prisma model or method
      if (isConnected && realPrisma && prop in realPrisma) {
        return realPrisma[prop];
      }

      // otherwise, return mock if available
      if (prop in mockPrisma) return mockPrisma[prop];

      // fallback: if method exists on realPrisma return a wrapper that will
      // either call it when connected or throw a clearer error.
      if (realPrisma && prop in realPrisma) {
        return async (...args) => {
          if (!isConnected)
            throw new Error(
              `Database not connected: attempted ${String(prop)}`
            );
          return realPrisma[prop](...args);
        };
      }

      // unknown property — return undefined
      return undefined;
    },
  }
);

module.exports = exported;
