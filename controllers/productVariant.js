require("dotenv").config();
const prisma = require("../config/prisma");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// สร้าง variant ให้กับ product
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
    };

    if (images && Array.isArray(images) && images.length > 0) {
      data.images = {
        create: images
          .filter((i) => i && i.url)
          .map((i) => ({
            asset_id: i.asset_id || "",
            public_id: i.public_id || "",
            url: i.url || "",
            secure_url: i.secure_url || i.url || "",
          })),
      };
    }

    const variant = await prisma.productVariant.create({
      data,
      include: { images: true },
    });
    res.status(201).json(variant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ดึง variants ของ product
exports.listByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const variants = await prisma.productVariant.findMany({
      where: { productId: Number(productId) },
      include: { images: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(variants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// อ่าน variant เดียว
exports.readVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const variant = await prisma.productVariant.findFirst({
      where: { id: Number(id) },
      include: { images: true, product: true },
    });
    if (!variant) return res.status(404).json({ message: "Variant not found" });
    res.json(variant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// อัปเดต variant
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

    // ถ้ามี images ส่งมา ให้ลบภาพเก่าจาก Cloudinary แล้วสร้าง images ใหม่
    if (images && Array.isArray(images)) {
      const existingImages = await prisma.variantImage.findMany({
        where: { productVariantId: Number(id) },
      });
      await Promise.all(
        existingImages.map(async (img) => {
          if (!img.public_id) return null;
          try {
            return await cloudinary.uploader.destroy(img.public_id);
          } catch (err) {
            console.error(
              `Cloudinary destroy failed for variant image public_id=${img.public_id}:`,
              err && err.message ? err.message : err
            );
            return null;
          }
        })
      );

      await prisma.variantImage.deleteMany({
        where: { productVariantId: Number(id) },
      });

      updateData.images = {
        create: images
          .filter((i) => i && i.url)
          .map((i) => ({
            asset_id: i.asset_id || "",
            public_id: i.public_id || "",
            url: i.url || "",
            secure_url: i.secure_url || i.url || "",
          })),
      };
    }

    const variant = await prisma.productVariant.update({
      where: { id: Number(id) },
      data: updateData,
      include: { images: true },
    });

    res.json(variant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ลบ variant พร้อมรูปภาพบน Cloudinary
exports.removeVariant = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("removeVariant called for id=", id);
    const idNum = Number(id);
    if (!id || Number.isNaN(idNum)) {
      return res.status(400).json({ message: "Invalid variant id" });
    }

    // Load variant with images for cloud deletes
    const variant = await prisma.productVariant.findFirst({
      where: { id: idNum },
      include: { images: true },
    });
    if (!variant) return res.status(404).json({ message: "Variant not found" });
    console.log("Found variant:", {
      id: variant.id,
      productId: variant.productId,
      imagesCount: (variant.images || []).length,
    });

    // Delete images on Cloudinary (best-effort)
    let cloudDeletes = 0;
    await Promise.all(
      (variant.images || []).map(async (image) => {
        if (!image.public_id) return null;
        try {
          cloudDeletes++;
          return await cloudinary.uploader.destroy(image.public_id);
        } catch (err) {
          console.error(
            `Cloudinary destroy failed for variant image public_id=${image.public_id}:`,
            err && err.message ? err.message : err
          );
          return null;
        }
      })
    );
    console.log(`Attempted Cloudinary deletes: ${cloudDeletes}`);

    // Use a transaction so deletions happen together and counts are returned
    try {
      const [cartRes, reviewRes, variantImageRes, deletedVariant] =
        await prisma.$transaction([
          prisma.productOnCart.deleteMany({ where: { variantId: idNum } }),
          prisma.review.deleteMany({ where: { variantId: idNum } }),
          prisma.variantImage.deleteMany({
            where: { productVariantId: idNum },
          }),
          prisma.productVariant.delete({ where: { id: idNum } }),
        ]);

      const cartDelCount = cartRes?.count || 0;
      const reviewDelCount = reviewRes?.count || 0;
      const variantImageDelCount = variantImageRes?.count || 0;

      console.log(
        `Transaction results for variant ${idNum}: cart=${cartDelCount}, reviews=${reviewDelCount}, variantImages=${variantImageDelCount}`
      );

      return res.json({
        message: "Variant deleted",
        counts: {
          cloudDeletes,
          cartDelCount,
          reviewDelCount,
          variantImageDelCount,
          deletedVariantId: deletedVariant?.id || null,
        },
      });
    } catch (err) {
      console.error(
        "Error during transactional delete:",
        err && err.message ? err.message : err
      );
      return res
        .status(500)
        .json({
          message: "Error deleting variant (transaction failed)",
          error: err?.message || null,
        });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// อัปโหลดรูปภาพขึ้น Cloudinary สำหรับ variant (ใช้แยกเมื่อจำเป็น)
exports.uploadImage = async (req, res) => {
  try {
    const imageBase64 = req.body.image || req.body;
    const result = await cloudinary.uploader.upload(imageBase64, {
      folder: "PetShopOnline/variants",
      public_id: `Var${Date.now()}`,
      resource_type: "auto",
    });

    res.json({
      asset_id: result.asset_id,
      public_id: result.public_id,
      url: result.url,
      secure_url: result.secure_url,
    });
  } catch (err) {
    console.error("Cloudinary upload error:", err.message, err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Check if SKU exists (optionally exclude a variant id)
exports.checkSku = async (req, res) => {
  try {
    const { sku, excludeId } = req.query;
    if (process.env.NODE_ENV !== "production") {
      console.log("checkSku called with:", { sku, excludeId });
    }
    if (!sku) return res.json({ exists: false });
    const where = { sku: String(sku).trim() };
    if (excludeId) where.id = { not: Number(excludeId) };
    try {
      const found = await prisma.productVariant.findFirst({ where });
      return res.json({ exists: !!found, variant: found || null });
    } catch (err) {
      console.error(
        "Prisma error in checkSku:",
        err && err.stack ? err.stack : err
      );
      if (process.env.NODE_ENV !== "production") {
        return res
          .status(500)
          .json({ message: "Server error", error: err.message || String(err) });
      }
      return res.status(500).json({ message: "Server error" });
    }
  } catch (err) {
    console.error("checkSku outer error:", err && err.stack ? err.stack : err);
    if (process.env.NODE_ENV !== "production") {
      return res
        .status(500)
        .json({ message: "Server error", error: err.message || String(err) });
    }
    res.status(500).json({ message: "Server error" });
  }
};
