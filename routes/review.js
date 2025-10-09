const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const { authCheck, adminCheck } = require("../middlewares/authCheck");

// Public
router.get("/:productId", reviewController.getReviewsByProduct);

// Review CRUD (user authenticated)
router.post("/", authCheck, reviewController.createReview);
router.put("/:reviewId", authCheck, reviewController.updateReview);
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
