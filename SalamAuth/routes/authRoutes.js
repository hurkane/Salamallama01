// routes/authRoutes.js

const express = require("express");
const {
  register,
  login,
  verifyToken,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
} = require("../controllers/authController");
const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verifyToken", verifyToken);
router.get("/verify-email", verifyEmail);
router.post("/requestPasswordReset", requestPasswordReset);
router.post("/resetPassword", resetPassword);

module.exports = router;
