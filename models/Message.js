const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  reply: { type: String },
  createdAt: { type: Date, default: Date.now },
  repliedAt: { type: Date },
});

module.exports = mongoose.model("Message", MessageSchema);
