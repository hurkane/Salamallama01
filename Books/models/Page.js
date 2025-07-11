// models/Page.js (Updated with correct extraction method enum)
const mongoose = require("mongoose");

const PageSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  fileId: { type: String, required: true },
  pageNumber: { type: Number, required: true },
  text: { type: String, required: true },
  wordCount: { type: Number, default: 0 },
  
  // Processing metadata
  confidence: { type: Number, default: 0 },
  extractionMethod: { 
    type: String, 
    enum: [
      'native',           // Native PDF text extraction
      'tesseract-latin',  // English/Latin OCR with Tesseract
      'multi-arabic',     // Arabic OCR with multiple approaches
      'paddle-asian'      // Asian OCR with PaddleOCR
    ], 
    default: 'native' 
  },
  
  // AI embeddings for semantic search
  embedding: [Number],
  
  // Image references
  imageRefs: [String],
  
  // Timestamps
  createdAt: { type: Date, default: Date.now }
});

// Calculate word count before saving
PageSchema.pre('save', function(next) {
  if (this.text) {
    this.wordCount = this.text.split(/\s+/).filter(word => word.length > 0).length;
  }
  next();
});

// Compound index for efficient queries
PageSchema.index({ bookId: 1, pageNumber: 1 });
PageSchema.index({ fileId: 1, pageNumber: 1 });

module.exports = mongoose.model("Page", PageSchema);