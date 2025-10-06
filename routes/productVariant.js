const express = require("express");
const router = express.Router();
const {
  createVariant,
  listByProduct,
  readVariant,
  updateVariant,
  removeVariant,
  uploadImage,
  checkSku,
} = require("../controllers/productVariant");

const { authCheck, adminCheck } = require("../middlewares/authCheck");

// สร้าง variant ให้ product
router.post("/variant", authCheck, adminCheck, createVariant);

// ดึง variants ของ product
router.get("/variants/:productId", listByProduct);

// SKU existence check (no auth required) - must be declared before the dynamic :id route
router.get("/variant/sku-exists", checkSku);

// อ่าน variant
router.get("/variant/:id", readVariant);

// อัปเดต variant
router.put("/variant/:id", authCheck, adminCheck, updateVariant);

// ลบ variant
router.delete("/variant/:id", authCheck, adminCheck, removeVariant);

// อัปโหลดรูปของ variant
router.post("/variant/images", authCheck, adminCheck, uploadImage);

module.exports = router;
