const express = require("express");
const router = express.Router();
const brandController = require("../controllers/brand");

router.get("/brand", brandController.list);
router.post("/brand", brandController.create);
router.delete("/brand/:id", brandController.remove);
router.put("/brand/:id", brandController.update);

module.exports = router;
