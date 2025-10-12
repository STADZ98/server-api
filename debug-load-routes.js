const path = require("path");
const fs = require("fs");
const routesDir = path.join(__dirname, "routes");
const files = fs.readdirSync(routesDir).filter((p) => p.endsWith(".js"));
for (const f of files) {
  const full = path.join(routesDir, f);
  try {
    console.log("Requiring", f);
    const r = require(full);
    console.log(
      "OK",
      f,
      typeof r === "function" ? "function" : r && r.use ? "router" : typeof r
    );
  } catch (err) {
    console.error("ERROR requiring", f, err && err.stack ? err.stack : err);
  }
}
console.log("done");
