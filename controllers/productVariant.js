require("dotenv").config();
const prisma = require("../config/prisma");

// Helper to safely parse images JSON
function parseImagesField(field) {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === "string") {
    try {
      return JSON.parse(field);
    } catch (e) {
      return [];
    }
  }
  return [];
}

// Create variant for a product
exports.createVariant = async (req, res) => {
  try {
    const { productId, title, sku, price, quantity, attributes, images } =
      req.body;
    if (!productId)
      return res.status(400).json({ message: "productId is required" });

    const data = {
      productId: Number(productId),
      title: title || null,
      sku: sku || null,
      price: price !== undefined && price !== null ? parseFloat(price) : null,
      quantity: quantity !== undefined ? parseInt(quantity) : 0,
      attributes: attributes ? attributes : null,
      images: Array.isArray(images) ? JSON.stringify(images) : images || "",
    };

    const variant = await prisma.productVariant.create({ data });
    variant.images = parseImagesField(variant.images);
    res.status(201).json(variant);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    res.status(500).json({ message: "Server error" });
  }
};

// List variants of a product
exports.listByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const variants = await prisma.productVariant.findMany({
      where: { productId: Number(productId) },
      orderBy: { createdAt: "desc" },
    });
    variants.forEach((v) => (v.images = parseImagesField(v.images)));
    res.json(variants);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    res.status(500).json({ message: "Server error" });
  }
};

// Read single variant
exports.readVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const variant = await prisma.productVariant.findFirst({
      where: { id: Number(id) },
      include: { product: true },
    });
    if (!variant) return res.status(404).json({ message: "Variant not found" });
    variant.images = parseImagesField(variant.images);
    res.json(variant);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update variant
exports.updateVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, sku, price, quantity, attributes, images } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (sku !== undefined) updateData.sku = sku;
    if (price !== undefined)
      updateData.price = price !== null ? parseFloat(price) : null;
    if (quantity !== undefined) updateData.quantity = parseInt(quantity);
    if (attributes !== undefined) updateData.attributes = attributes;

    if (images !== undefined) {
      updateData.images = Array.isArray(images)
        ? JSON.stringify(images)
        : images || "";
    }

    const variant = await prisma.productVariant.update({
      where: { id: Number(id) },
      data: updateData,
    });
    variant.images = parseImagesField(variant.images);
    res.json(variant);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    res.status(500).json({ message: "Server error" });
  }
};

// Remove variant (no Cloudinary, no VariantImage model)
exports.removeVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const idNum = Number(id);
    if (!id || Number.isNaN(idNum))
      return res.status(400).json({ message: "Invalid variant id" });

    const variant = await prisma.productVariant.findFirst({
      where: { id: idNum },
    });
    if (!variant) return res.status(404).json({ message: "Variant not found" });

    try {
      const [cartRes, reviewRes, deletedVariant] = await prisma.$transaction([
        prisma.productOnCart.deleteMany({ where: { variantId: idNum } }),
        prisma.review.deleteMany({ where: { variantId: idNum } }),
        prisma.productVariant.delete({ where: { id: idNum } }),
      ]);

      const cartDelCount = cartRes?.count || 0;
      const reviewDelCount = reviewRes?.count || 0;

      return res.json({
        message: "Variant deleted",
        counts: {
          cartDelCount,
          reviewDelCount,
          deletedVariantId: deletedVariant?.id || null,
        },
      });
    } catch (err) {
      console.error(
        "Error during transactional delete:",
        err && err.stack ? err.stack : err
      );
      return res
        .status(500)
        .json({
          message: "Error deleting variant (transaction failed)",
          error: err?.message || null,
        });
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    res.status(500).json({ message: "Server error" });
  }
};

// Upload image endpoint: no Cloudinary, echo back the provided data
exports.uploadImage = async (req, res) => {
  try {
    const imageBase64 = req.body.image || req.body;
    // Echo back and let client persist into variant.images
    res.json({ data: imageBase64 });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Check if SKU exists (optionally exclude a variant id)
exports.checkSku = async (req, res) => {
  try {
    const { sku, excludeId } = req.query;
    if (!sku) return res.json({ exists: false });
    const where = { sku: String(sku).trim() };
    if (excludeId) where.id = { not: Number(excludeId) };
    const found = await prisma.productVariant.findFirst({ where });
    return res.json({ exists: !!found, variant: found || null });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    res.status(500).json({ message: "Server error" });
  }
};
