const prisma = require("../config/prisma");

exports.list = async (req, res) => {
  try {
    const brands = await prisma.brand.findMany();
    res.json(brands);
  } catch (err) {
    console.error("brand.list error:", err && err.stack ? err.stack : err);
    if (process.env.NODE_ENV !== "production") {
      return res
        .status(500)
        .json({ message: "Server error", error: err.message || String(err) });
    }
    res.status(500).json({ message: "Server error" });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, images } = req.body;
    const brand = await prisma.brand.create({
      data: {
        name,
        images: images || "",
      },
    });
    res.json(brand);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.brand.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, images } = req.body;
    const brand = await prisma.brand.update({
      where: { id: Number(id) },
      data: {
        name,
        ...(images !== undefined ? { images } : {}),
      },
    });
    res.json(brand);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
