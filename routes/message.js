const express = require("express");
const router = express.Router();
const messageController = require("../controllers/message");

// POST /messages - ส่งข้อความ
router.post("/", messageController.createMessage);
// GET /messages - ดึง Q&A
router.get("/", messageController.getMessages);
// POST /messages/:id/reply - ตอบกลับ
router.post("/:id/reply", messageController.replyMessage);

module.exports = router;
