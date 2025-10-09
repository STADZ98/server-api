const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const { authCheck, adminCheck } = require("../middlewares/authCheck");
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

// Public
router.get("/:productId", reviewController.getReviewsByProduct);

// Serve stored review images
router.get("/image/:imageId", reviewController.getReviewImage);

// Review CRUD (user authenticated)
// Accept optional single image field named 'image'
router.post(
  "/",
  authCheck,
  upload.single("image"),
  reviewController.createReview
);
router.put(
  "/:reviewId",
  authCheck,
  upload.single("image"),
  reviewController.updateReview
);
router.delete("/:reviewId", authCheck, reviewController.deleteReview);

// Admin replies to a review
router.post(
  "/:reviewId/reply",
  authCheck,
  adminCheck,
  reviewController.replyToReview
);
router.patch(
  "/:reviewId/reply",
  authCheck,
  adminCheck,
  reviewController.updateReply
);
router.delete(
  "/:reviewId/reply",
  authCheck,
  adminCheck,
  reviewController.deleteReply
);

module.exports = router;
