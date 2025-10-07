const express = require("express");
const {
  create,
  list,
  read,
  remove,
  searchfilters,
  update,
  listby,
  createImages,
  removeImage,
  listBySubcategory,
  listByBrand,
} = require("../controllers/product");
const { authCheck, adminCheck } = require("../middlewares/authCheck");

const router = express.Router();

// ดึงสินค้าตามชื่อแบรนด์ (query ?brand=...)
router.get("/products", listByBrand);

router.post("/product", authCheck, adminCheck, create);
router.get("/products/:count", list);
router.get("/products/subcategory/:subcategoryId", listBySubcategory);
router.put("/product/:id", authCheck, adminCheck, update);
router.get("/product/:id", read);
router.delete("/product/:id", authCheck, adminCheck, remove);
router.post("/productby", listby);
router.post("/search/filters", searchfilters);
router.post("/images", authCheck, adminCheck, createImages);
router.post("/removeimages", authCheck, adminCheck, removeImage);

module.exports = router;
