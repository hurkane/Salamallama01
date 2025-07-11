const axios = require("axios");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token is missing" });
  }

  try {
    const response = await axios.post(
      "http://salam-auth:5000/api/auth/verifyToken",
      { token }
    );
    req.userId = response.data.userId;
    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return res.status(401).json({ message: "Token verification failed" });
  }
};

module.exports = verifyToken;
