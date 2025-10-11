// controllers/subcategory.js
const prisma = require("../config/prisma");

// รองรับ slug ภาษาไทย
function slugify(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\-]+/g, "") // keep a-z, 0-9, -, และอักษรไทย
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// ✅ Create Subcategory
exports.create = async (req, res) => {
  try {
    const { name, categoryId, images } = req.body;
    if (!name || !categoryId) {
      return res.status(400).json({ message: "กรุณาระบุชื่อและ categoryId" });
    }

    // ตรวจสอบ categoryId ว่ามีอยู่จริงไหม
    const categoryExists = await prisma.category.findUnique({
      where: { id: Number(categoryId) },
    });
    if (!categoryExists) {
      return res.status(400).json({ message: "Category ไม่ถูกต้อง" });
    }

    const slug = slugify(name);
    const subcategory = await prisma.subcategory.create({
      data: {
        name,
        slug,
        categoryId: Number(categoryId),
        images: images || "",
      },
    });
    res.status(201).json(subcategory);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "ชื่อหรือ slug นี้ถูกใช้แล้ว" });
    }
    console.error("subcategory.create error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
};

// ✅ Get All Subcategories (with Category and SubSubcategories)
exports.list = async (req, res) => {
  try {
    const { categoryId } = req.query;
    let where = {};
    if (categoryId) {
      const catIdNum = Number(categoryId);
      if (isNaN(catIdNum)) {
        return res.status(400).json({ message: "categoryId ต้องเป็นตัวเลข" });
      }

      // ตรวจสอบ categoryId ว่ามีอยู่จริงไหม
      const categoryExists = await prisma.category.findUnique({
        where: { id: catIdNum },
      });
      if (!categoryExists) {
        return res.status(400).json({ message: "Category ไม่ถูกต้อง" });
      }

      where.categoryId = catIdNum;
    }

    // ใช้ try/catch รอบ include subsubcategories ป้องกัน crash
    let subcategories = [];
    try {
      subcategories = await prisma.subcategory.findMany({
        where,
        include: {
          category: true,
          subsubcategories: true,
        },
      });
    } catch (err) {
      console.error("Prisma include subsubcategories error:", err);
      subcategories = await prisma.subcategory.findMany({
        where,
        include: { category: true }, // fallback: ไม่ include subsubcategories
      });
    }

    res.status(200).json(subcategories);
  } catch (err) {
    console.error(
      "subcategory.list error:",
      err && err.stack ? err.stack : err
    );
    if (process.env.NODE_ENV !== "production") {
      return res.status(500).json({
        message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์",
        error: err.message || String(err),
      });
    }
    res.status(500).json({ message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
};

// ✅ Update Subcategory
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, categoryId, images } = req.body;

    if (!name || !categoryId) {
      return res.status(400).json({ message: "กรุณาระบุชื่อและ categoryId" });
    }

    // ตรวจสอบ categoryId ว่ามีอยู่จริงไหม
    const categoryExists = await prisma.category.findUnique({
      where: { id: Number(categoryId) },
    });
    if (!categoryExists) {
      return res.status(400).json({ message: "Category ไม่ถูกต้อง" });
    }

    const slug = slugify(name);
    const updated = await prisma.subcategory.update({
      where: { id: Number(id) },
      data: {
        name,
        slug,
        categoryId: Number(categoryId),
        ...(images !== undefined ? { images } : {}),
      },
    });
    res.status(200).json(updated);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "ชื่อหรือ slug นี้ถูกใช้แล้ว" });
    }
    console.error("subcategory.update error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
};

// ✅ Delete Subcategory
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const parsedId = Number(id);
    if (!parsedId || Number.isNaN(parsedId) || parsedId <= 0) {
      return res.status(400).json({ message: "id ไม่ถูกต้อง" });
    }

    const found = await prisma.subcategory.findUnique({
      where: { id: parsedId },
      include: { subsubcategories: true, products: true },
    });

    if (!found) {
      return res.status(404).json({ message: "ไม่พบหมวดหมู่ย่อยนี้" });
    }

    const force = String(req.query.force) === "true";
    const relatedSubSubCount = found.subsubcategories
      ? found.subsubcategories.length
      : 0;
    const relatedProductCount = found.products ? found.products.length : 0;
    const relatedCount = relatedSubSubCount + relatedProductCount;

    if (relatedCount > 0 && !force) {
      return res.status(400).json({
        message: "ไม่สามารถลบได้ เนื่องจากมีข้อมูลที่เกี่ยวข้อง",
        relatedSubSubCount,
        relatedProductCount,
      });
    }

    if (force) {
      // Disassociate products' subcategory and subsubcategories' parent before delete
      if (relatedProductCount > 0) {
        await prisma.product.updateMany({
          where: { subcategoryId: parsedId },
          data: { subcategoryId: null },
        });
      }
      if (relatedSubSubCount > 0) {
        // Option: disassociate subsubcategories by setting subcategoryId to null is not allowed (relation required)
        // Instead, delete subsubcategories (cascade might be desired) — here we delete subsubcategories explicitly
        await prisma.subSubcategory.deleteMany({
          where: { subcategoryId: parsedId },
        });
      }
    }

    await prisma.subcategory.delete({ where: { id: parsedId } });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("subcategory.remove error:", err);
    if (err.code === "P2003") {
      return res
        .status(400)
        .json({ message: "ไม่สามารถลบได้ เนื่องจากมีข้อมูลที่เกี่ยวข้อง" });
    }
    res.status(500).json({ message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
};
