
// models/Progress.js (Updated with better tracking)
const mongoose = require("mongoose");

const ProgressSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  fileId: { type: String, required: true },
  
  // Reading progress
  score: { type: Number, default: 0, min: 0, max: 100 },
  lastReadPage: { type: Number, default: 1 },
  totalReadPages: { type: Number, default: 0 },
  
  // Reading segments for detailed tracking
  segments: [{
    page: { type: Number, required: true },
    from: { type: Number, required: true },
    to: { type: Number, required: true },
    readAt: { type: Date, default: Date.now }
  }],
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field on save
ProgressSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for efficient queries
ProgressSchema.index({ userId: 1, bookId: 1 });
ProgressSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model("Progress", ProgressSchema);