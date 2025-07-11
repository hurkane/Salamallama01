const asyncHandler = require("express-async-handler");
const Chat = require("../models/chatModel"); // Remove the destructuring to directly import Chat
const User = require("../models/userModel"); // Use PostgreSQL User model
const Message = require("../models/messageModel");

const axios = require("axios");

// Helper function to validate UUIDs
function isValidUUID(uuid) {
  const regexExp =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[4][0-9a-fA-F]{3}-[89ab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/i;
  return regexExp.test(uuid);
}

//@description     Create or fetch One-to-One Chat
//@route           POST /api/chat/
//@access          Protected
const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId || !isValidUUID(userId)) {
    console.log("UserId param not sent with request or invalid");
    return res
      .status(400)
      .json({ message: "UserId parameter is required and must be valid" });
  }

  console.log("Looking for chat between users:", req.userId, userId);

  try {
    let isChat = await Chat.findOne({
      isGroupChat: false,
      $and: [
        { users: { $elemMatch: { $eq: req.userId } } },
        { users: { $elemMatch: { $eq: userId } } },
      ],
    }).populate("latestMessage");

    if (isChat) {
      const userIds = isChat.users;

      const chatUsers = await Promise.all(
        userIds.map(async (id) => {
          if (!isValidUUID(id)) {
            console.error("Invalid UUID found:", id);
            return null;
          }
          const userDetails = await User.findByPk(id);
          return userDetails ? userDetails.toJSON() : null;
        })
      );

      isChat.users = chatUsers.filter((user) => user !== null);
      return res.status(200).json(isChat);
    }

    const chatData = {
      chatName: "sender",
      isGroupChat: false,
      users: [req.userId, userId],
    };

    const createdChat = await Chat.create(chatData);
    const fullChat = await Chat.findOne({ _id: createdChat._id }).populate(
      "latestMessage"
    );

    const userIds = fullChat.users;
    const chatUsers = await Promise.all(
      userIds.map(async (id) => {
        if (!isValidUUID(id)) {
          console.error("Invalid UUID found:", id);
          return null;
        }
        const userDetails = await User.findByPk(id);
        return userDetails ? userDetails.toJSON() : null;
      })
    );

    fullChat.users = chatUsers.filter((user) => user !== null);
    return res.status(200).json(fullChat);
  } catch (error) {
    console.log("Error accessing chat:", error);
    return res
      .status(500)
      .json({ message: "Error accessing chat", error: error.message });
  }
});

//@description     Get Chat details by ID
//@route           GET /api/chat/:chatId
//@access          Protected
const getChatById = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  try {
    const chat = await Chat.findById(chatId).populate("latestMessage").exec();

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Fetch user details for all users in the chat
    const userDetailPromises = chat.users.map(async (userId) => {
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

    // Attach user details to the chat object
    chat.users = users;

    res.status(200).json(chat);
  } catch (error) {
    console.error("Error fetching chat by ID:", error);
    res
      .status(500)
      .json({ message: "Error fetching chat by ID", error: error.message });
  }
});

const fetchUnreadMessagesForChat = async (userId, chatId) => {
  try {
    console.log(
      "Fetching unread messages for chat",
      chatId,
      "for user",
      userId
    );
    const messages = await Message.find({
      chat: chatId,
      readBy: { $ne: userId },
    }).exec();

    return messages;
  } catch (error) {
    console.error("Error fetching unread messages:", error);
    throw error;
  }
};

const fetchUnreadMessagesForUser = async (userId) => {
  try {
    console.log("Fetching unread messages for all chats for user", userId);
    const chats = await Chat.find({
      users: { $elemMatch: { $eq: userId } },
    }).exec();

    const chatIds = chats.map((chat) => chat._id);

    const unreadMessages = await Message.find({
      chat: { $in: chatIds },
      readBy: { $ne: userId },
    }).exec();

    return unreadMessages;
  } catch (error) {
    console.error("Error fetching unread messages:", error);
    throw error;
  }
};

//@description     Get all unread messages for a user in a chat by chat ID
//@route           GET /api/chat/unread/:chatId
//@access          Protected
const getUnreadMessagesForChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.userId;

  try {
    const messages = await fetchUnreadMessagesForChat(userId, chatId);
    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching unread messages:", error);
    res.status(500).json({
      message: "Error fetching unread messages",
      error: error.message,
    });
  }
});

