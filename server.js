require("dotenv").config();
const express = require("express");
const app = express();
const morgan = require("morgan");
const compression = require("compression");
const { readdirSync } = require("fs");
const cors = require("cors");
const path = require("path");

app.use(morgan("dev"));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));
// Compress responses to reduce transfer size (gzip/br)
app.use(compression());
app.use(cors({ origin: true, credentials: true }));
console.log("CORS middleware applied");

// Explicitly respond to preflight OPTIONS requests for all routes.
// Some serverless platforms or proxies may not forward OPTIONS correctly,
// so ensure the proper headers are returned early. Use a dedicated handler
// that echoes the request Origin header (or '*' if absent) so browsers
// receive an Access-Control-Allow-Origin matching the requester.
// Handle preflight OPTIONS in a path-agnostic way to avoid path-to-regexp
// parsing issues on some platforms. This mirrors the headers produced by
// the fallback middleware but runs earlier so serverless platforms that
// short-circuit routing still receive them.
app.use((req, res, next) => {
  if (req.method !== "OPTIONS") return next();
  const origin = req.get("origin") || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  return res.status(204).send();
});

// Fallback middleware: ensure CORS headers are present on every response.
// This guards against environments where the CORS middleware might be skipped
// for certain requests (for example, errors during routing or platform quirks).
app.use((req, res, next) => {
  const origin = req.get("origin") || "*";
  // Log origin for diagnostic purposes in production when debugging CORS
  if (process.env.NODE_ENV !== "production")
    console.log("Request origin:", origin);
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    // Return 204 for preflight and include small body for some proxies that
    // drop empty responses. Also ensure headers are flushed.
    res.status(204);
    return res.send();
  }
  next();
});
console.log("Fallback CORS middleware installed");

console.log("Mounting explicit routes");
// Mount explicit routes first (wrap requires to surface errors during dev)
try {
  const subsub = require(path.join(__dirname, "routes", "subsubcategory"));
  if (subsub && typeof subsub.use === "function")
    app.use("/api/subsubcategory", subsub);
  else console.warn("subsubcategory route did not export a router");
} catch (err) {
  console.error(
    "Failed to load routes/subsubcategory.js:",
    err && err.stack ? err.stack : err
  );
}
console.log("Mounted subsubcategory (or failed)");
try {
  const rev = require(path.join(__dirname, "routes", "review"));
  if (rev && typeof rev.use === "function") app.use("/api/review", rev);
  else console.warn("review route did not export a router");
} catch (err) {
  console.error(
    "Failed to load routes/review.js:",
    err && err.stack ? err.stack : err
  );
}
console.log("Mounted review (or failed)");
try {
  const ship = require(path.join(__dirname, "routes", "shipping"));
  if (ship && typeof ship.use === "function") app.use("/api/shipping", ship);
  else console.warn("shipping route did not export a router");
} catch (err) {
  console.error(
    "Failed to load routes/shipping.js:",
    err && err.stack ? err.stack : err
  );
}
console.log("Mounted shipping (or failed)");

// Mount all other routes in /routes
const routesDir = path.join(__dirname, "routes");
// Load each route file individually inside try/catch so startup errors
// (for example malformed route strings) can be identified during dev.
readdirSync(routesDir)
  .filter((p) => !["subsubcategory.js", "review.js", "shipping.js"].includes(p))
  .forEach((p) => {
    const full = path.join(routesDir, p);
    try {
      console.log("Loading route file", p);
      const r = require(full);
      console.log("Loaded route module", p);
      // Validate that the required module is a function or router-like
      if (typeof r === "function" || (r && typeof r.use === "function")) {
        app.use("/api", r);
      } else {
        console.warn(`Skipped loading route file (not a router): ${p}`);
      }
    } catch (err) {
      console.error(
        `Failed to load route file ${p}:`,
        err && err.stack ? err.stack : err
      );
    }
  });
console.log("Finished mounting routes");

// 404 handler
app.use((req, res, next) => {
  // Ensure CORS headers exist on 404 responses
  const origin = req.get("origin") || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.status(404).json({ message: "API endpoint not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(
    `Error on ${req.method} ${req.originalUrl}:`,
    err && err.stack ? err.stack : err
  );
  // Ensure error responses include CORS headers so the browser can receive the body
  const origin = req.get("origin") || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (process.env.NODE_ENV !== "production") {
    return res
      .status(500)
      .json({ message: "Something broke!", error: err.message });
  }
  res.status(500).json({ message: "Something broke!" });
});

// ❌ ลบ app.listen(5005)
// ✅ export app ให้ Vercel ใช้
module.exports = app;
