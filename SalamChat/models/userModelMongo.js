const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // Use String for _id
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String, default: "default_profile_pic.png" },
    bio: { type: String },
    profilePublic: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

const UserMongo = mongoose.model("User", userSchema);
module.exports = UserMongo;
