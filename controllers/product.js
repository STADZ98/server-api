require("dotenv").config();
const prisma = require("../config/prisma");

// Helper to build absolute URL for images
const buildImageUrl = (img, req) => {
  if (!img) return null;
  const url =
    typeof img === "string"
      ? img
      : img.secure_url || img.url || img.src || null;
  if (!url) return null;
  if (/^(https?:)?\/\//i.test(url)) {
    return url.startsWith("http://") ? url.replace("http://", "https://") : url;
  }
  // If it's a data URL or blob URL (base64 embedded), return as-is — do not prepend server/API base
  if (/^data:/i.test(url) || /^blob:/i.test(url)) return url;
  const apiBase =
    process.env.VITE_API ||
    process.env.VITE_API_URL ||
    process.env.SERVER_URL ||
    "";
  const base = apiBase
    ? apiBase.replace(/\/api\/?$/i, "").replace(/\/$/, "")
    : "";
  if (base) return `${base}/${String(url).replace(/^\/+/, "")}`;
  if (req && req.protocol && req.get) {
    const origin = `${req.protocol}://${req.get("host")}`.replace(/\/$/, "");
    return `${origin}/${String(url).replace(/^\/+/, "")}`;
  }
  return url.startsWith("/") ? url : `/${String(url).replace(/^\/+/, "")}`;
};

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

// Create product (store images as JSON)
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
        price: price !== undefined && price !== null ? parseFloat(price) : null,
        quantity:
          quantity !== undefined && quantity !== null ? parseInt(quantity) : 0,
        categoryId: categoryId ? parseInt(categoryId) : null,
        brandId: brandId ? parseInt(brandId) : null,
        subcategoryId: subcategoryId ? parseInt(subcategoryId) : null,
        subSubcategoryId: subSubcategoryId ? parseInt(subSubcategoryId) : null,
        images: Array.isArray(images) ? JSON.stringify(images) : images || "",
      },
    });

    // create variants if provided
    if (Array.isArray(req.body.variants) && req.body.variants.length) {
      try {
        await Promise.all(
          req.body.variants.map(async (v) => {
            const imgs = Array.isArray(v.images) ? v.images : [];
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
                images: imgs.length ? JSON.stringify(imgs) : "",
              },
            });
          })
        );

        const productWithVariants = await prisma.product.findUnique({
          where: { id: product.id },
          include: {
            variants: true,
            category: true,
            subcategory: true,
            subSubcategory: true,
            brand: true,
          },
        });
        if (productWithVariants) {
          productWithVariants.images = parseImagesField(
            productWithVariants.images
          );
          if (Array.isArray(productWithVariants.variants))
            productWithVariants.variants.forEach(
              (v) => (v.images = parseImagesField(v.images))
            );
        }
        return res.status(201).json(productWithVariants);
      } catch (err) {
        console.error("Error creating variants:", err);
        return res.status(201).json(product);
      }
    }

    product.images = parseImagesField(product.images);
    res.status(201).json(product);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    if (err && err.code === "P2002") {
      const target = err.meta && err.meta.target ? err.meta.target : undefined;
      const msg = `Unique constraint failed${
        target ? ` on ${JSON.stringify(target)}` : ""
      }`;
      return res.status(400).json({ message: msg, code: err.code });
    }
    if (process.env.NODE_ENV !== "production")
      return res
        .status(500)
        .json({ message: "Server error", error: err.message || String(err) });
    res.status(500).json({ message: "Server error" });
  }
};

// List products (with pagination param)
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
        brand: true,
      },
    });
    products.forEach((p) => {
      p.images = parseImagesField(p.images);
      // normalize first image to absolute url for convenience
      p.image = buildImageUrl(
        p.images && p.images.length ? p.images[0] : p.image || null,
        req
      );
      if (Array.isArray(p.variants))
        p.variants = p.variants.map((v) => ({
          ...v,
          images: parseImagesField(v.images),
        }));
    });
    res.json(products);
  } catch (err) {
    console.error("list error:", err && err.stack ? err.stack : err);
    if (process.env.NODE_ENV !== "production")
      return res
        .status(500)
        .json({ message: "Server error", error: err.message || String(err) });
    res.status(500).json({ message: "Server error" });
  }
};

