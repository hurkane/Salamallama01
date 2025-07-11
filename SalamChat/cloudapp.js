const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const connectDB = require("./config/mongoDB");
const sequelize = require("./config/db");
const verifyToken = require("./middleware/verifyToken");
const colors = require("colors");
const { Server } = require("socket.io");
const Message = require("./models/messageModel");

dotenv.config();
connectDB();

const cors = require("cors");

const app = express();
app.use(
  cors({
    origin: "*", // Allow all origins
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Origin,X-Requested-With,Content-Type,Accept,Authorization",
  })
);
app.use(express.json());

// Sync Sequelize with PostgreSQL
sequelize.sync().then(() => {
  console.log("PostgreSQL connected".yellow.bold);
});

// Routes
app.use("/api/chat", verifyToken, chatRoutes);
app.use("/api/message", verifyToken, messageRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "/frontend/build")));
  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname, "frontend", "build", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5008;
const server = app.listen(PORT, () =>
  console.log(`Chat Server running on PORT ${PORT}...`.yellow.bold)
);

const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: function (origin, callback) {
      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      const host = process.env.HOST || "localhost";
      const allowedOrigins = [
        `${protocol}://${host}:5008`,
        `${protocol}://${host}:3000`,
        "http://172.179.65.62",
        "http://20.36.29.158",
        "https://20.36.29.158",
        "http://salam-ui:3000",
        "http://localhost:5008",
        "http://localhost:3000",
        "http://192.168.12.242:3001",
        "http://192.168.12.242:5008",
        "http://192.168.12.242",
        "https://www.salamallama.com",
        "https://salamallama.com",
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  },
});

const onlineUsers = new Set();

const {
  fetchUnreadMessagesForChat,
  fetchUnreadMessagesForUser,
} = require("./controllers/chatControllers"); // Adjust path if necessary

io.on("connection", (socket) => {
  console.log("Connected to socket.io");

  socket.on("setup", async (userData) => {
    socket.join(userData._id);
    socket.emit("connected");
    socket.userId = userData._id;
    onlineUsers.add(userData._id);

    // Notify all clients that a user is online
    io.emit("user online", userData._id);

    // Notify the new user about all current online users
    onlineUsers.forEach((userId) => {
      if (userId !== userData._id) {
        socket.emit("user online", userId);
      }
    });

    // Emit unread messages for all chats of the user
    try {
      const unreadMessages = await fetchUnreadMessagesForUser(userData._id);
      console.log("Emitting unread messages for all chats:", unreadMessages);
      socket.emit("unread messages", unreadMessages);
    } catch (error) {
      console.error("Error fetching unread messages:", error);
    }
  });

  socket.on("join chat", async (room) => {
    socket.join(room);

    // Emit unread messages for the specific chat
    try {
      const unreadMessages = await fetchUnreadMessagesForChat(
        socket.userId,
        room
      );
      console.log(`Emitting unread messages for chat ${room}:`, unreadMessages);
      socket.emit("unread messages for chat", {
        chatId: room,
        unreadMessages,
      });
    } catch (error) {
      console.error("Error fetching unread messages for chat:", error);
    }
  });

  socket.on("typing", (room) => {
    socket.in(room).emit("typing", socket.userId);
  });

  socket.on("stop typing", (room) => {
    socket.in(room).emit("stop typing");
  });

  socket.on("new message", (newMessageReceived) => {
    const chat = newMessageReceived.chat;

    if (!chat.users) return console.log("chat.users not defined");

    chat.users.forEach((userId) => {
      if (userId == newMessageReceived.sender) return;

      socket.in(userId).emit("message received", newMessageReceived);
    });
  });

  // Handle "mark as read" event
  socket.on("mark as read", async ({ chatId, userId }) => {
    try {
      await Message.updateMany(
        { chat: chatId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } } // Use $addToSet to avoid duplicates
      );
      console.log(
        `Messages in chat ${chatId} marked as read by user ${userId}`
      );

      // Emit the event back to the clients in the chat room
      const updatedMessages = await Message.find({ chat: chatId }).exec();
      io.in(chatId).emit("message read", updatedMessages);
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("USER DISCONNECTED");
    onlineUsers.delete(socket.userId);
    io.emit("user offline", socket.userId); // Notify all clients that a user is offline
    socket.leave(socket.userId);
  });
});
