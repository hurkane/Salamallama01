// models/Image.js (Updated with better metadata)
const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  fileId: { type: String, required: true },
  pageNumber: { type: Number, required: true },
  imagePath: { type: String, required: true }, // Store file path instead of binary data
  format: { type: String, default: 'png' },
  width: { type: Number, default: 2000 },
  height: { type: Number, default: 2000 },
  fileSize: { type: Number }, // Store file size for reference
  createdAt: { type: Date, default: Date.now }
});

// Validation middleware
ImageSchema.pre('save', function(next) {
  // If using buffer storage, validate it's a proper buffer
  if (this.storageType === 'buffer' && this.imageData) {
    if (!Buffer.isBuffer(this.imageData)) {
      return next(new Error('imageData must be a Buffer when using buffer storage'));
    }
    if (this.imageData.length === 0) {
      return next(new Error('imageData cannot be empty'));
    }
  }
  // If using GridFS, ensure we have a GridFS file ID
  if (this.storageType === 'gridfs' && !this.gridfsFileId) {
    return next(new Error('gridfsFileId is required when using GridFS storage'));
  }
  // Update fileSize if not set
  if (!this.fileSize && this.imageData) {
    this.fileSize = this.imageData.length;
  }
  next();
});

// Compound index for efficient queries
ImageSchema.index({ bookId: 1, pageNumber: 1 });
ImageSchema.index({ fileId: 1, pageNumber: 1 });

// Safe model export - prevents overwrite error
module.exports = mongoose.models.Image || mongoose.model("Image", ImageSchema);