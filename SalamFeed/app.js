const express = require("express");
const bodyParser = require("body-parser");
const { sequelize, User, Post } = require("./models");
const verifyToken = require("./verifyToken");
const { Op } = require("sequelize");
const SearchHistory = require("./models/searchHistory");
const Interaction = require("./models/interaction");
const Follow = require("./models/Follow");

const app = express();
app.use(bodyParser.json());
const cors = require("cors");
app.use(cors());

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

const stopWords = [
  "this",
  "that",
  "those",
  "these",
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "if",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "he",
  "she",
  "i",
  "we",
  "they",
  "them",
  "him",
  "me",
  "his",
  "her",
  "our",
  "us",
  "their",
  "theirs",
  "who",
  "what",
  "where",
  "which",
  "when",
  "mine",
];

// Function to extract top words, bigrams, and trigrams
const extractTopWordsAndPhrases = (content) => {
  const stopWords = [
    "this",
    "that",
    "those",
    "these",
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "for",
    "if",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
    "he",
    "she",
    "i",
    "we",
    "they",
    "them",
    "him",
    "me",
    "his",
    "her",
    "our",
    "us",
    "their",
    "theirs",
    "who",
    "what",
    "where",
    "which",
    "when",
    "mine",
  ];

  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .split(/\s+/); // Split by whitespace

  const wordFrequency = {};
  const bigramFrequency = {};
  const trigramFrequency = {};

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Single word frequency
    if (!stopWords.includes(word) && word) {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }

    // Bigram frequency
    if (i < words.length - 1) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (!stopWords.includes(words[i]) && !stopWords.includes(words[i + 1])) {
        bigramFrequency[bigram] = (bigramFrequency[bigram] || 0) + 1;
      }
    }

    // Trigram frequency
    if (i < words.length - 2) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (
        !stopWords.includes(words[i]) &&
        !stopWords.includes(words[i + 1]) &&
        !stopWords.includes(words[i + 2])
      ) {
        trigramFrequency[trigram] = (trigramFrequency[trigram] || 0) + 1;
      }
    }
  }

  // Combine and sort by frequency in descending order
  const combinedFrequencies = {
    ...Object.fromEntries(
      Object.entries(wordFrequency).map(([phrase, count]) => [
        phrase,
        { phrase, count },
      ])
    ),
    ...Object.fromEntries(
      Object.entries(bigramFrequency).map(([phrase, count]) => [
        phrase,
        { phrase, count },
      ])
    ),
    ...Object.fromEntries(
      Object.entries(trigramFrequency).map(([phrase, count]) => [
        phrase,
        { phrase, count },
      ])
    ),
  };

  return Object.values(combinedFrequencies)
    .sort((a, b) => b.count - a.count)
    .map((item) => item.phrase);
};

