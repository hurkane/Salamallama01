const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const sequelize = require("./config/db");
const verifyToken = require("./middlewares/verifyToken");
const Interaction = require("./models/interaction");
const Post = require("./models/Post");
const Comment = require("./models/Comment");
const axios = require("axios");
const { Op } = require("sequelize");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5005;

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

// Interaction Endpoints

// Like a Post
app.post(
  "/api/interactions/like/post/:postId",
  verifyToken,
  async (req, res) => {
    try {
      // Remove existing interactions of type "like" or "dislike"
      const existingInteractions = await Interaction.findAll({
        where: {
          userId: req.userId,
          postId: req.params.postId,
          type: { [Op.in]: ["like", "dislike"] },
        },
      });
      if (existingInteractions.length > 0) {
        for (const interaction of existingInteractions) {
          await interaction.destroy();
          console.log("Existing interaction removed:", interaction);
        }
      }

      // Create new like interaction
      const interaction = await Interaction.create({
        userId: req.userId,
        postId: req.params.postId,
        type: "like",
      });

      const post = await Post.findByPk(req.params.postId);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      const postOwnerId = post.userId;
      await interaction.update({ postOwnerId });

      // Create notification
      await axios.post(
        "http://salam-notification:5006/api/notifications/create",
        {
          userId: postOwnerId,
          type: "like",
          referenceId: req.params.postId,
          message: `Your post has been liked by ${req.userId}.`,
          triggeredByUserId: req.userId,
        },
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );

      res.send(interaction);
    } catch (error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: "Failed to like post." });
    }
  }
);

// Dislike a Post
app.post(
  "/api/interactions/dislike/post/:postId",
  verifyToken,
  async (req, res) => {
    try {
      // Remove existing interactions of type "like" or "dislike"
      const existingInteractions = await Interaction.findAll({
        where: {
          userId: req.userId,
          postId: req.params.postId,
          type: { [Op.in]: ["like", "dislike"] },
        },
      });
      if (existingInteractions.length > 0) {
        for (const interaction of existingInteractions) {
          await interaction.destroy();
          console.log("Existing interaction removed:", interaction);
        }
      }

      // Create new dislike interaction
      const interaction = await Interaction.create({
        userId: req.userId,
        postId: req.params.postId,
        type: "dislike",
      });

      const post = await Post.findByPk(req.params.postId);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      const postOwnerId = post.userId;
      await interaction.update({ postOwnerId });

      // Create notification
      await axios.post(
        "http://salam-notification:5006/api/notifications/create",
        {
          userId: postOwnerId,
          type: "dislike",
          referenceId: req.params.postId,
          message: `Your post has been disliked by ${req.userId}.`,
          triggeredByUserId: req.userId,
        },
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );

      res.send(interaction);
    } catch (error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: "Failed to dislike post." });
    }
  }
);

// View a post
app.post(
  "/api/interactions/view/post/:postId",
  verifyToken,
  async (req, res) => {
    try {
      // Create new view interaction
      const interaction = await Interaction.create({
        userId: req.userId,
        postId: req.params.postId,
        type: "view",
      });

      const post = await Post.findByPk(req.params.postId);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      const postOwnerId = post.userId;
      await interaction.update({ postOwnerId });

      res.send(interaction);
    } catch (error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: "Failed to view post." });
    }
  }
);

// Get interactions for a post with specific columns
app.get("/api/interactions/post/:postId", verifyToken, async (req, res) => {
  try {
    // Query the Interactions table for the specified postId, selecting specific columns
    const interactions = await Interaction.findAll({
      where: { postId: req.params.postId },
      attributes: ["id", "userId", "postId", "type", "postOwnerId"], // Select only specific columns
    });

    if (interactions.length === 0) {
      return res
        .status(404)
        .json({ message: "No interactions found for this post." });
    }

    res.json(interactions);
  } catch (error) {
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to retrieve interactions." });
  }
});

// Get interaction of a post by the logged-in user excluding 'view' interactions
app.get(
  "/api/interactions/post/:postId/current",
  verifyToken,
  async (req, res) => {
    try {
      const userId = req.userId;
      const postId = req.params.postId;

      // Query the Interactions table for the specified postId and userId, excluding 'view' type
      const interaction = await Interaction.findOne({
        where: {
          postId,
          userId,
          type: {
            [Op.ne]: "view", // Exclude 'view' interactions
          },
        },
        attributes: ["id", "userId", "postId", "type", "postOwnerId"], // Select only specific columns
      });

      if (!interaction) {
        return res.status(404).json({
          message:
            "No like or dislike interaction found for this user on this post.",
        });
      }

      res.json(interaction);
    } catch (error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: "Failed to retrieve interaction." });
    }
  }
);

