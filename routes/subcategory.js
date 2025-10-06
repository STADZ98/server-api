const express = require("express");
const router = express.Router();
const { create, list, remove, update } = require("../controllers/subcategory");
const { authCheck, adminCheck } = require("../middlewares/authCheck");

router.post("/subcategory", authCheck, adminCheck, create);
router.get("/subcategory", list);
router.put("/subcategory/:id", authCheck, adminCheck, update);
router.delete("/subcategory/:id", authCheck, adminCheck, remove);

module.exports = router;
