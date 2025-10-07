require("dotenv").config();
const prisma = require("../config/prisma");
const cloudinary = require("cloudinary").v2;

exports.listByBrand = async (req, res) => {
  try {
    const { brand } = req.query;
    if (!brand) return res.json([]);
    const products = await prisma.product.findMany({
      where: {
        brand: {
          name: {
            equals: brand,
            mode: "insensitive",
          },
        },
      },
      include: {
        category: true,
        subcategory: true,
        subSubcategory: true,
        brand: true,
        images: true,
      },
    });
    res.json(products);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    if (process.env.NODE_ENV !== "production") {
      return res
        .status(500)
        .json({ message: "Server error", error: err.message || String(err) });
    }
    res.status(500).json({ message: "Server error" });
  }
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// สร้างสินค้าใหม่ พร้อมอัปโหลดรูปภาพ
exports.create = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      quantity,
      categoryId,
      brandId,
      images,
      subcategoryId,
      subSubcategoryId,
    } = req.body;

    const product = await prisma.product.create({
      data: {
        title,
        description,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        categoryId: parseInt(categoryId),
        brandId: brandId ? parseInt(brandId) : null,
        subcategoryId: subcategoryId ? parseInt(subcategoryId) : null,
        subSubcategoryId: subSubcategoryId ? parseInt(subSubcategoryId) : null,
        images: {
          create: images
            .filter((item) => item && item.url)
            .map((item) => ({
              asset_id: item.asset_id || "",
              public_id: item.public_id || "",
              url: item.url || "",
              secure_url: item.secure_url || item.url || "",
            })),
        },
      },
    });

    // If variants provided in request body, persist them and their images
    if (Array.isArray(req.body.variants) && req.body.variants.length) {
      try {
        const variants = req.body.variants;
        await Promise.all(
          variants.map(async (v) => {
            // Normalize images array: may contain strings or objects
            const imgs = Array.isArray(v.images) ? v.images : [];
            const createImages = imgs.filter(Boolean).map((img) => {
              if (typeof img === "string") {
                return {
                  asset_id: "",
                  public_id: "",
                  url: img || "",
                  secure_url: img || "",
                };
              }
              return {
                asset_id: img.asset_id || "",
                public_id: img.public_id || "",
                url: img.url || "",
                secure_url: img.secure_url || img.url || "",
              };
            });

            await prisma.productVariant.create({
              data: {
                productId: product.id,
                title: v.title || null,
                sku:
                  v.sku && String(v.sku).trim() !== ""
                    ? String(v.sku).trim()
                    : null,
                price:
                  v.price !== undefined && v.price !== null
                    ? parseFloat(v.price)
                    : null,
                quantity:
                  v.quantity !== undefined && v.quantity !== null
                    ? parseInt(v.quantity)
                    : 0,
                attributes:
                  v.attributes && Object.keys(v.attributes).length
                    ? v.attributes
                    : null,
                images: createImages.length
                  ? { create: createImages }
                  : undefined,
              },
            });
          })
        );

        // Reload product including variants and images to return complete data
        const productWithVariants = await prisma.product.findUnique({
          where: { id: product.id },
          include: {
            images: true,
            variants: { include: { images: true } },
            category: true,
            subcategory: true,
            subSubcategory: true,
            brand: true,
          },
        });

        return res.status(201).json(productWithVariants);
      } catch (err) {
        console.error("Error creating variants:", err);
        // If variant creation fails, still respond with created product (without variants)
        // but log error and return 201 with the base product to avoid losing the created product.
        return res.status(201).json(product);
      }
    }

    res.status(201).json(product);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    // Prisma unique constraint error (e.g., duplicate sku) -> surface as 400
    if (err && err.code === "P2002") {
      const target = err.meta && err.meta.target ? err.meta.target : undefined;
      const msg = `Unique constraint failed${
        target ? ` on ${JSON.stringify(target)}` : ""
      }`;
      return res.status(400).json({ message: msg, code: err.code });
    }
    if (process.env.NODE_ENV !== "production") {
      return res.status(500).json({
        message: "Server error",
        error: err.message || String(err),
        code: err.code,
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// ดึงสินค้า (limit ตาม count ที่ส่งมา)
exports.list = async (req, res) => {
  try {
    let { count } = req.params;
    let take = parseInt(count);
    if (isNaN(take) || take <= 0) take = 10;

    const products = await prisma.product.findMany({
      take,
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        subcategory: true,
        subSubcategory: true,
        images: true,
        brand: true,
      },
    });
    res.json(products);
  } catch (err) {
    console.error("listby error:", err && err.stack ? err.stack : err);
    if (process.env.NODE_ENV !== "production") {
      return res
        .status(500)
        .json({ message: "Server error", error: err.message || String(err) });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// ดึงสินค้าโดย id
exports.read = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findFirst({
      where: { id: Number(id) },
      include: {
        category: true,
        subcategory: true,
        subSubcategory: true,
        images: true,
        brand: true,
        // include variants and their images so frontend can display sub-products
        variants: { include: { images: true } },
      },
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// อัปเดตสินค้า
exports.update = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      quantity,
      categoryId,
      brandId,
      images,
      subcategoryId,
      subSubcategoryId,
    } = req.body;

    const productId = Number(req.params.id);
    // Debug: log incoming payload to help diagnose 500 errors during update
    if (process.env.NODE_ENV !== "production") {
      try {
        // console.log(
        //   "DEBUG product.update payload:",
        //   JSON.stringify(req.body, null, 2)
        // );
      } catch (e) {
        // console.log("DEBUG product.update payload: [unserializable payload]");
      }
    }

    // ลบรูปภาพเก่า
    await prisma.image.deleteMany({ where: { productId } });

    // อัปเดตสินค้าและสร้างรูปภาพใหม่ (filter เฉพาะรูปที่ข้อมูลครบ)
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        title,
        description,
        brandId: brandId ? parseInt(brandId) : null,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        categoryId: parseInt(categoryId),
        subcategoryId: subcategoryId ? parseInt(subcategoryId) : null,
        subSubcategoryId: subSubcategoryId ? parseInt(subSubcategoryId) : null,
        images: {
          create: images
            .filter((item) => item && item.url)
            .map((item) => ({
              asset_id: item.asset_id || null,
              public_id: item.public_id || null,
              url: item.url,
              secure_url: item.secure_url || item.url || null,
            })),
        },
      },
    });
    // If variants were provided in the request body, sync them: create, update or delete as needed
    if (Array.isArray(req.body.variants)) {
      const incoming = req.body.variants;

      // Fetch existing variants for this product (and their images)
      const existingVariants = await prisma.productVariant.findMany({
        where: { productId },
        include: { images: true },
      });

      const existingIds = existingVariants.map((v) => v.id).filter(Boolean);
      const incomingIds = incoming
        .map((v) => (v.id ? Number(v.id) : null))
        .filter(Boolean);

      // Preflight: check duplicate SKUs in payload
      const incomingSkuList = incoming
        .map((v) => (v.sku ? String(v.sku).trim() : null))
        .filter((s) => s && s.length);
      if (incomingSkuList.length) {
        const seen = new Set();
        for (const sku of incomingSkuList) {
          if (seen.has(sku)) {
            return res
              .status(400)
              .json({ message: `Duplicate SKU in payload: ${sku}` });
          }
          seen.add(sku);
        }

        // Check conflict with other existing variants (exclude incomingIds)
        const conflict = await prisma.productVariant.findFirst({
          where: {
            sku: { in: incomingSkuList },
            id: { notIn: incomingIds.length ? incomingIds : [0] },
          },
        });
        if (conflict) {
          return res.status(400).json({
            message: `SKU conflict with existing variant id=${conflict.id}`,
            sku: conflict.sku,
          });
        }
      }

      // Delete variants that are not present in incoming list
      const toDelete = existingIds.filter((id) => !incomingIds.includes(id));
      if (toDelete.length) {
        // Delete variant images from Cloudinary (best-effort)
        const imgsToDelete = await prisma.variantImage.findMany({
          where: { productVariantId: { in: toDelete } },
        });
        await Promise.all(
          imgsToDelete.map(async (img) => {
            if (!img || !img.public_id) return null;
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

        // Remove variant image records and the variants themselves
        await prisma.variantImage.deleteMany({
          where: { productVariantId: { in: toDelete } },
        });
        await prisma.productVariant.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      // Upsert incoming variants
      for (const v of incoming) {
        let vId = v.id ? Number(v.id) : null;
        // If no id provided but SKU present, try to resolve to an existing variant by SKU.
        if (!vId && v.sku) {
          try {
            const found = await prisma.productVariant.findFirst({
              where: { sku: String(v.sku).trim() },
            });
            if (found) {
              if (found.productId === productId) {
                // treat as update to existing variant of this product
                vId = found.id;
              } else {
                // SKU exists on a different product -> conflict
                return res.status(400).json({
                  message: `SKU conflict with existing variant id=${found.id}`,
                  sku: found.sku,
                });
              }
            }
          } catch (err) {
            console.error(
              "Error resolving variant by SKU:",
              err && err.message ? err.message : err
            );
          }
        }
        const imagesArr = Array.isArray(v.images) ? v.images : [];

        const createImages = imagesArr
          .filter((i) => i)
          .map((i) => {
            if (typeof i === "string") {
              return {
                asset_id: "",
                public_id: "",
                url: i || "",
                secure_url: i || "",
              };
            }
            return {
              asset_id: i.asset_id || "",
              public_id: i.public_id || "",
              url: i.url || "",
              secure_url: i.secure_url || i.url || "",
            };
          });

        if (vId) {
          // remove old variant images (and Cloudinary objects) then add new images
          const existingImgs = await prisma.variantImage.findMany({
            where: { productVariantId: vId },
          });
          await Promise.all(
            existingImgs.map(async (img) => {
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
            where: { productVariantId: vId },
          });

          await prisma.productVariant.update({
            where: { id: vId },
            data: {
              title: v.title || null,
              sku:
                v.sku && String(v.sku).trim() !== ""
                  ? String(v.sku).trim()
                  : null,
              price:
                v.price !== undefined && v.price !== null
                  ? parseFloat(v.price)
                  : null,
              quantity:
                v.quantity !== undefined && v.quantity !== null
                  ? parseInt(v.quantity)
                  : 0,
              attributes:
                v.attributes && Object.keys(v.attributes || {}).length
                  ? v.attributes
                  : null,
              images: createImages.length
                ? { create: createImages }
                : undefined,
            },
          });
        } else {
          // create new variant
          await prisma.productVariant.create({
            data: {
              productId: product.id,
              title: v.title || null,
              sku:
                v.sku && String(v.sku).trim() !== ""
                  ? String(v.sku).trim()
                  : null,
              price:
                v.price !== undefined && v.price !== null
                  ? parseFloat(v.price)
                  : null,
              quantity:
                v.quantity !== undefined && v.quantity !== null
                  ? parseInt(v.quantity)
                  : 0,
              attributes:
                v.attributes && Object.keys(v.attributes || {}).length
                  ? v.attributes
                  : null,
              images: createImages.length
                ? { create: createImages }
                : undefined,
            },
          });
        }
      }

      // Return product with variants included
      const productWithVariants = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          images: true,
          variants: { include: { images: true } },
          category: true,
          subcategory: true,
          subSubcategory: true,
          brand: true,
        },
      });
      return res.json(productWithVariants);
    }

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ลบสินค้าและลบรูปภาพใน Cloudinary ด้วย
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findFirst({
      where: { id: Number(id) },
      include: { images: true },
    });

    if (!product) return res.status(404).json({ message: "Product not found" });

    // --- First, remove any variants (and their images) to avoid FK / constraint errors ---
    const variants = await prisma.productVariant.findMany({
      where: { productId: Number(id) },
      include: { images: true },
    });

    if (variants && variants.length) {
      // delete variant images on Cloudinary (best-effort)
      await Promise.all(
        variants
          .flatMap((v) => v.images || [])
          .map(async (image) => {
            if (!image || !image.public_id) return null;
            try {
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

      // remove variant image records from DB
      try {
        const variantIds = variants.map((v) => v.id).filter(Boolean);
        if (variantIds.length) {
          await prisma.variantImage.deleteMany({
            where: { productVariantId: { in: variantIds } },
          });
        }
      } catch (err) {
        console.error(
          "Error deleting variant image records:",
          err && err.message ? err.message : err
        );
      }

      // remove variants themselves
      try {
        await prisma.productVariant.deleteMany({
          where: { productId: Number(id) },
        });
      } catch (err) {
        console.error(
          "Error deleting product variants:",
          err && err.message ? err.message : err
        );
        // continue - we'll attempt to delete product below which may still fail if FK exists
      }
    }

    // Then, delete product images on Cloudinary (best-effort)
    await Promise.all(
      (product.images || []).map(async (image) => {
        if (!image || !image.public_id) return null;
        try {
          return await cloudinary.uploader.destroy(image.public_id);
        } catch (err) {
          console.error(
            `Cloudinary destroy failed for public_id=${image.public_id}:`,
            err && err.message ? err.message : err
          );
          return null;
        }
      })
    );

    // remove product image records from DB (best-effort)
    try {
      await prisma.image.deleteMany({ where: { productId: Number(id) } });
    } catch (err) {
      console.error(
        "Error deleting product image records:",
        err && err.message ? err.message : err
      );
    }

    // remove reviews and return-product records referencing this product (no ON DELETE CASCADE in schema)
    try {
      await prisma.returnProduct.deleteMany({
        where: { productId: Number(id) },
      });
    } catch (err) {
      console.error(
        "Error deleting return-product records:",
        err && err.message ? err.message : err
      );
    }
    try {
      await prisma.review.deleteMany({ where: { productId: Number(id) } });
    } catch (err) {
      console.error(
        "Error deleting review records:",
        err && err.message ? err.message : err
      );
    }

    // Finally, remove the product record
    try {
      await prisma.product.delete({ where: { id: Number(id) } });
      res.json({ message: "Delete Success" });
    } catch (err) {
      // log full stack and return helpful message in non-production for debugging
      console.error(
        "Error deleting product record:",
        err && err.stack ? err.stack : err
      );
      if (process.env.NODE_ENV !== "production") {
        return res.status(500).json({
          message: "Error deleting product",
          error: err.message || String(err),
        });
      }
      return res.status(500).json({ message: "Server error" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ดึงสินค้าตาม subcategoryId
exports.listBySubcategory = async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const products = await prisma.product.findMany({
      where: { subcategoryId: Number(subcategoryId) },
      include: {
        category: true,
        subcategory: true,
        subSubcategory: true,
        images: true,
      },
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.listby = async (req, res) => {
  try {
    // Log incoming request context to help debug unexpected GETs/500s
    try {
      const info = {
        ip: req.ip || req.connection?.remoteAddress || null,
        method: req.method,
        path: req.originalUrl || req.url,
        headers: {
          host: req.get("host"),
          referer: req.get("referer") || req.get("referrer"),
          "user-agent": req.get("user-agent"),
          authorization: req.get("authorization") ? "<present>" : "<missing>",
        },
        body: req.body,
      };
      console.info("product.listby request:", info);
    } catch (e) {
      console.error(
        "Failed to log request info in product.listby:",
        e && e.stack ? e.stack : e
      );
    }
    // ตัวอย่างโค้ด สำหรับดึงสินค้าตามเงื่อนไขง่ายๆ
    const allowedSortFields = [
      "id",
      "title",
      "description",
      "price",
      "sold",
      "quantity",
      "categoryId",
      "subcategoryId",
      "subSubcategoryId",
      "brandId",
      "createdAt",
      "updatedAt",
    ];
    const allowedOrder = ["asc", "desc"];

    let { sort = "createdAt", order = "desc", limit } = req.body;
    sort = allowedSortFields.includes(sort) ? sort : "createdAt";
    order = allowedOrder.includes(String(order).toLowerCase())
      ? String(order).toLowerCase()
      : "desc";

    // ถ้า limit ไม่ถูกส่งมา หรือเป็น 'all' หรือ <= 0 ให้แสดงสินค้าทั้งหมด
    let findManyArgs = {
      orderBy: { [sort]: order },
      include: {
        category: true,
        subcategory: true,
        subSubcategory: true,
        images: true,
        brand: true,
      },
    };
    if (
      limit !== undefined &&
      limit !== null &&
      limit !== "" &&
      limit !== "all" &&
      !isNaN(parseInt(limit)) &&
      parseInt(limit) > 0
    ) {
      findManyArgs.take = parseInt(limit);
    }

    const products = await prisma.product.findMany(findManyArgs);
    res.json(products);
  } catch (err) {
    console.error("product.listby error:", err && err.stack ? err.stack : err);
    if (process.env.NODE_ENV !== "production") {
      return res
        .status(500)
        .json({ message: "Server error", error: err.message || String(err) });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// ฟังก์ชันค้นหาและกรองสินค้าแบบรวม (searchfilters)
exports.searchfilters = async (req, res) => {
  try {
    const { query, category, price } = req.body;
    let where = {};

    if (query) {
      where.OR = [
        { title: { contains: query } },
        { description: { contains: query } },
      ];
    }
    if (price) {
      where.price = {
        gte: price[0],
        lte: price[1],
      };
    }
    if (category && category.length > 0) {
      where.categoryId = {
        in: category.map((id) => Number(id)),
      };
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true, images: true, brand: true },
    });

    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// อัปโหลดรูปภาพขึ้น Cloudinary
exports.createImages = async (req, res) => {
  try {
    const imageBase64 = req.body.image || req.body;
    const result = await cloudinary.uploader.upload(imageBase64, {
      folder: "PetShopOnline",
      public_id: `PetS${Date.now()}`,
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

// ลบรูปภาพจาก Cloudinary
exports.removeImage = async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id)
      return res.status(400).json({ message: "public_id required" });
    try {
      await cloudinary.uploader.destroy(public_id);
      res.json({ message: "Remove Image Success" });
    } catch (err) {
      console.error(
        "Cloudinary destroy error:",
        err && err.message ? err.message : err
      );
      res.status(500).json({ message: "Error removing image" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};
