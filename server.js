// server.js
// ไฟล์หลักของฝั่ง backend ใช้ Express สร้าง REST API สำหรับ ecommerce
// - กำหนด middleware (morgan, cors, body parser)
// - mount routes จากโฟลเดอร์ routes
// - มี error handler และ 404 handler
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

// Mount /api/subsubcategory and /api/review explicitly first
app.use(
  "/api/subsubcategory",
  require(path.join(__dirname, "routes", "subsubcategory"))
);
app.use("/api/review", require(path.join(__dirname, "routes", "review")));

// Mount shipping route explicitly
app.use("/api/shipping", require(path.join(__dirname, "routes", "shipping")));

// Mount route อื่น ๆ
const routesDir = path.join(__dirname, "routes");
try {
  readdirSync(routesDir)
    .filter((p) => p !== "subsubcategory.js" && p !== "review.js")
    .map((p) => app.use("/api", require(path.join(routesDir, p))));
} catch (err) {
  console.error("Failed to mount routes from", routesDir, err.message);
}

app.listen(5005, () => console.log("Server is Running on port 5005"));

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: "API endpoint not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`Error on ${req.method} ${req.originalUrl}:`, err.stack);
  res.status(500).json({ message: "Something broke!", error: err.message });
});
