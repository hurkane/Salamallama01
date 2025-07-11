// controllers/authcontrollers.js

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { Op } = require("sequelize");


const { v4: uuidv4 } = require("uuid");

exports.register = async (req, res) => {
  let { username, email, password, name } = req.body;

  username = username.toLowerCase();
  email = email.toLowerCase();

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      username,
      email,
      password: hashedPassword,
      profilePublic: true,
    });

    // Generate verification token and link
    const token = uuidv4();
    const protocol = req.protocol;
    const host = req.get("host"); // Dynamically get host and port
    const verificationLink = `${protocol}://${host}/api/auth/verify-email?token=${token}&id=${newUser.id}`;
    newUser.emailVerificationToken = token;
    await newUser.save();

    // Send verification email
    await sendVerificationEmail(newUser.email, verificationLink);

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      message:
        "Registration successful. Please check your email for verification.",
    });
  } catch (error) {
    console.error("User registration error:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      const field = error.errors[0].path;
      res.status(400).json({
        error: `${
          field.charAt(0).toUpperCase() + field.slice(1)
        } is already in use`,
      });
    } else {
      res
        .status(500)
        .json({ error: "User registration failed. Please try again later." });
    }
  }
};

// Login User (by email or username)
exports.login = async (req, res) => {
  const { emailOrUsername, password } = req.body;

  try {
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: emailOrUsername.toLowerCase() },
          { username: emailOrUsername.toLowerCase() }
        ]
      }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.json({ token, userId: user.id });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};



exports.verifyToken = async (req, res) => {
  const token = req.body.token;
  if (!token) return res.status(403).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      console.error("Token verification failed:", err);
      return res.status(401).json({ message: "Invalid token" });
    }

    // Option A: if you encoded username into the JWT:
    //    const { id: userId, username } = decoded;
    // Option B: fetch from your user DB
    const userId = decoded.id;
    let username = decoded.username;
    let   fullname = decoded.name; 
    if (!username) {
      const user = await User.findByPk(userId);
      username = user?.username || "Unknown";
      fullname = fullname || user?.name || "Unknown";
    }

    // return both id + username
    res.json({ userId, username, fullname });
  });
};



const nodemailer = require("nodemailer");

// Create a transporter object using the SMTP transport
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: "salamandcoshop@gmail.com",
    pass: "ocuf yipf kezj wrps",
  },
});

// Send email function
async function sendVerificationEmail(userEmail, verificationLink) {
  const mailOptions = {
    from: "salamandcoshop@gmail.com",
    to: userEmail,
    subject: "Email Verification",
    text: `Please verify your email by clicking the link: ${verificationLink}`,
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

exports.verifyEmail = async (req, res) => {
  const { token, id } = req.query;

  try {
    const user = await User.findOne({
      where: { id, emailVerificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token." });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    await user.save();

    res.json({ message: "Email successfully verified." });
  } catch (error) {
    console.error("Email verification error:", error);
    res
      .status(500)
      .json({ error: "Email verification failed. Please try again later." });
  }
};

// Send email function
async function sendEmail(userEmail, subject, text) {
  const mailOptions = {
    from: "salamandcoshop@gmail.com",
    to: userEmail,
    subject: subject,
    text: text,
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

// Request password reset
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const token = uuidv4();
    const protocol = req.protocol;
    const host = req.get("host"); // Dynamically get host and port
    const resetLink = `${protocol}://${host}/reset-password?token=${token}&id=${user.id}`;
    user.passwordResetToken = token;
    await user.save();

    await sendEmail(
      user.email,
      "Password Reset",
      `Reset your password using this link: ${resetLink}`
    );

    res.json({ message: "Password reset link has been sent to your email" });
  } catch (error) {
    console.error("Request password reset error:", error);
    res.status(500).json({
      error: "Failed to request password reset. Please try again later.",
    });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  const { token, id, newPassword } = req.body;

  try {
    const user = await User.findOne({
      where: { id, passwordResetToken: token },
    });
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.passwordResetToken = null;
    await user.save();

    res.json({ message: "Password successfully reset" });
  } catch (error) {
    console.error("Reset password error:", error);
    res
      .status(500)
      .json({ error: "Failed to reset password. Please try again later." });
  }
};
