const express = require("express");
const router = express.Router();
const { authCheck, adminCheck } = require("../middlewares/authCheck");
const multer = require("multer");

// use memory storage so we can convert file buffer to base64 and save to DB
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

const {
  listUsers,
  changeStatus,
  changeRole,
  userCart,
  getUserCart,
  emptyCart,
  saveAddress,
  getUserAddress,
  updateAddress,
  deleteAddress,
  saveOrder,
  getOrder,
  cancelOrder,
  returnOrder,
  uploadProfilePicture,
} = require("../controllers/user");

// 👤 User Management
router.get("/users", authCheck, adminCheck, listUsers);
router.post("/change-status", authCheck, adminCheck, changeStatus);
router.post("/change-role", authCheck, adminCheck, changeRole);

// 🛒 Cart
router.post("/user/cart", authCheck, userCart);
router.get("/user/cart", authCheck, getUserCart);
router.delete("/user/cart", authCheck, emptyCart);

// 📦 Order
router.post("/user/order", authCheck, saveOrder);
router.get("/user/order", authCheck, getOrder);
// Get payment method for a single order (derived from Stripe PI)
router.get(
  "/user/order/:id/payment-method",
  authCheck,
  async (req, res, next) => {
    // lazy-load controller to avoid circular requires in some setups
    try {
      const controller = require("../controllers/user");
      if (typeof controller.getOrderPaymentMethod === "function") {
        return controller.getOrderPaymentMethod(req, res, next);
      }
      return res.status(501).json({ message: "Not implemented" });
    } catch (err) {
      console.error("route /user/order/:id/payment-method error:", err);
      return res.status(500).json({ message: "Server Error" });
    }
  }
);
router.patch("/user/order/:id/cancel", authCheck, cancelOrder);

// 📦 Order (Return Product)
router.patch("/user/order/:id/return", authCheck, returnOrder);

// 📮 Address (CRUD)
router.post("/user/address", authCheck, saveAddress); // ✅ Create
router.get("/user/address", authCheck, getUserAddress); // ✅ Read (list)
router.put("/user/address/:id", authCheck, updateAddress); // ✅ Update
router.delete("/user/address/:id", authCheck, deleteAddress); // ✅ Delete

// 📸 Profile Picture
router.post(
  "/user/profile-picture",
  authCheck,
  upload.single("file"),
  uploadProfilePicture
);

module.exports = router;
