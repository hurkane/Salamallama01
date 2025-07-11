// models/Book.js (Updated with new features)
const mongoose = require("mongoose");

const BookSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  author: { type: String, required: true },
  description: String,
  genre: {
    type: String,
    enum: ['Fiction', 'Non-Fiction', 'Mystery', 'Romance', 'Science Fiction', 'Fantasy', 'Art',
           'Biography', 'History', 'Self-Help', 'Business', 'Technology', 'Health', 'Travel', 'Cooking', 'Religion', 'Poetry',
           'Drama', 'Philosophy', 'Education', 'Adventure', 'Horror', 'Thriller', 'Other'],
    default: 'Other'
  },
  summary: { type: String, maxlength: 1000 },
  isPublic: { type: Boolean, default: false },
  userId: { type: String, required: true },
  uploaderUsername: { type: String, required: true },
  uploaderName: { type: String, required: true },
  thumbnail: Buffer, // Store thumbnail as binary data
  totalPages: { type: Number, default: 0 },
  totalWords: { type: Number, default: 0 },
  totalImages: { type: Number, default: 0 },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  confidence: { type: Number, default: 0 },
  extractionMethod: { type: String, enum: ['native',
      'tesseract-latin', 
      'multi-arabic',   
      'paddle-asian'      
    ], default: 'native' },
  embedding: [Number],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// ADD THIS: Validation for thumbnail
BookSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Validate thumbnail if it exists
  if (this.thumbnail && !Buffer.isBuffer(this.thumbnail)) {
    return next(new Error('thumbnail must be a Buffer'));
  }
  
  next();
});

// Index for efficient queries
BookSchema.index({ userId: 1, createdAt: -1 });
BookSchema.index({ isPublic: 1, createdAt: -1 });
BookSchema.index({ genre: 1, isPublic: 1 });

module.exports = mongoose.model("Book", BookSchema);