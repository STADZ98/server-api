require("dotenv").config();
const express = require("express");
const app = express();
const morgan = require("morgan");
const { readdirSync } = require("fs");
const cors = require("cors");
const path = require("path");

app.use(morgan("dev"));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));
app.use(cors({ origin: true, credentials: true }));

// Mount explicit routes first
app.use(
  "/api/subsubcategory",
  require(path.join(__dirname, "routes", "subsubcategory"))
);
app.use("/api/review", require(path.join(__dirname, "routes", "review")));
app.use("/api/shipping", require(path.join(__dirname, "routes", "shipping")));

// Mount all other routes in /routes
const routesDir = path.join(__dirname, "routes");
readdirSync(routesDir)
  .filter((p) => !["subsubcategory.js", "review.js", "shipping.js"].includes(p))
  .map((p) => app.use("/api", require(path.join(routesDir, p))));

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: "API endpoint not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`Error on ${req.method} ${req.originalUrl}:`, err.stack);
  res.status(500).json({ message: "Something broke!", error: err.message });
});

// ❌ ลบ app.listen(5005)
// ✅ export app ให้ Vercel ใช้
module.exports = app;
