const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs"); // หรือเปลี่ยนเป็น argon2 ได้
const jwt = require("jsonwebtoken");

// ✅ Register
exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ message: "email is require" });
    }
    if (!password) {
      return res.status(400).json({ message: "password is require" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "รหัสผ่านต้องมี 6 ตัวอักษรขึ้นไป" });
    }

    // ✅ ใช้ findUnique เร็วกว่า findFirst
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (user) {
      return res.status(400).json({ message: "Email already exists!" });
    }

    // ✅ ลด saltRounds ลงเล็กน้อยเพื่อ performance
    const hashPassword = await bcrypt.hash(password, 8);

    await prisma.user.create({
      data: {
        email,
        password: hashPassword,
        enabled: true,
        role: "user",
      },
    });

    res.send("Register success");
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "server error" });
  }
};

// ✅ Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // ✅ ใช้ findUnique + select เฉพาะ field ที่จำเป็น
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        enabled: true,
      },
    });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    if (!user.enabled) {
      return res.status(400).json({ message: "User is not enabled" });
    }

    // ✅ เช็ครหัสผ่าน
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "รหัสผ่านไม่ถูกต้อง" });
    }

    // ✅ สร้าง token payload
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    // ✅ สร้าง JWT
    const token = jwt.sign(payload, process.env.SECRET, { expiresIn: "1d" });

    // ✅ ส่ง profile กลับไปเลยเพื่อลดการ query ซ้ำ
    return res.json({ payload, token, profile: payload });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ Current User
exports.currentUser = async (req, res) => {
  try {
    if (!req.user || !req.user.email) {
      return res.status(400).json({ message: "Invalid token or user info" });
    }

    const user = await prisma.user.findUnique({
      where: { email: req.user.email },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user });
  } catch (err) {
    console.error("CurrentUser error:", err);
    res.status(500).json({ message: "server error" });
  }
};
