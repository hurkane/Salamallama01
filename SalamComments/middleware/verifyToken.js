const axios = require("axios");

const verifyToken = async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return res.status(403).send("A token is required for authentication");
  }
  try {
    const response = await axios.post(
      "http://salam-auth:5000/api/auth/verifyToken",
      { token }
    );
    req.userId = response.data.userId;
    next();
  } catch (error) {
    res.status(401).send("Unauthorized");
  }
};

module.exports = verifyToken;
