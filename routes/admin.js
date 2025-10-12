const express = require("express");
const router = express.Router();
const { authCheck, adminCheck } = require("../middlewares/authCheck");
const {
  getAdminProfile,
  getOrdersAdmin,
  changeOrderStatus,
  getSalesSummary,
  getPaymentMethodStats,
  deleteUser,
  updateUserInfo,
  deleteOrder,
  debugPrisma,
  getTrackingFormats,
  getReturnRequests,
  updateReturnRequestStatus,
  getReviewsAdmin,
} = require("../controllers/admin");

const { updateOrderShipping } = require("../controllers/admin");
const { generateTrackingCode } = require("../controllers/admin");

router.put("/admin/order-status", authCheck, changeOrderStatus);
router.get("/admin/orders", authCheck, getOrdersAdmin);
router.get("/admin/sales-summary", authCheck, getSalesSummary);
router.get("/admin/payment-stats", authCheck, getPaymentMethodStats);
router.get("/admin/debug/prisma", authCheck, debugPrisma);
router.delete("/admin/user/:id", authCheck, deleteUser);
router.patch("/admin/user/:id", authCheck, updateUserInfo);
router.get("/admin/profile", authCheck, getAdminProfile);
router.delete("/admin/order/:id", authCheck, deleteOrder);
router.put("/admin/order-shipping", authCheck, updateOrderShipping);
router.post("/admin/generate-tracking", authCheck, generateTrackingCode);
router.get("/admin/tracking-formats", authCheck, getTrackingFormats);
// Admin return requests
router.get("/admin/return-requests", authCheck, adminCheck, getReturnRequests);
router.patch(
  "/admin/return-request/:id",
  authCheck,
  adminCheck,
  updateReturnRequestStatus
);
// Admin reviews list
router.get("/admin/reviews", authCheck, adminCheck, getReviewsAdmin);
// Admin review reply endpoints (mirror /api/review/:id/reply but under admin namespace)
const {
  adminReplyToReview,
  adminUpdateReply,
  adminDeleteReply,
} = require("../controllers/admin");

router.post(
  "/admin/reviews/:id/reply",
  authCheck,
  adminCheck,
  adminReplyToReview
);
router.patch(
  "/admin/reviews/:id/reply",
  authCheck,
  adminCheck,
  adminUpdateReply
);
router.delete(
  "/admin/reviews/:id/reply",
  authCheck,
  adminCheck,
  adminDeleteReply
);

module.exports = router;
