const fs = require("fs");
const path = require("path");
const routesDir = path.join(__dirname, "..", "routes");
const files = fs.readdirSync(routesDir).filter((p) => p.endsWith(".js"));
const re = /router\.(get|post|put|delete|patch|use)\s*\(\s*([`"'])(.*?)\2/gm;
for (const f of files) {
  const full = path.join(routesDir, f);
  const src = fs.readFileSync(full, "utf8");
  let m;
  console.log("\n==", f);
  while ((m = re.exec(src)) !== null) {
    console.log(" ", m[1], ":", m[3]);
  }
}
console.log("\ndone");
