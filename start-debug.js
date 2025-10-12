try {
  require("./server");
  console.log("server module loaded");
} catch (err) {
  console.error("Error requiring server.js:");
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
}
