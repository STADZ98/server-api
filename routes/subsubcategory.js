const express = require("express");
const router = express.Router();
const {
  create,
  list,
  remove,
  update,
} = require("../controllers/subsubcategory");
const { authCheck, adminCheck } = require("../middlewares/authCheck");

router.post("/", authCheck, adminCheck, create);
router.get("/", list);
router.put("/:id", authCheck, adminCheck, update);
router.delete("/:id", authCheck, adminCheck, remove);

module.exports = router;
