// auth.js (in your gateway)
const axios = require("axios");

async function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Access token missing" });
  }

  try {
    const { data } = await axios.post(
      "http://salam-auth:5000/api/auth/verifyToken",
      { token }
    );
    req.userId   = data.userId;
    req.username = data.username;
    req.fullname = data.fullname ?? data.name;  
    next();
  } catch (err) {
    console.error("verifyToken error:", err.message);
    return res.status(401).json({ message: "Token verification failed" });
  }
}

module.exports = verifyToken;

