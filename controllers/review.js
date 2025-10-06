const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { authCheck } = require("../middlewares/authCheck");

//
// POST https://server-api-newgen.vercel.app/api/review - สร้างรีวิวสินค้า
//
router.post("/", authCheck, async (req, res) => {
  try {
    const { productId, variantId, rating, comment, orderId } = req.body;
    const userId = req.user.id;

    if (!productId || !rating || !comment) {
      return res
        .status(400)
        .json({ error: "ข้อมูลไม่ครบถ้วน: productId, rating, comment" });
    }

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

    if (isNaN(productIdInt) || isNaN(userIdInt) || isNaN(ratingInt)) {
      return res.status(400).json({ error: "Invalid data type" });
    }

    // ป้องกัน user รีวิวซ้ำใน order เดียวกัน
    const existing = await prisma.review.findFirst({
      where: {
        productId: productIdInt,
        userId: userIdInt,
        ...(variantIdInt ? { variantId: variantIdInt } : {}),
        ...(orderIdInt ? { orderId: orderIdInt } : {}),
      },
    });

    if (existing) {
      return res.status(400).json({
        error: "คุณได้รีวิวสินค้านี้สำหรับคำสั่งซื้อนี้แล้ว",
      });
    }

    const data = {
      productId: productIdInt,
      userId: userIdInt,
      rating: ratingInt,
      comment,
    };
    if (variantIdInt) data.variantId = variantIdInt;
    if (orderIdInt) data.orderId = orderIdInt;

    const review = await prisma.review.create({ data });
    res.json({ success: true, review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
});

//
// GET https://server-api-newgen.vercel.app/api/review/:productId - ดึงรีวิวสินค้า
//
router.get("/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const { variantId, orderId } = req.query;

    const where = {
      productId: Number(productId),
    };
    if (variantId) where.variantId = Number(variantId);
    if (orderId) where.orderId = Number(orderId); // ✅ กรองตาม orderId

    const reviews = await prisma.review.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        variant: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
});

//
// PATCH https://server-api-newgen.vercel.app/api/review/:id - แก้ไขรีวิว
//
router.patch("/:id", authCheck, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    const review = await prisma.review.findUnique({
      where: { id: Number(id) },
    });

    if (!review) {
      return res.status(404).json({ error: "ไม่พบรีวิว" });
    }
    if (review.userId !== userId) {
      return res.status(403).json({ error: "คุณไม่มีสิทธิแก้ไขรีวิวนี้" });
    }

    const updated = await prisma.review.update({
      where: { id: Number(id) },
      data: { rating, comment, updatedAt: new Date() },
    });

    res.json({ success: true, review: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
});

//
// DELETE https://server-api-newgen.vercel.app/api/review/:id - ลบรีวิว
//
router.delete("/:id", authCheck, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const review = await prisma.review.findUnique({
      where: { id: Number(id) },
    });

    if (!review) {
      return res.status(404).json({ error: "ไม่พบรีวิว" });
    }
    if (review.userId !== userId) {
      return res.status(403).json({ error: "คุณไม่มีสิทธิลบรีวิวนี้" });
    }

    await prisma.review.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
});

module.exports = router;
