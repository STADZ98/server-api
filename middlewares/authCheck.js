const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

exports.authCheck = async (req, res, next) => {
  try {
    const headerToken = req.headers.authorization;

    if (!headerToken || !headerToken.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided", code: "no_token" });
    }

    const token = headerToken.split(" ")[1];
    const decode = jwt.verify(token, process.env.SECRET);
    req.user = decode;

    const user = await prisma.user.findFirst({
      where: { email: req.user.email },
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", code: "user_not_found" });
    }

    if (!user.enabled) {
      return res.status(403).json({
        message: "This account cannot access",
        code: "account_disabled",
      });
    }

    next();
  } catch (err) {
    console.error("authCheck error:", err);
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired, please login again",
        code: "token_expired",
      });
    }
    res
      .status(401)
      .json({ message: "Token invalid or expired", code: "token_invalid" });
  }
};

exports.adminCheck = async (req, res, next) => {
  try {
    // be defensive: ensure req.user exists and contains an email
    if (!req.user || !req.user.email) {
      return res
        .status(401)
        .json({
          message: "Unauthorized: missing user context",
          code: "no_user",
        });
    }

    const email = req.user.email;
    const adminUser = await prisma.user.findFirst({ where: { email } });

    if (!adminUser || adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access Denied: Admin Only", code: "not_admin" });
    }

    return next();
  } catch (err) {
    console.error("adminCheck error:", err);
    res.status(500).json({
      message: "Error Admin access denied",
      code: "admin_check_error",
    });
  }
};
