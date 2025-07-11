const express = require("express");
const {
  accessChat,
  fetchChats,
  getChatById,
  createGroupChat,
  removeFromGroup,
  addToGroup,
  renameGroup,
  addAdminToGroup,
  getUnreadMessagesForChat,
  getUnreadMessagesForUser,
} = require("../controllers/chatControllers");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

router.route("/").post(verifyToken, accessChat);
router.route("/").get(verifyToken, fetchChats);
router.route("/group").post(verifyToken, createGroupChat);
router.get("/allunread", verifyToken, getUnreadMessagesForUser);
router.get("/chat/:chatId", verifyToken, getChatById);
router.route("/rename").put(verifyToken, renameGroup);
router.route("/groupremove").put(verifyToken, removeFromGroup);
router.route("/groupadd").put(verifyToken, addToGroup);
router.route("/addadmin").put(verifyToken, addAdminToGroup);
router.route("/unread/:chatId").get(verifyToken, getUnreadMessagesForChat);

module.exports = router;
