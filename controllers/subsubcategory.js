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
// สร้าง SubSubcategory
exports.create = async (req, res) => {
  try {
    const { name, subcategoryId, images } = req.body;
    if (!name || !subcategoryId) {
      return res
        .status(400)
        .json({ message: "กรุณาระบุชื่อและ subcategoryId" });
    }
    const slug = slugify(name); // ✅ สร้าง slug ก่อนใช้
    const subsubcategory = await prisma.subSubcategory.create({
      data: {
        name,
        slug,
        subcategory: {
          connect: { id: Number(subcategoryId) },
        },
        images: images || "",
      },
    });
    res.status(201).json(subsubcategory);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "ชื่อนี้ถูกใช้แล้ว" });
    }
    console.error(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
};
// ดึง SubSubcategory ทั้งหมด หรือ filter ตาม subcategoryId หรือ subcategoryName
exports.list = async (req, res) => {
  try {
    const { subcategoryId, subcategoryName } = req.query;
    if (subcategoryId) {
      const subsubcategories = await prisma.subSubcategory.findMany({
        where: { subcategoryId: Number(subcategoryId) },
        include: {
          subcategory: {
            include: { category: true },
          },
        },
      });
      return res.status(200).json(subsubcategories);
    }
    // ถ้าไม่ส่ง subcategoryId หรือ subcategoryName ให้ดึงทั้งหมด
    const subsubcategories = await prisma.subSubcategory.findMany({
      include: {
        subcategory: {
          include: { category: true },
        },
      },
    });
    res.status(200).json(subsubcategories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
};

// อัปเดต SubSubcategory
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subcategoryId, images } = req.body;
    const slug = slugify(name);
    const dataToUpdate = { name, slug };
    if (typeof images !== "undefined") {
      dataToUpdate.images = images;
    }
    if (subcategoryId) {
      dataToUpdate.subcategory = {
        connect: { id: Number(subcategoryId) },
      };
    }
    const updated = await prisma.subSubcategory.update({
      where: { id: Number(id) },
      data: dataToUpdate,
    });
    res.status(200).json(updated);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "ชื่อนี้ถูกใช้แล้ว" });
    }
    console.error(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
};

// ลบ SubSubcategory
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const found = await prisma.subSubcategory.findUnique({
      where: { id: Number(id) },
    });
    if (!found) {
      return res
        .status(404)
        .json({ message: "ไม่พบหมวดหมู่ย่อยระดับ 2 ที่ต้องการลบ" });
    }
    await prisma.subSubcategory.delete({ where: { id: Number(id) } });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.code === "P2003") {
      return res
        .status(400)
        .json({ message: "ไม่สามารถลบได้ เนื่องจากมีข้อมูลที่เกี่ยวข้อง" });
    }
    res.status(500).json({ message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
};
