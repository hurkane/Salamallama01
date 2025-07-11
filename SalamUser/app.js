const express = require("express");
const bodyParser = require("body-parser");
const verifyToken = require("./verifyToken");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const sequelize = require("./config/db");
const User = require("./models/User");
const Follow = require("./models/Follow");
const bcrypt = require("bcryptjs"); // Import bcrypt
const { Op } = require("sequelize");
const SearchHistory = require("./models/searchHistory");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());
const upload = multer({ storage: multer.memoryStorage() });
app.use(express.urlencoded({ extended: true }));

app.use(async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  console.log("Received token:", token); // Log the received token
  if (!token) {
    console.log("No token provided");
    return res.status(403).send("A token is required for authentication");
  }
  try {
    const userId = await verifyToken(token);
    console.log("Token verified. User ID:", userId); // Log successful verification
    req.userId = userId;
    next();
  } catch (error) {
    console.log("Token verification failed:", error.message); // Log the error message
    res.status(401).send("Unauthorized");
  }
});

// Update User Info
app.put("/api/user", async (req, res) => {
  const { username, password, bio, name, email, profilePublic } = req.body;

  try {
    const user = await User.findByPk(req.userId); // Use verified token userId
    if (!user) {
      console.log("User not found:", req.userId);
      return res.status(404).send({ error: "User not found." });
    }

    // Ensure the user is updating their own profile
    if (req.userId !== user.id) {
      console.log("Unauthorized update attempt by user:", req.userId);
      return res
        .status(403)
        .send({ error: "Not authorized to update this profile." });
    }

    console.log("Updating user:", user);

    user.username = username || user.username;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }
    user.bio = bio || user.bio;
    user.name = name || user.name;
    user.email = email || user.email;
    if (profilePublic !== undefined) {
      // Handle profilePublic toggle
      user.profilePublic = profilePublic;
    }

    await user.save();
    console.log("User updated successfully:", user);
    res.send(user);
  } catch (error) {
    console.log("Failed to update user profile:", error.message);
    res.status(500).send({ error: "Failed to update user profile." });
  }
});

// Update Profile Picture
app.put(
  "/api/user/profilePicture",
  upload.single("profilePicture"),
  async (req, res) => {
    const file = req.file;

    try {
      const user = await User.findByPk(req.userId);
      if (!user) {
        console.log("User not found:", req.userId);
        return res.status(404).send({ error: "User not found." });
      }

      if (file) {
        const formData = new FormData();
        formData.append("file", file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        });

        const response = await axios.post(
          "http://salam-media:5003/upload?type=profile_picture",
          formData,
          {
            headers: { ...formData.getHeaders() },
          }
        );

        user.profilePicture = response.data.filePath;
        console.log("Uploaded profile picture path:", response.data.filePath);
      }

      await user.save();
      console.log("User saved with new profilePicture:", user.profilePicture);

      res.send({
        id: user.id,
        profilePicture: user.profilePicture,
        name: user.name,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      console.log("Failed to update profile picture:", error.message);
      res.status(500).send({ error: "Failed to update profile picture." });
    }
  }
);

// Get user Profile Picture URL by user id
app.get("/api/user/:id/profilePicture", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: {
        exclude: ["password", "email"], // Exclude sensitive fields
      },
    });
    if (!user) {
      return res.status(404).send({ error: "User not found." });
    }
    if (user.profilePicture) {
      const [type, filename] = user.profilePicture.split("/").slice(-2);
      const response = await axios.get(
        `http://salam-media:5003/media/${type}/${filename}`
      );
      user.profilePicture = response.data.fileUrl;
    }
    res.send({
      id: user.id,
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    console.log("Failed to get profile picture:", error.message);
    res.status(500).send({ error: "Failed to get profile picture." });
  }
});

// Update Profile Banner
app.put("/api/user/Banner", upload.single("Banner"), async (req, res) => {
  const file = req.file;

  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      console.log("User not found:", req.userId);
      return res.status(404).send({ error: "User not found." });
    }

    if (file) {
      const formData = new FormData();
      formData.append("file", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const response = await axios.post(
        "http://salam-media:5003/upload?type=Banner",
        formData,
        {
          headers: { ...formData.getHeaders() },
        }
      );

      user.Banner = response.data.filePath;
      console.log("Uploaded profile Banner path:", response.data.filePath);
    }

    await user.save();
    console.log("User saved with new Banner:", user.Banner);

    res.send({
      id: user.id,
      Banner: user.Banner,
      name: user.name,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.log("Failed to update profile Banner:", error.message);
    res.status(500).send({ error: "Failed to update profile Banner." });
  }
});

// Get user Profile Banner URL by user id
app.get("/api/user/:id/Banner", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: {
        exclude: ["password", "email"], // Exclude sensitive fields
      },
    });
    if (!user) {
      return res.status(404).send({ error: "User not found." });
    }
    if (user.Banner) {
      const [type, filename] = user.Banner.split("/").slice(-2);
      const response = await axios.get(
        `http://salam-media:5003/media/${type}/${filename}`
      );
      user.Banner = response.data.fileUrl;
    }
    res.send({
      id: user.id,
      Banner: user.Banner,
    });
  } catch (error) {
    console.log("Failed to get profile Banner:", error.message);
    res.status(500).send({ error: "Failed to get profile Banner." });
  }
});

