const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const sequelize = require("./config/db"); // Adjust path as necessary
const Notification = require("./models/Notification");
const verifyToken = require("./middlewares/verifyToken");
const axios = require("axios");
const { Op } = require("sequelize");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5006;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Sync Sequelize models
sequelize
  .sync()
  .then(() => {
    console.log("Database connected and models synchronized.");
  })
  .catch((err) => {
    console.error("Error connecting to the database:", err.message);
  });

// Helper function to get the username from the Users service
const getUsername = async (userId, token) => {
  try {
    const response = await axios.get(
      `http://salam-user:5001/api/user/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data.username;
  } catch (error) {
    console.error("Error fetching username:", error.message);
    return null;
  }
};

// Create Notification
app.post("/api/notifications/create", verifyToken, async (req, res) => {
  const { userId, type, referenceId, message, triggeredByUserId } = req.body;
  try {
    const triggeredByUsername = await getUsername(
      triggeredByUserId,
      req.headers.authorization.split(" ")[1]
    );
    const notificationMessage = triggeredByUsername
      ? `Your have a new ${type} from ${triggeredByUsername}.`
      : message;

    const notification = await Notification.create({
      userId,
      type,
      referenceId,
      message: notificationMessage,
      triggeredByUserId,
    });

    res.send(notification);
  } catch (error) {
    console.error("Error creating notification:", error.message);
    res.status(500).send({ error: "Failed to create notification." });
  }
});

// Get Notifications for a User with Pagination, excluding self-triggered
app.get("/api/notifications/user/:userId", verifyToken, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const notifications = await Notification.findAll({
      where: {
        userId: req.params.userId,
        triggeredByUserId: {
          [Op.ne]: req.params.userId, // Exclude self-triggered notifications
        },
      },
      order: [["createdAt", "DESC"]],
      limit: limit,
      offset: offset,
    });
    res.send(notifications);
  } catch (error) {
    console.error("Error retrieving notifications:", error.message);
    res.status(500).send({ error: "Failed to retrieve notifications." });
  }
});

// Get Unseen Notifications for a User with Pagination, excluding self-triggered
app.get("/api/notifications/unseen/:userId", verifyToken, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const unseenNotifications = await Notification.findAll({
      where: {
        userId: req.params.userId,
        seen: false,
        triggeredByUserId: {
          [Op.ne]: req.params.userId, // Exclude self-triggered notifications
        },
      },
      order: [["createdAt", "DESC"]],
      limit: limit,
      offset: offset,
    });
    res.send(unseenNotifications);
  } catch (error) {
    console.error("Error retrieving unseen notifications:", error.message);
    res.status(500).send({ error: "Failed to retrieve unseen notifications." });
  }
});

// Mark a Notification as Seen
app.put(
  "/api/notifications/:notificationId/seen",
  verifyToken,
  async (req, res) => {
    const { notificationId } = req.params;

    try {
      const notification = await Notification.findByPk(notificationId);
      if (!notification) {
        return res.status(404).send({ error: "Notification not found." });
      }

      notification.seen = true;
      await notification.save();

      res.send({ message: "Notification marked as seen." });
    } catch (error) {
      console.error("Error marking notification as seen:", error.message);
      res.status(500).send({ error: "Failed to mark notification as seen." });
    }
  }
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