//@description     Get all unread messages for a user across all their chats
//@route           GET /api/chat/allunread
//@access          Protected
const getUnreadMessagesForUser = asyncHandler(async (req, res) => {
  const userId = req.userId;

  try {
    const unreadMessages = await fetchUnreadMessagesForUser(userId);
    res.status(200).json(unreadMessages);
  } catch (error) {
    console.error("Error fetching unread messages:", error);
    res.status(500).json({
      message: "Error fetching unread messages",
      error: error.message,
    });
  }
});

//@description     Create New Group Chat
//@route           POST /api/chat/group
//@access          Protected
const createGroupChat = asyncHandler(async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).json({ message: "Please fill all the fields" });
  }

  let users = [];
  try {
    users = Array.isArray(req.body.users)
      ? req.body.users
      : JSON.parse(req.body.users);
  } catch (error) {
    return res.status(400).json({ message: "Invalid user data format" });
  }

  if (users.length < 2) {
    return res
      .status(400)
      .send("More than 2 users are required to form a group chat");
  }

  users.push(req.userId);

  const invalidUUIDs = users.filter((user) => !isValidUUID(user));
  if (invalidUUIDs.length > 0) {
    console.log("Invalid UUIDs found:", invalidUUIDs);
    return res.status(400).json({ message: "Invalid user IDs provided" });
  }

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users,
      isGroupChat: true,
      groupAdmins: req.userId,
    });

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id }).populate(
      "latestMessage"
    );

    const chatUsers = await Promise.all(
      fullGroupChat.users.map(async (user) => {
        if (!isValidUUID(user)) {
          console.error("Invalid UUID found:", user);
          return null;
        }
        const userDetails = await User.findByPk(user);
        return userDetails ? userDetails.toJSON() : null;
      })
    );

    fullGroupChat.users = chatUsers.filter((user) => user !== null);

    if (fullGroupChat.groupAdmins && isValidUUID(fullGroupChat.groupAdmins)) {
      const adminDetails = await User.findByPk(
        fullGroupChat.groupAdmins.toString()
      );
      fullGroupChat.groupAdmins = adminDetails ? adminDetails.toJSON() : null;
    }

    res.status(200).json(fullGroupChat);
  } catch (error) {
    console.error("Error creating group chat:", error.message);
    res
      .status(400)
      .json({ message: "Error creating group chat", error: error.message });
  }
});

