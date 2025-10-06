const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const { authCheck } = require("../middlewares/authCheck");

router.post("/", authCheck, reviewController.createReview);
router.get("/:productId", reviewController.getReviewsByProduct);
router.put("/:reviewId", authCheck, reviewController.updateReview);
router.delete("/:reviewId", authCheck, reviewController.deleteReview);

module.exports = router;
