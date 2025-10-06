const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ✅ สร้างรีวิว
exports.createReview = async (req, res) => {
  try {
    const { productId, variantId, orderId, rating, comment } = req.body;
    const userId = req.user.id; // มาจาก authCheck middleware

    if (!productId || !rating || !comment) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // แปลงเป็น Int ตาม schema (variantId & orderId เป็น optional)
    const productIdInt = parseInt(productId, 10);
    const userIdInt = parseInt(userId, 10);
    const ratingInt = parseInt(rating, 10);
    const variantIdInt =
      variantId !== undefined && variantId !== null && variantId !== ""
        ? parseInt(variantId, 10)
        : null;
    const orderIdInt =
      orderId !== undefined && orderId !== null && orderId !== ""
        ? parseInt(orderId, 10)
        : null;

    if (
      isNaN(productIdInt) ||
      isNaN(userIdInt) ||
      isNaN(ratingInt) ||
      (variantIdInt === null ? false : isNaN(variantIdInt)) ||
      (orderIdInt === null ? false : isNaN(orderIdInt))
    ) {
      return res.status(400).json({ error: "Invalid data type" });
    }

    if (ratingInt < 1 || ratingInt > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // If orderId provided, verify the order exists and belongs to the user.
    if (orderIdInt) {
      const order = await prisma.order.findUnique({
        where: { id: orderIdInt },
      });
      if (!order) return res.status(400).json({ error: "Order not found" });
      // try common user field names on order (userId, orderedById)
      const orderUserId =
        order.userId ?? order.orderedById ?? order.user?.id ?? null;
      if (!orderUserId || Number(orderUserId) !== userIdInt) {
        return res.status(403).json({ error: "Order does not belong to user" });
      }
    }

    // Prevent duplicate reviews for same user/product/variant/order combination
    const duplicateWhere = {
      productId: productIdInt,
      userId: userIdInt,
      ...(variantIdInt ? { variantId: variantIdInt } : { variantId: null }),
      ...(orderIdInt ? { orderId: orderIdInt } : { orderId: null }),
    };

    const existing = await prisma.review.findFirst({ where: duplicateWhere });
    if (existing) {
      return res
        .status(409)
        .json({ error: "You have already submitted a review for this item" });
    }

    const review = await prisma.review.create({
      data: {
        productId: productIdInt,
        userId: userIdInt,
        rating: ratingInt,
        comment,
        ...(variantIdInt ? { variantId: variantIdInt } : {}),
        ...(orderIdInt ? { orderId: orderIdInt } : {}),
      },
    });

    res.status(201).json({ review });
  } catch (err) {
    console.error("Create review error:", err);
    res.status(400).json({ error: err.message });
  }
};

// ✅ ลบรีวิว
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    console.log("reviewId for delete:", reviewId);

    const id = Number(reviewId);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid reviewId" });
    }

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Optional: ตรวจสอบว่าเป็นเจ้าของหรือ admin
    if (req.user.role !== "admin" && review.userId !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this review" });
    }

    const deleted = await prisma.review.delete({ where: { id } });
    res.json({ success: true, deleted });
  } catch (err) {
    console.error("Delete review error:", err);
    res.status(400).json({ error: err.message });
  }
};

// ✅ ดึงรีวิวตาม product
exports.getReviewsByProduct = async (req, res) => {
  try {
    let { productId } = req.params;
    const { variantId, orderId } = req.query;
    const productIdInt = parseInt(productId, 10);
    if (isNaN(productIdInt)) {
      return res.status(400).json({ error: "Invalid productId" });
    }

    const where = { productId: productIdInt };
    if (variantId !== undefined && variantId !== null && variantId !== "") {
      const vid = parseInt(variantId, 10);
      if (isNaN(vid))
        return res.status(400).json({ error: "Invalid variantId" });
      where.variantId = vid;
    }
    if (orderId !== undefined && orderId !== null && orderId !== "") {
      const oid = parseInt(orderId, 10);
      if (isNaN(oid)) return res.status(400).json({ error: "Invalid orderId" });
      where.orderId = oid;
    }

    const reviews = await prisma.review.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        variant: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ reviews });
  } catch (err) {
    console.error("Get reviews error:", err);
    res.status(400).json({ error: err.message });
  }
};

// ✅ อัปเดตรีวิว
exports.updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const id = Number(reviewId);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid reviewId" });

    const { rating, comment } = req.body;
    if (!rating || !comment)
      return res.status(400).json({ error: "All fields are required" });

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) return res.status(404).json({ error: "Review not found" });

    if (req.user.role !== "admin" && review.userId !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Not authorized to edit this review" });
    }

    const ratingInt = parseInt(rating, 10);
    const updated = await prisma.review.update({
      where: { id },
      data: { rating: ratingInt, comment },
    });

    res.json({ success: true, updated });
  } catch (err) {
    console.error("Update review error:", err);
    res.status(400).json({ error: err.message });
  }
};