//@description     Fetch all chats for a user with pagination
//@route           GET /api/chat/
//@access          Protected
const fetchChats = asyncHandler(async (req, res) => {
  try {
    console.log("Fetching chats for userId:", req.userId);

    if (!isValidUUID(req.userId)) {
      console.error("Invalid UUID for userId:", req.userId);
      return res.status(400).json({ message: "Invalid userId format" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalChats = await Chat.countDocuments({
      users: { $elemMatch: { $eq: req.userId } },
    });

    const chats = await Chat.find({
      users: { $elemMatch: { $eq: req.userId } },
    })
      .populate("latestMessage")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const populatedChats = await Promise.all(
      chats.map(async (chat) => {
        const chatUsers = await Promise.all(
          chat.users.map(async (user) => {
            if (!isValidUUID(user)) {
              console.error("Invalid UUID found:", user);
              return null;
            }
            const userDetails = await User.findByPk(user.toString());
            if (!userDetails) {
              console.warn(`No user found in PostgreSQL for ID: ${user}`);
              return null;
            }
            return userDetails.toJSON();
          })
        );

        chat.users = chatUsers.filter((user) => user !== null);

        if (chat.groupAdmins && isValidUUID(chat.groupAdmins)) {
          const adminDetails = await User.findByPk(chat.groupAdmins.toString());
          chat.groupAdmins = adminDetails ? adminDetails.toJSON() : null;
        }

        // Fetch username for the latest message sender using the getUserInfo API
        if (chat.latestMessage) {
          const senderId = chat.latestMessage.sender.toString();
          try {
            const senderInfoResponse = await axios.get(
              `http://salam-user:5001/api/user/${senderId}`,
              {
                headers: {
                  Authorization: `Bearer ${
                    req.headers.authorization.split(" ")[1]
                  }`,
                },
              }
            );
            chat.latestMessage.sender = senderInfoResponse.data.username;
          } catch (error) {
            console.error(
              `Failed to fetch sender info for ID: ${senderId}`,
              error.message
            );
          }
        }

        return chat;
      })
    );

    console.log("Successfully fetched and populated chats:", populatedChats);
    res.status(200).json({
      chats: populatedChats,
      currentPage: page,
      totalPages: Math.ceil(totalChats / limit),
      totalChats: totalChats,
    });
  } catch (error) {
    console.error("Error fetching chats:", error);
    res
      .status(400)
      .json({ message: "Error fetching chats", error: error.message });
  }
});

// Middleware to check if the user is the group admin
const checkAdmin = asyncHandler(async (req, res, next) => {
  const { chatId } = req.body;
  const chat = await Chat.findById(chatId);
  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }
  if (!chat.groupAdmins.includes(req.user.id)) {
    return res
      .status(403)
      .json({ message: "Only group admin can perform this action" });
  }
  next();
});

// @desc    Rename Group
// @route   PUT /api/chat/rename
// @access  Protected

const renameGroup = asyncHandler(async (req, res) => {
  const { chatId, chatName } = req.body;

  try {
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { chatName },
      { new: true }
    ).populate("latestMessage");

    if (!updatedChat) {
      res.status(404).json({ message: "Chat Not Found" });
      return;
    }

    const chatUsers = await Promise.all(
      updatedChat.users.map(async (user) => {
        const userDetails = await User.findByPk(user);
        return userDetails ? userDetails.toJSON() : null;
      })
    );
    updatedChat.users = chatUsers.filter((user) => user !== null);

    if (updatedChat.groupAdmins) {
      const adminDetails = await User.findByPk(updatedChat.groupAdmins);
      updatedChat.groupAdmins = adminDetails ? adminDetails.toJSON() : null;
    }

    res.status(200).json(updatedChat);
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error renaming group", error: error.message });
  }
});

// @desc    Remove user from Group
// @route   PUT /api/chat/groupremove
// @access  Protected
const removeFromGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat Not Found" });
    }

    chat.users = chat.users.filter((id) => id !== userId);
    await chat.save();

    const chatUsers = await Promise.all(
      chat.users.map(async (user) => {
        const userDetails = await User.findByPk(user);
        return userDetails ? userDetails.toJSON() : null;
      })
    );

    chat.users = chatUsers.filter((user) => user !== null);

    res.status(200).json(chat);
  } catch (error) {
    res.status(400).json({
      message: "Error removing user from group",
      error: error.message,
    });
  }
});

// @desc    Add user to Group / Leave
// @route   PUT /api/chat/groupadd
// @access  Protected
const addToGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat Not Found" });
    }

    if (!chat.users.includes(userId)) {
      chat.users.push(userId);
      await chat.save();
    }

    const chatUsers = await Promise.all(
      chat.users.map(async (user) => {
        const userDetails = await User.findByPk(user);
        return userDetails ? userDetails.toJSON() : null;
      })
    );

    chat.users = chatUsers.filter((user) => user !== null);

    res.status(200).json(chat);
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error adding user to group", error: error.message });
  }
});

// @desc    Add admin to Group
// @route   PUT /api/chat/addadmin
// @access  Protected
const addAdminToGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat Not Found" });
    }

    if (!chat.groupAdmins.includes(userId)) {
      chat.groupAdmins.push(userId);
      await chat.save();
    }

    const chatUsers = await Promise.all(
      chat.users.map(async (user) => {
        const userDetails = await User.findByPk(user);
        return userDetails ? userDetails.toJSON() : null;
      })
    );

    chat.users = chatUsers.filter((user) => user !== null);

    const adminDetails = await Promise.all(
      chat.groupAdmins.map(async (admin) => {
        const adminDetail = await User.findByPk(admin);
        return adminDetail ? adminDetail.toJSON() : null;
      })
    );

    chat.groupAdmins = adminDetails.filter((admin) => admin !== null);

    res.status(200).json(chat);
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error adding admin to group", error: error.message });
  }
});

module.exports = {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  addAdminToGroup,
  removeFromGroup,
  getChatById,
  getUnreadMessagesForChat,
  getUnreadMessagesForUser,
  fetchUnreadMessagesForChat,
  fetchUnreadMessagesForUser,
};
