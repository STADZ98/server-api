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
// Helpful GET handler for /productby: log info and return 405 so accidental GETs are visible
router.get("/productby", (req, res) => {
  try {
    const info = {
      ip: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.get("User-Agent") || null,
      referer: req.get("Referer") || req.get("Referrer") || null,
    };
    console.info("GET /productby hit:", info);
  } catch (e) {
    console.error("Error logging GET /productby:", e && e.stack ? e.stack : e);
  }
  return res
    .status(405)
    .json({
      message: "Use POST /productby with JSON body { sort, order, limit }",
    });
});
router.post("/productby", listby);
router.post("/search/filters", searchfilters);
router.post("/images", authCheck, adminCheck, createImages);
router.post("/removeimages", authCheck, adminCheck, removeImage);

module.exports = router;
