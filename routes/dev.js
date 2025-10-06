const express = require("express");
const router = express.Router();
const { authCheck } = require("../middlewares/authCheck");

router.get("/whoami", authCheck, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
