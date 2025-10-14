const express = require("express");
const router = express.Router();
const { authCheck, adminCheck } = require("../middlewares/authCheck");

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
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

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
// Accept images via multipart/form-data in field name 'images'
router.patch(
  "/user/order/:id/return",
  authCheck,
  upload.array("images", 6),
  returnOrder
);

// Serve return image binary by id (no auth required for now; could be protected)
router.get("/user/return-image/:imageId", async (req, res, next) => {
  try {
    const controller = require("../controllers/user");
    if (typeof controller.getReturnImage === "function") {
      return controller.getReturnImage(req, res, next);
    }
    return res.status(501).json({ message: "Not implemented" });
  } catch (err) {
    console.error("route /user/return-image error:", err);
    return res.status(500).json({ message: "Server Error" });
  }
});

// 📮 Address (CRUD)
router.post("/user/address", authCheck, saveAddress); // ✅ Create
router.get("/user/address", authCheck, getUserAddress); // ✅ Read (list)
router.put("/user/address/:id", authCheck, updateAddress); // ✅ Update
router.delete("/user/address/:id", authCheck, deleteAddress); // ✅ Delete

// 📸 Profile Picture
router.post("/user/profile-picture", authCheck, uploadProfilePicture);

module.exports = router;
