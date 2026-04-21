const express = require('express');
const router = express.Router();
const chatController = require('../Controllers/chatController');
const { isLoggedIn } = require('../middleware');

// Get chat history
router.get('/chat-history', isLoggedIn, chatController.getChatHistory);

// Save new message
router.post('/chat-message', isLoggedIn, chatController.saveChatMessage);

// Clear chat history
router.delete('/chat-history', isLoggedIn, chatController.clearChatHistory);

module.exports = router;