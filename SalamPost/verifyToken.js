const axios = require("axios");

const verifyToken = async (token) => {
  try {
    const response = await axios.post(
      "http://salam-auth:5000/api/auth/verifyToken",
      { token }
    );
    return response.data.userId;
  } catch (error) {
    throw new Error("Token verification failed");
  }
};

module.exports = verifyToken;