// Read product by ID
exports.read = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findFirst({
      where: { id: Number(id) },
      include: {
        category: true,
        subcategory: true,
        subSubcategory: true,
        brand: true,
        variants: true,
      },
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    product.images = parseImagesField(product.images);
    if (Array.isArray(product.variants))
      product.variants.forEach((v) => (v.images = parseImagesField(v.images)));
    // attach convenient absolute url for first image
    product.image = buildImageUrl(
      product.images && product.images.length
        ? product.images[0]
        : product.image || null,
      req
    );
    if (Array.isArray(product.variants))
      product.variants = product.variants.map((v) => ({
        ...v,
        image: buildImageUrl(
          v.images && v.images.length ? v.images[0] : v.image || null,
          req
        ),
      }));
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update product and sync variants
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

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        title,
        description,
        brandId: brandId ? parseInt(brandId) : null,
        price: price !== undefined && price !== null ? parseFloat(price) : null,
        quantity:
          quantity !== undefined && quantity !== null ? parseInt(quantity) : 0,
        categoryId: categoryId ? parseInt(categoryId) : null,
        subcategoryId: subcategoryId ? parseInt(subcategoryId) : null,
        subSubcategoryId: subSubcategoryId ? parseInt(subSubcategoryId) : null,
        images: Array.isArray(images) ? JSON.stringify(images) : images || "",
      },
    });

    if (Array.isArray(req.body.variants)) {
      const incoming = req.body.variants;
      const existingVariants = await prisma.productVariant.findMany({
        where: { productId },
      });
      const existingIds = existingVariants.map((v) => v.id).filter(Boolean);
      const incomingIds = incoming
        .map((v) => (v.id ? Number(v.id) : null))
        .filter(Boolean);

      const incomingSkuList = incoming
        .map((v) => (v.sku ? String(v.sku).trim() : null))
        .filter((s) => s && s.length);
      if (incomingSkuList.length) {
        const seen = new Set();
        for (const sku of incomingSkuList) {
          if (seen.has(sku))
            return res
              .status(400)
              .json({ message: `Duplicate SKU in payload: ${sku}` });
          seen.add(sku);
        }
        const conflict = await prisma.productVariant.findFirst({
          where: {
            sku: { in: incomingSkuList },
            id: { notIn: incomingIds.length ? incomingIds : [0] },
          },
        });
        if (conflict)
          return res.status(400).json({
            message: `SKU conflict with existing variant id=${conflict.id}`,
            sku: conflict.sku,
          });
      }

      const toDelete = existingIds.filter((id) => !incomingIds.includes(id));
      if (toDelete.length)
        await prisma.productVariant.deleteMany({
          where: { id: { in: toDelete } },
        });

      for (const v of incoming) {
        let vId = v.id ? Number(v.id) : null;
        if (!vId && v.sku) {
          const found = await prisma.productVariant
            .findFirst({ where: { sku: String(v.sku).trim() } })
            .catch((e) => {
              console.error("SKU lookup error", e);
              return null;
            });
          if (found) {
            if (found.productId === productId) vId = found.id;
            else
              return res.status(400).json({
                message: `SKU conflict with existing variant id=${found.id}`,
                sku: found.sku,
              });
          }
        }

        const imagesArr = Array.isArray(v.images) ? v.images : [];
        const imgsJson = imagesArr.filter(Boolean).length
          ? JSON.stringify(imagesArr.filter(Boolean))
          : "";

        if (vId) {
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
              images: imgsJson,
            },
          });
        } else {
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
              images: imgsJson,
            },
          });
        }
      }

      const productWithVariants = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: true,
          category: true,
          subcategory: true,
          subSubcategory: true,
          brand: true,
        },
      });
      if (productWithVariants) {
        productWithVariants.images = parseImagesField(
          productWithVariants.images
        );
        if (Array.isArray(productWithVariants.variants))
          productWithVariants.variants.forEach(
            (v) => (v.images = parseImagesField(v.images))
          );
      }
      return res.json(productWithVariants);
    }

    product.images = parseImagesField(product.images);
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete product and its variants
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const productId = Number(id);
    const existing = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!existing)
      return res.status(404).json({ message: "Product not found" });

    await prisma.productVariant.deleteMany({ where: { productId } });
    await prisma.returnProduct
      .deleteMany({ where: { productId } })
      .catch((e) => console.error("returnProduct delete error", e));
    await prisma.review
      .deleteMany({ where: { productId } })
      .catch((e) => console.error("review delete error", e));
    await prisma.product.delete({ where: { id: productId } });
    res.json({ message: "Delete Success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// List by subcategory
exports.listBySubcategory = async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const products = await prisma.product.findMany({
      where: { subcategoryId: Number(subcategoryId) },
      include: { category: true, subcategory: true, subSubcategory: true },
    });
    products.forEach((p) => (p.images = parseImagesField(p.images)));
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Flexible list
exports.listby = async (req, res) => {
  try {
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
    let findManyArgs = {
      orderBy: { [sort]: order },
      include: {
        category: true,
        subcategory: true,
        subSubcategory: true,
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
    )
      findManyArgs.take = parseInt(limit);
    const products = await prisma.product.findMany(findManyArgs);
    products.forEach((p) => (p.images = parseImagesField(p.images)));
    res.json(products);
  } catch (err) {
    console.error("product.listby error:", err && err.stack ? err.stack : err);
    res.status(500).json({ message: "Server error" });
  }
};

// Search and filters
exports.searchfilters = async (req, res) => {
  try {
    const { query, category, price } = req.body;
    let where = {};
    if (query)
      where.OR = [
        { title: { contains: query } },
        { description: { contains: query } },
      ];
    if (price) where.price = { gte: price[0], lte: price[1] };
    if (category && category.length > 0)
      where.categoryId = { in: category.map((id) => Number(id)) };
    const products = await prisma.product.findMany({
      where,
      include: { category: true, brand: true },
    });
    products.forEach((p) => (p.images = parseImagesField(p.images)));
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Image upload endpoint: now a no-op that echoes data back; client saves into product.images or variant.images
exports.createImages = async (req, res) => {
  try {
    const imageData = req.body.image || req.body;
    res.json({ data: imageData });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Remove image endpoint: no-op in DB-stored image flow
exports.removeImage = async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

// List products by brand via query param ?brand= (brand id or slug/name)
exports.listByBrand = async (req, res) => {
  try {
    const { brand } = req.query;
    const where = {};
    if (brand !== undefined && brand !== null && String(brand).trim() !== "") {
      const b = String(brand).trim();
      const asNum = Number(b);
      if (!Number.isNaN(asNum) && String(asNum) === b) {
        where.brandId = asNum;
      } else {
        // Match by brand slug or name if provided
        where.OR = [{ brand: { slug: b } }, { brand: { name: b } }];
      }
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        subcategory: true,
        subSubcategory: true,
        brand: true,
      },
      orderBy: { createdAt: "desc" },
    });
    products.forEach((p) => (p.images = parseImagesField(p.images)));
    res.json(products);
  } catch (err) {
    console.error("listByBrand error:", err && err.stack ? err.stack : err);
    res.status(500).json({ message: "Server error" });
  }
};
