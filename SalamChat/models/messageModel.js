const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: { type: String, required: true }, // Store sender as a string
    content: {
      type: String,
      required: function () {
        return !this.media;
      },
    }, // Required if no media
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
    readBy: [{ type: String, required: true }], // Store readBy as strings
    media: { type: String }, // Store media URL as a string
  },
  { timestamps: true }
);

messageSchema.pre("validate", function (next) {
  if (!this.content && !this.media) {
    this.invalidate(
      "content",
      "Path `content` is required if no media is provided."
    );
  }
  next();
});

module.exports = mongoose.model("Message", messageSchema);