// Get User Info by id
app.get("/api/user/:id", async (req, res) => {
  try {
    const targetUser = await User.findByPk(req.params.id, {
      attributes: {
        exclude: ["password", "email"], // Exclude sensitive fields
      },
    });
    if (targetUser) {
      if (targetUser.profilePicture) {
        const [type, filename] = targetUser.profilePicture.split("/").slice(-2);
        const response = await axios.get(
          `http://salam-media:5003/media/${type}/${filename}`
        );
        targetUser.profilePicture = response.data.fileUrl;
      }
      res.send({
        id: targetUser.id,
        username: targetUser.username,
        bio: targetUser.bio,
        name: targetUser.name,
        profilePicture: targetUser.profilePicture,
        profilePublic: targetUser.profilePublic,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt,
      });
    } else {
      res.status(404).send({ error: "User not found." });
    }
  } catch (error) {
    console.log("Failed to retrieve user info:", error.message);
    res.status(500).send({ error: "Failed to retrieve user info." });
  }
});

// Search Users by Username or Email and Get User Details with Pagination
app.get("/api/users/search", async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
  const limit = parseInt(req.query.limit) || 20; // Number of users per page
  const offset = (page - 1) * limit; // Calculate offset
  const keyword = req.query.keyword || "";

  console.log("Searching users with keyword:", keyword);

  try {
    // Log search history
    await SearchHistory.create({
      userId: req.userId,
      keyword: keyword,
      searchType: "User Search",
    });

    const users = await User.findAndCountAll({
      where: {
        [Op.or]: [
          { username: { [Op.iLike]: `%${keyword}%` } },
          { email: { [Op.iLike]: `%${keyword}%` } },
          { name: { [Op.iLike]: `%${keyword}%` } },
        ],
      },
      offset: offset,
      limit: limit,
      attributes: ["id", "username", "email", "name", "profilePicture"], // Select the necessary fields
    });

    // Log the user details
    const userDetails = users.rows.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      profilePicture: user.profilePicture,
    }));
    console.log("User Details:", userDetails);

    res.send({
      users: userDetails,
      totalPages: Math.ceil(users.count / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error searching users:", error.message);
    res.status(500).send({ error: "Failed to search users." });
  }
});

// Get Current User's Search History
app.get("/api/user-search/history", async (req, res) => {
  const { userId } = req; // Use the user ID from the authenticated token
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      console.log("User not found:", userId);
      return res.status(404).send({ error: "User not found." });
    }
    if (req.userId !== user.id) {
      console.log("Unauthorized access attempt by user:", req.userId);
      return res
        .status(403)
        .send({ error: "Not authorized to view this history." });
    }
    const searchHistory = await SearchHistory.findAll({
      where: { userId: userId },
      order: [["createdAt", "DESC"]],
    });
    res.send(searchHistory);
  } catch (error) {
    console.error("Error retrieving search history:", error.message);
    res.status(500).send({ error: "Failed to retrieve search history." });
  }
});

