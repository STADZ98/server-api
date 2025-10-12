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

// Explicitly respond to preflight OPTIONS requests for all routes.
// Some serverless platforms or proxies may not forward OPTIONS correctly,
// so this ensures the proper headers are returned.
app.options("*", cors({ origin: true, credentials: true }));

// Fallback middleware: ensure CORS headers are present on every response.
// This guards against environments where the CORS middleware might be skipped
// for certain requests (for example, errors during routing or platform quirks).
app.use((req, res, next) => {
  const origin = req.get("origin") || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

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