// Like a Comment
app.post(
  "/api/interactions/like/comment/:commentId",
  verifyToken,
  async (req, res) => {
    try {
      // Remove existing interactions of type "like" or "dislike"
      const existingInteractions = await Interaction.findAll({
        where: {
          userId: req.userId,
          commentId: req.params.commentId,
          type: { [Op.in]: ["like", "dislike"] },
        },
      });
      if (existingInteractions.length > 0) {
        for (const interaction of existingInteractions) {
          await interaction.destroy();
          console.log("Existing interaction removed:", interaction);
        }
      }

      // Create new like interaction
      const interaction = await Interaction.create({
        userId: req.userId,
        commentId: req.params.commentId,
        type: "like",
      });

      const comment = await Comment.findByPk(req.params.commentId);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      const commentOwnerId = comment.userId;
      await interaction.update({ commentOwnerId });

      // Create notification
      await axios.post(
        "http://salam-notification:5006/api/notifications/create",
        {
          userId: commentOwnerId,
          type: "like",
          referenceId: req.params.commentId,
          message: `Your comment has been liked by ${req.userId}.`,
          triggeredByUserId: req.userId,
        },
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );

      res.send(interaction);
    } catch (error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: "Failed to like comment." });
    }
  }
);

// Dislike a Comment
app.post(
  "/api/interactions/dislike/comment/:commentId",
  verifyToken,
  async (req, res) => {
    try {
      // Remove existing interactions of type "like" or "dislike"
      const existingInteractions = await Interaction.findAll({
        where: {
          userId: req.userId,
          commentId: req.params.commentId,
          type: { [Op.in]: ["like", "dislike"] },
        },
      });
      if (existingInteractions.length > 0) {
        for (const interaction of existingInteractions) {
          await interaction.destroy();
          console.log("Existing interaction removed:", interaction);
        }
      }

      // Create new dislike interaction
      const interaction = await Interaction.create({
        userId: req.userId,
        commentId: req.params.commentId,
        type: "dislike",
      });

      const comment = await Comment.findByPk(req.params.commentId);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      const commentOwnerId = comment.userId;
      await interaction.update({ commentOwnerId });

      // Create notification
      await axios.post(
        "http://salam-notification:5006/api/notifications/create",
        {
          userId: commentOwnerId,
          type: "dislike",
          referenceId: req.params.commentId,
          message: `Your comment has been disliked by ${req.userId}.`,
          triggeredByUserId: req.userId,
        },
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );

      res.send(interaction);
    } catch (error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: "Failed to dislike comment." });
    }
  }
);

// View a comment
app.post(
  "/api/interactions/view/comment/:commentId",
  verifyToken,
  async (req, res) => {
    try {
      // Create new view interaction
      const interaction = await Interaction.create({
        userId: req.userId,
        commentId: req.params.commentId,
        type: "view",
      });

      const comment = await Comment.findByPk(req.params.commentId);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      const commentOwnerId = comment.userId;
      await interaction.update({ commentOwnerId });

      res.send(interaction);
    } catch (error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: "Failed to view comment." });
    }
  }
);

// Get interactions for a comment with specific columns
app.get(
  "/api/interactions/comment/:commentId",
  verifyToken,
  async (req, res) => {
    try {
      // Query the Interactions table for the specified commentId, selecting specific columns
      const interactions = await Interaction.findAll({
        where: { commentId: req.params.commentId },
        attributes: ["id", "userId", "commentId", "type", "commentOwnerId"], // Select only specific columns
      });

      if (interactions.length === 0) {
        return res
          .status(404)
          .json({ message: "No interactions found for this comment." });
      }

      res.json(interactions);
    } catch (error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: "Failed to retrieve interactions." });
    }
  }
);

// Get interaction of a post by the logged-in user excluding 'view' interactions
app.get(
  "/api/interactions/comment/:commentId/current",
  verifyToken,
  async (req, res) => {
    try {
      const userId = req.userId;
      const commentId = req.params.commentId;

      // Query the Interactions table for the specified postId and userId, excluding 'view' type
      const interaction = await Interaction.findOne({
        where: {
          commentId,
          userId,
          type: {
            [Op.ne]: "view", // Exclude 'view' interactions
          },
        },
        attributes: ["id", "userId", "commentId", "type", "commentOwnerId"], // Select only specific columns
      });

      if (!interaction) {
        return res.status(404).json({
          message:
            "No like or dislike interaction found for this user on this comment.",
        });
      }

      res.json(interaction);
    } catch (error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: "Failed to retrieve interaction." });
    }
  }
);

// Delete Interaction
app.delete(
  "/api/interactions/remove/:interactionId",
  verifyToken,
  async (req, res) => {
    try {
      const interaction = await Interaction.findByPk(req.params.interactionId);

      if (!interaction) {
        return res.status(404).json({ error: "Interaction not found" });
      }

      // Ensure the user owns the interaction
      if (interaction.userId !== req.userId) {
        return res
          .status(403)
          .json({ error: "Unauthorized to remove this interaction" });
      }

      await interaction.destroy();
      console.log("Interaction removed:", interaction);

      res.send({ message: "Interaction removed successfully." });
    } catch (error) {
      console.error("Error removing interaction:", error.message);
      res.status(500).json({ error: "Failed to remove interaction." });
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
  console.log(`Server is running on :${PORT}`);
});
