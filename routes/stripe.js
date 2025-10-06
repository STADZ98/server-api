const express = require("express");
const router = express.Router();
const { authCheck } = require("../middlewares/authCheck");
const { payment } = require('../controllers/stripe')
router.post("/user/create-payment-intent", authCheck, payment);

module.exports = router
