const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const FormData = require("form-data");
const axios = require("axios");
const sequelize = require("./config/db");
const Comment = require("./models/Comment");
const User = require("./models/User");
const Post = require("./models/Post");
const verifyToken = require("./middleware/verifyToken");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());
const upload = multer({ storage: multer.memoryStorage() });
app.use(express.urlencoded({ extended: true }));

// Sync database
sequelize.sync({ alter: false }).then(() => {
  console.log("Database & tables created!");
});

// Create a Comment
app.post(
  "/api/comments",
  verifyToken,
  upload.single("file"),
  async (req, res) => {
    console.log("Received POST request to /api/comments");
    console.log("Request body:", req.body);
    const { content, postId, parentId } = req.body;
    const file = req.file;

    try {
      let mediaUrl = null;
      if (file) {
        const formData = new FormData();
        formData.append("file", file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        });
        console.log("Form data for media upload:", formData);

        try {
          const response = await axios.post(
            "http://salam-media:5003/upload?type=comment",
            formData,
            {
              headers: formData.getHeaders(),
            }
          );
          console.log("Media service response:", response.data);
          mediaUrl = response.data.filePath;
        } catch (uploadError) {
          console.error(
            "Error uploading media:",
            uploadError.response
              ? uploadError.response.data
              : uploadError.message
          );
          return res.status(500).send({ error: "Failed to upload media." });
        }
      }

      const comment = await Comment.create({
        content,
        media: mediaUrl,
        userId: req.userId,
        postId,
        parentId,
      });
      console.log("Comment created:", comment);

      // Fetch post owner ID
      const post = await Post.findByPk(postId);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      const postOwnerId = post.userId;
      console.log("Post owner ID:", postOwnerId);

      // Create notification for post owner
      await axios.post(
        "http://salam-notification:5006/api/notifications/create",
        {
          userId: postOwnerId,
          type: "comment",
          referenceId: postId,
          message: `Your post has been commented on by ${req.userId}.`,
          triggeredByUserId: req.userId,
        },
        {
          headers: {
            Authorization: req.headers.authorization,
          },
        }
      );

      // If there's a parent comment, notify the parent comment's owner
      if (parentId) {
        const parentComment = await Comment.findByPk(parentId);
        if (parentComment) {
          const parentCommentOwnerId = parentComment.userId;
          console.log("Parent comment owner ID:", parentCommentOwnerId);

          await axios.post(
            "http://salam-notification:5006/api/notifications/create",
            {
              userId: parentCommentOwnerId,
              type: "comment",
              referenceId: parentId,
              message: `Your comment has been replied to.`,
              triggeredByUserId: req.userId,
            },
            {
              headers: {
                Authorization: req.headers.authorization,
              },
            }
          );
        }
      }

      res.send(comment);
    } catch (error) {
      console.error("Error creating comment:", error.message);
      res.status(500).send({ error: "Failed to create comment." });
    }
  }
);

// Get Comment by ID
app.get("/api/comments/:id", verifyToken, async (req, res) => {
  console.log("Received GET request to /api/comments/:id");
  try {
    const comment = await Comment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "User",
          attributes: {
            exclude: ["password", "email", "createdAt", "updatedAt", "bio"],
          },
        },
      ],
    });

    if (!comment) {
      console.log("Comment not found:", req.params.id);
      return res.status(404).send({ error: "Comment not found." });
    }

    if (comment.media) {
      const [type, filename] = comment.media.split("/"); // Split media path
      const response = await axios.get(
        `http://salam-media:5003/media/${type}/${filename}`
      );
      comment.media = response.data.fileUrl;
    }

    return res.send(comment);
  } catch (error) {
    console.error("Error retrieving comment:", error.message);
    res.status(500).send({ error: "Failed to retrieve comment." });
  }
});

// Get All Comments for a Post with Pagination
app.get(
  "/api/comments/posts/:postId/comments",
  verifyToken,
  async (req, res) => {
    console.log("Received GET request to /posts/:postId/comments");
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
    const limit = 20; // Number of comments per page
    const offset = (page - 1) * limit; // Calculate offset

    try {
      const comments = await Comment.findAndCountAll({
        where: {
          postId: req.params.postId,
          parentId: null, // Filter to only include top-level comments
        },
        offset: offset,
        limit: limit,
      });
      res.send({
        comments: comments.rows,
        totalPages: Math.ceil(comments.count / limit),
        currentPage: page,
      });
    } catch (error) {
      console.error("Error retrieving comments:", error.message);
      res.status(500).send({ error: "Failed to retrieve comments." });
    }
  }
);

// Get Subcomments for a Comment
app.get(
  "/api/comments/:parentId/subcomments",
  verifyToken,
  async (req, res) => {
    console.log("Received GET request to /api/comments/:parentId/subcomments");
    const parentId = req.params.parentId;

    try {
      const subComments = await Comment.findAll({
        where: { parentId: parentId },
      });
      res.send(subComments);
    } catch (error) {
      console.error("Error retrieving subcomments:", error.message);
      res.status(500).send({ error: "Failed to retrieve subcomments." });
    }
  }
);

// Delete a Comment
app.delete("/api/comments/:id", verifyToken, async (req, res) => {
  try {
    const comment = await Comment.findByPk(req.params.id);
    if (comment && comment.userId === req.userId) {
      await comment.destroy();
      res.send({ success: true });
    } else {
      res.status(404).send({ error: "Comment not found or unauthorized." });
    }
  } catch (error) {
    res.status(500).send({ error: "Failed to delete comment." });
  }
});

const PORT = process.env.PORT || 5004;
app.listen(PORT, () => {
  console.log(`Comments service running on port ${PORT}`);
});
