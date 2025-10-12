// category.js
// Controller สำหรับจัดการ category (สร้าง, อ่าน, ลบ, แก้ไข) ในระบบ ecommerce
// มีฟังก์ชั่น slugify, create, list, remove, update
const prisma = require("../config/prisma");

// ฟังก์ชันสร้าง slug จากชื่อ
function slugify(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\-]+/g, "") // ✅ รองรับอักษรไทย
    .replace(/\-\-+/g, "-") // แทน -- ซ้ำๆ ด้วย -
    .replace(/^-+/, "") // ลบ - ที่ขึ้นต้น
    .replace(/-+$/, ""); // ลบ - ที่ท้าย
}

// สร้าง Category
exports.create = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "กรุณาระบุชื่อหมวดหมู่" });
    }

    const slug = slugify(name);
    if (!slug || slug.trim() === "") {
      return res
        .status(400)
        .json({ message: "ไม่สามารถสร้าง slug จากชื่อได้" });
    }

    const { images } = req.body;
    const category = await prisma.category.create({
      data: {
        name,
        slug,
        images: images || "",
      },
    });

    res.send(category);
  } catch (err) {
    console.error("CREATE ERROR:", err);

    if (err.code === "P2002") {
      return res
        .status(400)
        .json({ message: "ชื่อหมวดหมู่หรือ slug นี้ถูกใช้แล้ว" });
    }
    console.error("CREATE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ดึงรายการทั้งหมด
exports.list = async (req, res) => {
  try {
    // Return a lightweight representation to avoid large payloads
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        images: true,
        isActive: true,
      },
      orderBy: { name: "asc" },
    });

    // Map images: if images is JSON string/array, try to extract first URL
    const mapped = categories.map((c) => {
      let imageUrl = null;
      try {
        if (c.images) {
          const imgs = Array.isArray(c.images) ? c.images : JSON.parse(c.images || "[]");
          if (Array.isArray(imgs) && imgs.length) {
            const first = imgs.find(Boolean);
            if (first && typeof first === "string") imageUrl = first;
          } else if (typeof c.images === "string" && c.images.startsWith("data:")) {
            // if it's base64 data URI, don't return it inline; signal null so client can use placeholder
            imageUrl = null;
          }
        }
      } catch (e) {
        imageUrl = null;
      }

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        image: imageUrl,
        isActive: c.isActive,
      };
    });

    // Encourage CDN/browser caching for short period (can be tuned)
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(mapped);
  } catch (err) {
    console.error("category.list error:", err && err.stack ? err.stack : err);
    if (process.env.NODE_ENV !== "production") {
      return res
        .status(500)
        .json({ message: "server error", error: err.message || String(err) });
    }
    res.status(500).json({ message: "server error" });
  }
};

// ลบ Category (แบบส่งคืนข้อมูล)
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await prisma.category.delete({
      where: {
        id: Number(id),
      },
    });
    res.send(category);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "server error" });
  }
};

// ลบ Category (แบบ success: true)
exports.removeCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.category.delete({
      where: { id: Number(id) },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.code === "P2003") {
      return res.status(400).json({
        error: "ไม่สามารถลบหมวดหมู่ที่มีหมวดหมู่ย่อยหรือสินค้าคงอยู่",
      });
    }
    res.status(500).json({ error: err.message || "Server error" });
  }
};

// อัปเดต Category
exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, images } = req.body;

  try {
    const slug = slugify(name);
    const dataToUpdate = { name, slug };
    if (typeof images !== "undefined") {
      dataToUpdate.images = images;
    }
    const updated = await prisma.category.update({
      where: { id: Number(id) },
      data: dataToUpdate,
    });
    res.json(updated);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "ชื่อหรือ slug ซ้ำกัน" });
    }
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};
