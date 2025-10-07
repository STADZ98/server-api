// routes/subcategory.js
const express = require("express");
const router = express.Router();
const { create, list, remove, update } = require("../controllers/subcategory");
const { authCheck, adminCheck } = require("../middlewares/authCheck");

// ✅ Create subcategory (admin only)
router.post("/subcategory", authCheck, adminCheck, async (req, res, next) => {
  try {
    await create(req, res);
  } catch (err) {
    console.error("subcategory POST /subcategory error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// ✅ Get all subcategories (public)
router.get("/subcategory", async (req, res, next) => {
  try {
    await list(req, res);
  } catch (err) {
    console.error("subcategory GET /subcategory error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// ✅ Update subcategory (admin only)
router.put(
  "/subcategory/:id",
  authCheck,
  adminCheck,
  async (req, res, next) => {
    try {
      await update(req, res);
    } catch (err) {
      console.error("subcategory PUT /subcategory/:id error:", err);
      res.status(500).json({ message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
    }
  }
);

// ✅ Delete subcategory (admin only)
router.delete(
  "/subcategory/:id",
  authCheck,
  adminCheck,
  async (req, res, next) => {
    try {
      await remove(req, res);
    } catch (err) {
      console.error("subcategory DELETE /subcategory/:id error:", err);
      res.status(500).json({ message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
    }
  }
);

module.exports = router;