// Get Top Searched Words with Pagination
app.get("/api/user-search/top-words", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const result = await sequelize.query(
      `WITH keyword_words AS (
          SELECT unnest(string_to_array(regexp_replace(keyword, '%', ' ', 'g'), ' ')) AS word
          FROM "SearchHistories"
      ),
      word_counts AS (
          SELECT word, COUNT(*) AS count
          FROM keyword_words
          WHERE word <> ''
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
    console.error("Error retrieving top searched words:", error.message);
    res.status(500).send({ error: "Failed to retrieve top searched words." });
  }
});

// Follow Request
app.post("/api/follow", async (req, res) => {
  const { followedId } = req.body;

  const followedUser = await User.findByPk(followedId);
  const status = followedUser.profilePublic ? "approved" : "pending";

  const follow = await Follow.create({
    followerId: req.userId,
    followedId,
    status: status,
  });
  res.send(follow);
});

// Get a Follow Status
app.get("/api/follow/status", async (req, res) => {
  const { followerId, followedId } = req.query;
  try {
    const follow = await Follow.findOne({ where: { followerId, followedId } });
    if (follow) {
      res.send({ status: follow.status, id: follow.id });
    } else {
      // No follow relationship, return a meaningful default response
      res.send({ status: "not following", id: null });
    }
  } catch (error) {
    console.log("Error in follow status check:", error.message); // Log any errors
    res.status(500).send({ error: "Failed to check follow status." });
  }
});

// See Who Requested to Follow Me
app.get("/api/follow/requests", async (req, res) => {
  try {
    const followRequests = await Follow.findAll({
      where: {
        followedId: req.userId,
        status: "pending", // Only fetch pending follow requests
      },
    });
    res.send(followRequests);
  } catch (error) {
    res.status(500).send({ error: "Failed to retrieve follow requests." });
  }
});

// Accept a Follow Request
app.put("/api/follow/accept/:id", async (req, res) => {
  try {
    const follow = await Follow.findByPk(req.params.id);
    if (follow && follow.followedId === req.userId) {
      follow.status = "approved";
      await follow.save();
      res.send(follow);
    } else {
      res
        .status(404)
        .send({ error: "Follow request not found or unauthorized." });
    }
  } catch (error) {
    res.status(500).send({ error: "Failed to accept follow request." });
  }
});

// Reject a Follow Request
app.put("/api/follow/reject/:id", async (req, res) => {
  try {
    const follow = await Follow.findByPk(req.params.id);
    if (follow && follow.followedId === req.userId) {
      follow.status = "declined";
      await follow.save();
      res.send(follow);
    } else {
      res
        .status(404)
        .send({ error: "Follow request not found or unauthorized." });
    }
  } catch (error) {
    res.status(500).send({ error: "Failed to reject follow request." });
  }
});

// Remove a Follower
app.delete("/api/follow/remove/:id", async (req, res) => {
  try {
    const follow = await Follow.findByPk(req.params.id);
    if (follow && follow.followedId === req.userId) {
      await follow.destroy();
      res.send({ success: true });
    } else {
      res.status(404).send({ error: "Follower not found or unauthorized." });
    }
  } catch (error) {
    res.status(500).send({ error: "Failed to remove follower." });
  }
});

// Unfollow a User
app.delete("/api/follow/unfollow", async (req, res) => {
  const { followedId } = req.body;

  try {
    const existingFollow = await Follow.findOne({
      where: {
        followerId: req.userId,
        followedId: followedId,
      },
    });

    if (!existingFollow) {
      return res.status(404).send({ error: "Follow relationship not found." });
    }

    if (existingFollow.followerId === req.userId) {
      await existingFollow.destroy();
      res.send({ success: true });
    } else {
      res.status(403).send({ error: "Unauthorized request to unfollow user." });
    }
  } catch (error) {
    res.status(500).send({ error: "Failed to unfollow user." });
  }
});

// Get All Followers for a User
app.get("/api/user/:id/followers", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    const follow = await Follow.findOne({
      where: {
        followerId: req.userId,
        followedId: req.params.id,
        status: "approved",
      },
    });

    console.log("User:", user);
    console.log("Follow:", follow); // Add this line for debugging

    if (user.profilePublic || follow || req.userId === req.params.id) {
      const followers = await Follow.findAll({
        where: {
          followedId: req.params.id,
          status: "approved",
        },
      });
      res.send(followers);
    } else {
      res
        .status(403)
        .send({ error: "Not authorized to view this user’s followers." });
    }
  } catch (error) {
    res.status(500).send({ error: "Failed to retrieve followers." });
  }
});

// Get All Following for a User
app.get("/api/user/:id/following", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    const follow = await Follow.findOne({
      where: {
        followerId: req.userId,
        followedId: req.params.id,
        status: "approved",
      },
    });

    console.log("User:", user);
    console.log("Follow:", follow); // Add this line for debugging

    if (user.profilePublic || follow || req.userId === req.params.id) {
      const following = await Follow.findAll({
        where: {
          followerId: req.params.id,
          status: "approved",
        },
      });
      res.send(following);
    } else {
      res
        .status(403)
        .send({ error: "Not authorized to view this user’s following." });
    }
  } catch (error) {
    res.status(500).send({ error: "Failed to retrieve following." });
  }
});

// Get Recent Popular Users
app.get("/api/users/popular", async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;

  try {
    const recentPopularUsers = await sequelize.query(
      `SELECT "followedId", COUNT("followedId") AS "followCount"
   FROM "Follows"
   WHERE "status" = 'approved' AND "createdAt" >= NOW() - INTERVAL '30 days'
   GROUP BY "followedId"
   ORDER BY "followCount" DESC
   LIMIT :limit`,
      {
        replacements: { limit },
        type: sequelize.QueryTypes.SELECT,
        logging: console.log, // Log the generated query
      }
    );

    res.send({
      popularUsers: recentPopularUsers,
    });
  } catch (error) {
    console.error("Error retrieving recent popular users:", error.message);
    res.status(500).send({ error: "Failed to retrieve recent popular users." });
  }
});

app.listen(5001, () => {
  console.log("SalamUser service running on port 5001");
});

sequelize.sync({ alter: false }).then(() => {
  console.log("Database & tables created!");
});
