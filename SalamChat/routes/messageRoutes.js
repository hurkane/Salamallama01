const express = require("express");
const {
  allMessages,
  sendMessage,
  upload, // Import the upload middleware
} = require("../controllers/messageControllers");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

router.route("/chat/:chatId").get(verifyToken, allMessages);
router.route("/").post(verifyToken, upload.single("file"), sendMessage); // Use the upload middleware

module.exports = router;
