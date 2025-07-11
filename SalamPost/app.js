const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
const { sequelize, User, Post } = require("./models");
const verifyToken = require("./verifyToken");
const { Op } = require("sequelize");
const SearchHistory = require("./models/searchHistory");
const retry = require("async-retry");

const upload = multer({ storage: multer.memoryStorage() });

const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use(async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return res.status(403).send("A token is required for authentication");
  }
  try {
    const userId = await verifyToken(token);
    req.userId = userId;
    next();
  } catch (error) {
    res.status(401).send("Unauthorized");
  }
});

// Helper function to check follow status
async function isFollowing(followerId, followedId, token) {
  try {
    console.log("Checking if user", followerId, "is following user", followedId); // Debug log
    
    const response = await axios.get(
      `http://salam-user:5001/api/follow/status`,
      {
        params: { followerId, followedId },
        headers: {
          Authorization: `Bearer ${token}` // Add the token to the request
        }
      }
    );
    
    console.log("Follow status response:", response.data); // Debug log
    
    // Work with your existing API response format
    // Check if the follow relationship exists and is approved
    return response.data.status === "approved";
  } catch (error) {
    console.log("Error checking follow status:", error.message);
    console.log("Response data:", error.response?.data);
    console.log("Response status:", error.response?.status);
    return false;
  }
}

// Get a Post by ID
app.get("/api/post/:id", async (req, res) => {
  console.log("Received GET request for a post with ID:", req.params.id);
  console.log("User ID from token:", req.userId);
  
  try {
    const post = await Post.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "User",
          attributes: {
            exclude: ["password", "email", "createdAt", "updatedAt", "bio"],
            include: ["name"],
          },
        },
      ],
    });

    if (!post) {
      console.log("Post not found.");
      return res.status(404).send({ error: "Post not found." });
    }

    console.log("Retrieved Post:", post);
    const user = post.User;
    console.log("Post User:", user);
    console.log("User profile public:", user.profilePublic);

    // Extract token from request headers
    const token = req.headers.authorization?.split(' ')[1]; // Assuming "Bearer <token>" format
    
    // Check authorization: Show post if:
    // 1. User is the post author, OR
    // 2. Post author's profile is public, OR
    // 3. Post author's profile is private BUT current user is following them
    let isAuthorized = false;
    
    if (req.userId === user.id) {
      console.log("User owns the post - authorized");
      isAuthorized = true;
    } else if (user.profilePublic) {
      console.log("Post author's profile is public - authorized");
      isAuthorized = true;
    } else if (!user.profilePublic) {
      console.log("Profile is private, checking follow status...");
      const followStatus = await isFollowing(req.userId, user.id, token);
      console.log("Follow status result:", followStatus);
      isAuthorized = followStatus;
    }

    if (isAuthorized) {
      console.log("User is authorized to view this post");
      
      // Handle media if present
      if (post.media) {
        const [type, filename] = post.media.split("/");
        try {
          const response = await axios.get(
            `http://salam-media:5003/media/${type}/${filename}`
          );
          post.media = response.data.fileUrl;
        } catch (mediaError) {
          console.log("Error fetching media:", mediaError.message);
          // Continue without media URL if fetch fails
        }
      }
      return res.send(post);
    } else {
      console.log("Not authorized to view this post from private profile.");
      return res
        .status(403)
        .send({ error: "Not authorized to view this post from private profile." });
    }
  } catch (error) {
    console.log("Error retrieving post:", error.message);
    res.status(500).send({ error: "Failed to retrieve post." });
  }
});


// Create a Post
app.post("/api/post", upload.single("file"), async (req, res) => {
  const { content, latitude, longitude } = req.body;
  const file = req.file;
  console.log("Request body:", req.body);
  console.log("User ID:", req.userId);

  try {
    let mediaUrl = null;

    if (file) {
      const formData = new FormData();
      formData.append("file", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const response = await axios.post(
        "http://salam-media:5003/upload?type=post",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        }
      );

      console.log("Response from Media service:", response.data);
      mediaUrl = response.data.filePath;
    }

    const post = await Post.create({
      content,
      media: mediaUrl,
      userId: req.userId,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    });

    console.log("Post created:", post);
    res.send(post);
  } catch (error) {
    console.error("Error creating post:", error.message);
    res.status(500).send({ error: "Failed to create post." });
  }
});

// Delete a Post
app.delete("/api/post/:id", async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (post && post.userId === req.userId) {
      await post.destroy();
      res.send({ success: true });
    } else {
      res.status(404).send({ error: "Post not found or unauthorized." });
    }
  } catch (error) {
    res.status(500).send({ error: "Failed to delete post." });
  }
});



// Get All Posts ids for a User with Pagination
app.get("/api/userposts/:id/posts", async (req, res) => {
  console.log("Received GET request for all posts for user ID:", req.params.id);
  console.log("User ID from token:", req.userId);

  const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
  const limit = 20; // Number of posts per page
  const offset = (page - 1) * limit; // Calculate offset

  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).send({ error: "User not found." });
    }

    const posts = await Post.findAndCountAll({
      where: { userId: user.id },
      offset: offset,
      limit: limit,
      order: [["createdAt", "DESC"]], // Order by createdAt in descending order
    });

    // Log the post IDs
    const postIds = posts.rows.map((post) => post.id);
    console.log("Post IDs:", postIds);

    res.send({
      postIds: postIds,
      totalPages: Math.ceil(posts.count / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error retrieving posts:", error.message);
    res.status(500).send({ error: "Failed to retrieve posts." });
  }
});

