const ptre = require("path-to-regexp");
const origParse = ptre.parse;
ptre.parse = function (str, opts) {
  try {
    console.error(
      "path-to-regexp.parse called with:",
      String(str).slice(0, 200)
    );
  } catch (e) {}
  return origParse.apply(this, arguments);
};
console.error("ptre hook installed");
