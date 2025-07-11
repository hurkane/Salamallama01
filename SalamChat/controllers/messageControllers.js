const asyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");
const axios = require("axios");
const FormData = require("form-data");
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage });

//@description     Get all Messages
//@route           GET /api/Message/chat/:chatId
//@access          Protected
const allMessages = asyncHandler(async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = 20; // Number of messages per page
    console.log("Received chatId:", chatId, "Page:", page);

    // Find messages for the specified chat with pagination
    const messages = await Message.find({ chat: chatId })
      .sort({ createdAt: -1 }) // Sort messages by creation date in descending order
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("chat");

    if (messages.length === 0) {
      console.warn("No messages found for the chat:", chatId);
      return res.json({
        chat: null,
        users: [],
        messages: [],
        page,
        totalPages: 0,
      });
    }

    // Fetch chat details once
    const chat = messages[0].chat;

    // Fetch user details once
    const uniqueUserIds = [
      ...new Set(
        messages
          .map((msg) => msg.sender)
          .concat(messages.flatMap((msg) => msg.readBy))
      ),
    ];
    const userDetailPromises = uniqueUserIds.map(async (userId) => {
      try {
        const response = await axios.get(
          `http://salam-user:5001/api/user/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${
                req.headers.authorization.split(" ")[1]
              }`,
            },
          }
        );
        return response.data;
      } catch (error) {
        console.error(
          `Error fetching user details for userId ${userId}:`,
          error.message
        );
        return null;
      }
    });

    const users = (await Promise.all(userDetailPromises)).filter(
      (user) => user !== null
    );

    // Fetch media details for messages with media
    const mediaDetailPromises = messages
      .filter((msg) => msg.media)
      .map(async (msg) => {
        try {
          const [type, filename] = msg.media.split("/");
          const response = await axios.get(
            `http://salam-media:5003/media/${type}/${filename}`
          );
          msg.mediaUrl = response.data.fileUrl;
        } catch (error) {
          console.error(
            `Error fetching media for message ${msg._id}:`,
            error.message
          );
          msg.mediaUrl = null;
        }
      });

    await Promise.all(mediaDetailPromises);

    // Create a map of user details for quick lookup
    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});

    // Simplify message structure
    const simplifiedMessages = messages.map((msg) => ({
      _id: msg._id,
      sender: msg.sender, // Store only the user ID
      content: msg.content,
      chat: msg.chat._id, // Store only the chat ID
      readBy: msg.readBy.map((readerId) =>
        userMap[readerId]
          ? {
              _id: readerId,
              username: userMap[readerId].username,
              profilePicture: userMap[readerId].profilePicture,
            }
          : readerId
      ),
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      media: msg.media, // Include media field
      mediaUrl: msg.mediaUrl, // Include media URL
    }));

    console.log("Simplified messages:", simplifiedMessages);

    // Calculate total number of pages
    const totalMessages = await Message.countDocuments({ chat: chatId });
    const totalPages = Math.ceil(totalMessages / pageSize);

    res.json({ chat, users, messages: simplifiedMessages, page, totalPages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res
      .status(400)
      .json({ message: "Error fetching messages", error: error.message });
  }
});

//@description     Create New Message
//@route           POST /api/Message/
const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;
  const file = req.file;
  const userId = req.userId;

  console.log("Request received for new message creation");
  console.log("Request user ID:", userId);

  // Log request data
  console.log("Request body:", req.body);
  console.log("Request file:", file);

  // Validate request data
  if (!content && !file) {
    console.error("Invalid data: content or file is required");
    return res.status(400).json({ message: "Content or file is required" });
  }
  if (!chatId) {
    console.error("Invalid data: chatId is required");
    return res.status(400).json({ message: "chatId is required" });
  }

  try {
    let mediaUrl = null;

    if (file) {
      const formData = new FormData();
      formData.append("file", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const response = await axios.post(
        "http://salam-media:5003/upload?type=message",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      mediaUrl = response.data.filePath;
    }

    const newMessage = {
      sender: userId,
      content: content || "", // Ensure a default empty value if no content is provided
      chat: chatId,
      media: mediaUrl,
    };

    // Create the message in the database
    console.log("Creating new message in MongoDB:", newMessage);
    const createdMessage = await Message.create(newMessage);
    console.log("Message created successfully:", createdMessage);

    // Fetch and populate the created message
    let message = await Message.findById(createdMessage._id).populate({
      path: "chat",
    });

    // Validate the fetched message structure
    if (!message || !message.chat || !Array.isArray(message.chat.users)) {
      console.error("Invalid message structure or missing chat/users data");
      return res.status(400).json({ message: "Error fetching message data" });
    }

    console.log("Message fetched from MongoDB:", message);

    // Ensure the chat includes all relevant users
    const chatUserIds = [...new Set([...message.chat.users, userId])];
    console.log("User IDs in chat:", chatUserIds);

    // Fetch corresponding user data from PostgreSQL
    console.log("Fetching user data from PostgreSQL for chat users...");
    const chatUsers = await Promise.all(
      chatUserIds.map(async (userId) => {
        try {
          console.log(`Looking up PostgreSQL user with ID: ${userId}`);
          const userDetails = await User.findOne({ where: { id: userId } });

          if (userDetails) {
            const userJson = userDetails.toJSON();
            console.log(
              `User found in PostgreSQL: ${JSON.stringify(userJson)}`
            );
            return {
              _id: userJson.id,
              username: userJson.username,
              email: userJson.email,
              profilePicture: userJson.profilePicture,
            };
          } else {
            console.warn(`No user found in PostgreSQL for ID: ${userId}`);
            return null;
          }
        } catch (error) {
          console.error(`Error fetching user with ID ${userId}:`, error);
          return null;
        }
      })
    );

    // Filter out any null users
    message.chat.users = chatUsers.filter(Boolean);
    console.log("Populated users from PostgreSQL:", message.chat.users);

    // Fetch the media URL
    if (message.media) {
      const [type, filename] = message.media.split("/");
      try {
        const response = await axios.get(
          `http://salam-media:5003/media/${type}/${filename}`
        );
        message = message.toObject();
        message.mediaUrl = response.data.fileUrl;
      } catch (error) {
        console.error(
          `Error fetching media URL for message ${message._id}:`,
          error.message
        );
        message.mediaUrl = null;
      }
    }

    // Update the latest message in the chat
    console.log("Updating latest message in chat...");
    await Chat.findByIdAndUpdate(chatId, {
      latestMessage: message,
      users: chatUserIds,
    });

    // Send the response with the message
    res.json(message);

    // Emit the new message to connected clients via Socket.IO
    const io = req.app.get("socketio");
    if (io) {
      console.log("Emitting new message via Socket.IO");
      io.to(chatId).emit("message received", message);

      // Emit an unread message event to the recipients
      for (const recipientId of message.chat.users) {
        if (recipientId !== userId) {
          // Fetch unread messages for the recipient
          const unreadMessages = await fetchUnreadMessagesForUser(recipientId);
          console.log(
            `Emitting unread messages for user ${recipientId}:`,
            unreadMessages
          );
          io.to(recipientId).emit("unread messages", unreadMessages);
        }
      }
    }
  } catch (error) {
    console.error("Error sending message:", error);
    res
      .status(400)
      .json({ message: "Error sending message", error: error.message });
  }
});

module.exports = { allMessages, sendMessage, upload };
