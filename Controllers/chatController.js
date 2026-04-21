const ChatMessage = require("../models/chatMessage.js");

exports.getChatHistory = async (req, res) => {
  try {
    const messages = await ChatMessage.find({ userId: req.user._id })
      .sort({ timestamp: 1 })
      .limit(50);

    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch chat history" });
  }
};

exports.saveChatMessage = async (req, res) => {
  try {
    const message = new ChatMessage({
      userId: req.user._id,
      text: req.body.text,
      sender: req.body.sender,
      timestamp: new Date(),
    });

    await message.save();
    return res.json(message);
  } catch (err) {
    return res.status(500).json({ error: "Failed to save message" });
  }
};

exports.clearChatHistory = async (req, res) => {
  try {
    await ChatMessage.deleteMany({ userId: req.user._id });
    return res.json({ message: "Chat history cleared" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to clear chat history" });
  }
};
