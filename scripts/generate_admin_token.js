const jwt = require("jsonwebtoken");

const token = jwt.sign(
  { email: "admin-test@example.com" },
  process.env.SECRET || "secret",
  {
    expiresIn: "1h",
  }
);

console.log(token);
