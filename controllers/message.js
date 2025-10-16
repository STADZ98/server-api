const Message = require("../models/Message");

// POST /messages - รับข้อความจากผู้ใช้
exports.createMessage = async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const msg = await Message.create({ name, email, message });
    res.status(201).json(msg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// GET /messages - ดึงข้อความทั้งหมด (Q&A)
exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /messages/:id/reply - แอดมินตอบกลับข้อความ
exports.replyMessage = async (req, res) => {
  try {
    const { reply } = req.body;
    const msg = await Message.findByIdAndUpdate(
      req.params.id,
      { reply, repliedAt: new Date() },
      { new: true }
    );
    if (!msg) return res.status(404).json({ error: "Message not found" });
    res.json(msg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
