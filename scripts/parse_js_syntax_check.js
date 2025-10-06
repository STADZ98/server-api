const fs = require("fs");
const path = require("path");
const babelParser = require("@babel/parser");

const file = path.resolve(process.argv[2] || "");
if (!file) {
  console.error("Usage: node parse_js_syntax_check.js <file>");
  process.exit(2);
}
try {
  const code = fs.readFileSync(file, "utf8");
  babelParser.parse(code, {
    sourceType: "module",
    plugins: [
      "jsx",
      "classProperties",
      "optionalChaining",
      "nullishCoalescingOperator",
    ],
  });
  console.log("OK: parsed", file);
} catch (e) {
  console.error("Parse error:", e.message);
  process.exit(1);
}
