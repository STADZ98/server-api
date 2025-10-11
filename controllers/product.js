const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ✅ สร้างสินค้าใหม่
exports.create = async (req, res) => {
  try {
    const data = req.body;
    const product = await prisma.product.create({ data });
    res.json(product);
  } catch (err) {
    console.error("🔥 create product error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ แสดงสินค้าตามจำนวน
exports.list = async (req, res) => {
  try {
    const count = parseInt(req.params.count) || 10;
    const products = await prisma.product.findMany({
      take: count,
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        subcategory: true,
        subSubcategory: true,
        brand: true,
      },
    });
    res.json(products);
  } catch (err) {
    console.error("🔥 list products error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ อ่านข้อมูลสินค้า (ตาม id)
exports.read = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        category: true,
        subcategory: true,
        subSubcategory: true,
        brand: true,
        reviews: {
          include: { user: true },
        },
      },
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error("🔥 read product error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ ลบสินค้า
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id: parseInt(id) } });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("🔥 remove product error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ อัปเดตสินค้า
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const updated = await prisma.product.update({
      where: { id: parseInt(id) },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error("🔥 update product error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ ดึงสินค้าตาม subcategory
exports.listBySubcategory = async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const products = await prisma.product.findMany({
      where: { subcategoryId: parseInt(subcategoryId) },
      include: {
        category: true,
        subcategory: true,
        subSubcategory: true,
        brand: true,
      },
    });
    res.json(products);
  } catch (err) {
    console.error("🔥 listBySubcategory error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ ดึงสินค้าตามชื่อแบรนด์ (เช่น /products?brand=Royal)
exports.listByBrand = async (req, res) => {
  try {
    const { brand } = req.query;
    const products = await prisma.product.findMany({
      where: {
        brand: {
          name: { contains: brand || "", mode: "insensitive" },
        },
      },
      include: {
        category: true,
        subcategory: true,
        subSubcategory: true,
        brand: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(products);
  } catch (err) {
    console.error("🔥 listByBrand error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ ใช้สำหรับหน้า “สินค้าที่เกี่ยวข้อง” หรือ “สินค้าตามหมวดหมู่”
exports.listby = async (req, res) => {
  try {
    const {
      categoryId,
      subcategoryId,
      subSubcategoryId,
      limit = 10,
    } = req.body;

    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (subcategoryId) where.subcategoryId = subcategoryId;
    if (subSubcategoryId) where.subSubcategoryId = subSubcategoryId;

    const products = await prisma.product.findMany({
      where,
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        price: true,
        quantity: true,
        createdAt: true,
        images: true, // ✅ images เป็น String ใน schema ใช้แบบนี้ได้
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
        subSubcategory: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    // Ensure we send an array (prisma returns array on success)
    res.json(Array.isArray(products) ? products : []);
  } catch (err) {
    console.error("🔥 listby error:", err && err.stack ? err.stack : err);
    console.error("Request body:", req.body);
    if (process.env.NODE_ENV !== "production") {
      return res
        .status(500)
        .json({ message: "Server error", error: err.message || String(err) });
    }
    // Defensive response shape for clients
    res.status(500).json({ message: "Server error", data: [] });
  }
};

// ✅ สร้างรูปสินค้า (upload URL)
exports.createImages = async (req, res) => {
  try {
    const { id, images } = req.body;
    const updated = await prisma.product.update({
      where: { id: parseInt(id) },
      data: { images },
    });
    res.json(updated);
  } catch (err) {
    console.error("🔥 createImages error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ ลบรูปสินค้า
exports.removeImage = async (req, res) => {
  try {
    const { id } = req.body;
    const updated = await prisma.product.update({
      where: { id: parseInt(id) },
      data: { images: null },
    });
    res.json(updated);
  } catch (err) {
    console.error("🔥 removeImage error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ สำหรับ search/filter (ราคาช่วง, หมวดหมู่ ฯลฯ)
exports.searchfilters = async (req, res) => {
  try {
    const { query, minPrice, maxPrice, categoryId } = req.body;
    const filters = {};

    if (query) filters.title = { contains: query, mode: "insensitive" };
    if (categoryId) filters.categoryId = categoryId;
    if (minPrice && maxPrice)
      filters.price = { gte: parseFloat(minPrice), lte: parseFloat(maxPrice) };

    const products = await prisma.product.findMany({
      where: filters,
      include: { brand: true, category: true, subcategory: true },
    });

    res.json(products);
  } catch (err) {
    console.error("🔥 searchfilters error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