// Search Posts by Keyword and Get Post IDs with Pagination
app.get("/api/allpost/search", async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
  const limit = parseInt(req.query.limit) || 20; // Number of posts per page
  const offset = (page - 1) * limit; // Calculate offset
  const keyword = req.query.keyword || "";

  console.log("Searching posts with keyword:", keyword);

  try {
    // Log search history
    await SearchHistory.create({
      userId: req.userId,
      keyword: keyword,
      searchType: "Post Search",
    });

    const posts = await Post.findAndCountAll({
      where: {
        content: {
          [Op.iLike]: `%${keyword}%`,
        },
      },
      offset: offset,
      limit: limit,
    });

    // Log the post IDs
    const postIds = posts.rows.map((post) => post.id);
    console.log("Post IDs:", postIds);

    res.send({
      postIds: postIds,
      totalPages: Math.ceil(posts.count / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error searching posts:", error.message);
    res.status(500).send({ error: "Failed to search posts." });
  }
});

// Get Top Words in Posts Content with Pagination
const stopWords = [
  "the",
  "is",
  "in",
  "and",
  "to",
  "of",
  "a",
  "it",
  "for",
  "on",
  "with",
  "as",
  "this",
  "that",
  "by",
  "at",
  "an",
  "be",
  "are",
  "was",
  "from",
  "or",
  "we",
  "can",
  "not",
  "but",
  "all",
  "they",
  "he",
  "she",
  "you",
  "his",
  "her",
  "their",
];

//retired
app.get("/api/allpost/top-words", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const result = await sequelize.query(
      `WITH content_words AS (
          SELECT unnest(string_to_array(regexp_replace(content, '%', ' ', 'g'), ' ')) AS word
          FROM "Posts"
      ),
      word_counts AS (
          SELECT word, COUNT(*) AS count
          FROM content_words
          WHERE word <> '' AND lower(word) NOT IN (${stopWords
            .map((word) => `'${word}'`)
            .join(", ")})
          GROUP BY word
      )
      SELECT word, count
      FROM word_counts
      ORDER BY count DESC
      LIMIT :limit OFFSET :offset;`,
      {
        replacements: { limit, offset },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    res.send({
      words: result,
      currentPage: page,
      limit: limit,
    });
  } catch (error) {
    console.error("Error retrieving top words in posts:", error.message);
    res.status(500).send({ error: "Failed to retrieve top words in posts." });
  }
});

// Get Top Sentences in Posts Content with Pagination
app.get("/api/allpost/top-sentences", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const result = await sequelize.query(
      `WITH stop_words AS (
          SELECT unnest(ARRAY['this', 'that', 'those', 'these', 'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'with', 'he', 'she', 'i', 'we', 'they', 'them', 'him', 'me', 'his', 'her', 'our', 'us', 'their', 'theirs', 'who', 'what', 'where', 'which', 'when', 'mine']) AS word
      ),
      words AS (
          SELECT id, unnest(string_to_array(regexp_replace(lower(content), '[^[:alnum:]\\s]+', ' ', 'g'), ' ')) AS word, generate_series(1, array_length(string_to_array(regexp_replace(lower(content), '[^[:alnum:]\\s]+', ' ', 'g'), ' '), 1)) AS seq
          FROM "Posts"
          WHERE content !~ '(https?:\\/\\/|www\\.)'  -- Ignore URLs
      ),
      filtered_words AS (
          SELECT *
          FROM words
          WHERE length(word) <= 15  -- Ignore words longer than 15 characters
      ),
      bigrams AS (
          SELECT id, word, lead(word) OVER (PARTITION BY id ORDER BY seq) AS next_word
          FROM filtered_words
      ),
      trigrams AS (
          SELECT id, word, lead(word, 1) OVER (PARTITION BY id ORDER BY seq) AS next_word, lead(word, 2) OVER (PARTITION BY id ORDER BY seq) AS third_word
          FROM filtered_words
      ),
      sentence_counts AS (
          SELECT word AS sentence, COUNT(*) AS count
          FROM filtered_words
          WHERE word NOT IN (SELECT word FROM stop_words)
          GROUP BY word
          UNION ALL
          SELECT word || ' ' || next_word AS sentence, COUNT(*) AS count
          FROM bigrams
          WHERE word IS NOT NULL AND next_word IS NOT NULL
            AND word NOT IN (SELECT word FROM stop_words)
            AND next_word NOT IN (SELECT word FROM stop_words)
          GROUP BY word, next_word
          UNION ALL
          SELECT word || ' ' || next_word || ' ' || third_word AS sentence, COUNT(*) AS count
          FROM trigrams
          WHERE word IS NOT NULL AND next_word IS NOT NULL AND third_word IS NOT NULL
            AND word NOT IN (SELECT word FROM stop_words)
            AND next_word NOT IN (SELECT word FROM stop_words)
            AND third_word NOT IN (SELECT word FROM stop_words)
          GROUP BY word, next_word, third_word
      )
      SELECT sentence, count
      FROM sentence_counts
      WHERE array_length(string_to_array(sentence, ' '), 1) <= 3
      AND sentence !~ '^\\s*$'
      ORDER BY count DESC
      LIMIT :limit OFFSET :offset;`,
      {
        replacements: { limit, offset },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    res.send({
      sentences: result,
      currentPage: page,
      limit: limit,
    });
  } catch (error) {
    console.error("Error retrieving top sentences in posts:", error.message);
    res
      .status(500)
      .send({ error: "Failed to retrieve top sentences in posts." });
  }
});

sequelize.sync({ force: false }).then(() => {
  app.listen(5002, () => {
    console.log("SalamPost service running on port 5002");
  });
});

module.exports = app;