// Get feed based on interaction
app.get("/api/feed/interaction", async (req, res) => {
  try {
    // 1. Get user interactions on post IDs
    const interactions = await Interaction.findAll({
      where: { userId: req.userId, postId: { [Op.not]: null } }, // Get only post interactions
      attributes: ["postId"],
    });

    const postIds = interactions.map((interaction) => interaction.postId);

    // 2. Check each post in posts table and get the top words and sentences
    const posts = await Post.findAll({
      where: { id: { [Op.in]: postIds } },
      attributes: ["id", "content", "createdAt"],
    });

    // 3. Find latest created matching posts and rank them with most relevant to least relevant
    const rankedPosts = posts
      .map((post) => {
        const topWordsAndPhrases = extractTopWordsAndPhrases(post.content);
        return {
          postId: post.id,
          topWordsAndPhrases,
          createdAt: post.createdAt,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // Sort by latest created

    res.send({ postIds: rankedPosts.map((post) => post.postId) });
  } catch (error) {
    console.error(
      "Error generating feed based on interactions:",
      error.message
    );
    res.status(500).send({ error: "Failed to generate feed." });
  }
});

// Get feed based on search history
app.get("/api/feed/search-history", async (req, res) => {
  try {
    // 1. Check user search history and get top keywords
    const searchHistory = await SearchHistory.findAll({
      where: { userId: req.userId },
      attributes: ["keyword"],
      order: [["createdAt", "DESC"]],
      limit: 50, // Limit to the most recent 50 searches for relevance
    });

    const keywords = searchHistory.map((entry) => entry.keyword);

    // 2. Find posts with matching keywords
    const posts = await Post.findAll({
      where: {
        [Op.or]: keywords.map((keyword) => ({
          content: { [Op.iLike]: `%${keyword}%` },
        })),
      },
      attributes: ["id", "content", "createdAt"],
    });

    // Rank posts based on relevance to keywords and recency
    const rankedPosts = posts
      .map((post) => {
        const topWordsAndPhrases = extractTopWordsAndPhrases(post.content);
        return {
          postId: post.id,
          topWordsAndPhrases,
          createdAt: post.createdAt,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // Sort by latest created

    res.send({ postIds: rankedPosts.map((post) => post.postId) });
  } catch (error) {
    console.error(
      "Error generating feed based on search history:",
      error.message
    );
    res.status(500).send({ error: "Failed to generate feed." });
  }
});

// Get feed based on popularity
app.get("/api/feed/popularity", async (req, res) => {
  try {
    // 1. Get popular posts
    const postIds = await getPopularPosts(20); // Adjust the limit as necessary

    // 2. Get the posts with those IDs and include only public users' posts
    const posts = await Post.findAll({
      where: { id: { [Op.in]: postIds } },
      include: [
        {
          model: User,
          as: "User", // Use the alias "User"
          where: { profilePublic: true },
        },
      ],
      attributes: ["id", "content", "createdAt"],
    });

    // Rank posts by their interaction count and recency
    const rankedPosts = posts
      .map((post) => {
        const interaction = post.interactions.find(
          (interaction) => interaction.postId === post.id
        );
        return {
          postId: post.id,
          interactionCount: interaction
            ? interaction.dataValues.interactionCount
            : 0,
          createdAt: post.createdAt,
        };
      })
      .sort(
        (a, b) =>
          b.interactionCount - a.interactionCount ||
          new Date(b.createdAt) - new Date(a.createdAt)
      );

    res.send({ postIds: rankedPosts.map((post) => post.postId) });
  } catch (error) {
    console.error("Error generating feed based on popularity:", error.message);
    res.status(500).send({ error: "Failed to generate feed." });
  }
});

// Get feed from following
app.get("/api/feed/following", async (req, res) => {
  try {
    const follows = await Follow.findAll({
      where: { followerId: req.userId, status: "approved" },
      attributes: ["followedId"],
    });

    const followedIds = follows.map((follow) => follow.followedId);

    if (followedIds.length === 0) {
      return res.send({ postIds: [] });
    }

    const posts = await Post.findAll({
      where: { userId: { [Op.in]: followedIds } },
      attributes: ["id", "content", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    res.send({ postIds: posts.map((post) => post.id) });
  } catch (error) {
    console.error(
      "Error generating feed based on follow status:",
      error.message
    );
    res.status(500).send({ error: "Failed to generate feed." });
  }
});

const calculateScore = (
  post,
  interactions,
  relevancyScore,
  createdAtWeight
) => {
  const interactionCount = interactions[post.id] || 0;
  const recencyScore =
    (new Date().getTime() - new Date(post.createdAt).getTime()) /
    (1000 * 60 * 60 * 24); // Convert to days
  const score =
    interactionCount * 1 +
    relevancyScore * 1.5 -
    recencyScore * createdAtWeight;
  return score;
};

const getPopularPosts = async (limit) => {
  const interactions = await Interaction.findAll({
    attributes: [
      "postId",
      [sequelize.fn("count", sequelize.col("postId")), "interactionCount"],
    ],
    group: ["postId"],
    order: [[sequelize.fn("count", sequelize.col("postId")), "DESC"]],
    limit, // Limit based on the input parameter
  });

  const postIds = interactions.map((interaction) => interaction.postId);

  const posts = await Post.findAll({
    where: { id: { [Op.in]: postIds } },
    attributes: ["id", "content", "createdAt"],
  });

  // Rank posts by their interaction count and recency
  const rankedPosts = posts
    .map((post) => {
      const interaction = interactions.find(
        (interaction) => interaction.postId === post.id
      );
      return {
        postId: post.id,
        interactionCount: interaction.dataValues.interactionCount,
        createdAt: post.createdAt,
      };
    })
    .sort(
      (a, b) =>
        b.interactionCount - a.interactionCount || b.createdAt - a.createdAt
    );

  return rankedPosts.map((post) => post.postId);
};

// Get feed
app.get("/api/feed/all", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    // Fetch interactions and personalized posts
    const interactions = await Interaction.findAll({
      where: { userId: req.userId, postId: { [Op.not]: null } },
      attributes: ["postId"],
    });

    const interactionPostIds = interactions.map(
      (interaction) => interaction.postId
    );
    const interactionCount = {};
    interactionPostIds.forEach((postId) => {
      interactionCount[postId] = (interactionCount[postId] || 0) + 1;
    });

    const searchHistory = await SearchHistory.findAll({
      where: { userId: req.userId },
      attributes: ["keyword"],
      order: [["createdAt", "DESC"]],
      limit: 50,
    });

    const keywords = searchHistory.map((entry) => entry.keyword);

    let personalizedPosts = await Post.findAll({
      where: {
        [Op.or]: [
          { id: { [Op.in]: interactionPostIds } },
          keywords.length > 0
            ? {
                content: {
                  [Op.iLike]: { [Op.any]: keywords.map((k) => `%${k}%`) },
                },
              }
            : undefined,
        ].filter(Boolean),
      },
      attributes: ["id", "content", "createdAt"],
    });

    // Fetch popular posts
    const popularPostIds = await getPopularPosts(limit);
    const popularPosts = await Post.findAll({
      where: { id: { [Op.in]: popularPostIds } },
      include: [
        {
          model: User,
          as: "User", // Use the alias "User"
          where: { profilePublic: true },
        },
      ],
      attributes: ["id", "content", "createdAt"],
    });

    // Fetch public posts from users with public profiles
    const publicPosts = await Post.findAll({
      include: [
        {
          model: User,
          as: "User", // Use the alias "User"
          where: { profilePublic: true },
        },
      ],
      attributes: ["id", "content", "createdAt"],
    });

    // Combine all posts and remove duplicates
    const combinedPosts = [
      ...personalizedPosts,
      ...popularPosts,
      ...publicPosts,
    ];
    const uniquePosts = Array.from(
      new Set(combinedPosts.map((post) => post.id))
    ).map((id) => combinedPosts.find((post) => post.id === id));

    // Rank and sort posts by recency
    const rankedPosts = uniquePosts.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const paginatedPosts = rankedPosts.slice(offset, offset + limit);

    res.send({
      postIds: paginatedPosts.map((post) => post.id),
      totalPages: Math.ceil(rankedPosts.length / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error generating combined feed:", error.message);
    res.status(500).send({ error: "Failed to generate feed." });
  }
});

sequelize.sync({ force: false }).then(() => {
  app.listen(5007, () => {
    console.log("SalamFeed service running on port 5007");
  });
});

module.exports = app;
