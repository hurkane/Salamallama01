// server.js
const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const cors = require("cors");
const mongoose = require("mongoose");
const { fromPath } = require("pdf2pic");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const Tesseract = require("tesseract.js");
const spellchecker = require("spellchecker");
const Progress = require("./models/Progress");
const Book = require("./models/Book");
const Page = require("./models/Page");
const Image = require("./models/Image");
const verifyToken  = require("./auth");
const axios = require('axios');
const { spawn } = require('child_process');
const sharp = require('sharp');



const LLM_BASE =
  process.env.LLM_ENDPOINT     // override via env if you like
  || 'http://localhost:3300/api';

// Connect to MongoDB. Replace the URI with your connection string.
const MONGODB_URI = process.env.BOOKSMONGODB_URI || "mongodb://localhost:27017/booksdb";
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  //bufferMaxEntries: 0,
  // Important for large binary data
  //maxBsonObjectSize: 16777216 // 16MB
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.on("connected", () => {
  console.log("Connected to MongoDB");
});



const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use((error, req, res, next) => {
  if (error.message.includes('Buffer') || error.message.includes('imageData')) {
    console.error('Buffer validation error:', error);
    return res.status(400).json({ 
      error: 'Invalid image data format', 
      details: error.message 
    });
  }
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ 
      error: 'File too large', 
      details: 'Maximum file size exceeded' 
    });
  }
  
  next(error);
});
// Add these API endpoints to your existing server.js

const { PythonShell } = require('python-shell');


// Use in-memory storage for file uploads.
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});



// Helper function to create image storage directory
function createImageStorageDir(bookId) {
  const imagesDir = path.join(__dirname, 'storage', 'images', bookId);
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  return imagesDir;
}

// Helper function to save image to disk
async function saveImageToDisk(imageBuffer, bookId, pageNumber, format = 'png') {
  const imagesDir = createImageStorageDir(bookId);
  const filename = `page_${pageNumber}.${format}`;
  const imagePath = path.join(imagesDir, filename);
  
  await fs.promises.writeFile(imagePath, imageBuffer);
  
  return {
    imagePath: imagePath,
    relativePath: path.join('storage', 'images', bookId, filename),
    fileSize: imageBuffer.length
  };
}


// Helper function to save PDF to temporary file
function savePdfToTemp(buffer) {
  const tempPath = path.join(__dirname, 'temp', `${uuidv4()}.pdf`);
  if (!fs.existsSync(path.dirname(tempPath))) {
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });
  }
  fs.writeFileSync(tempPath, buffer);
  return tempPath;
}
// FIXED: Centralized book creation function with proper validation
async function createBook(userId, title, author, description, filename, fullname, username, totalPages, extractionMethod, isPublic = false, genre, summary) {
  try {
    // Validate required fields
    if (!userId || !filename || !totalPages || !extractionMethod) {
      throw new Error('Missing required fields for book creation');
    }

    const book = new Book({
      userId: userId.toString(), // Ensure it's a string
      filename: filename,
      title: title,
      author: author || 'Unknown Author',
      description: description || '', // Make sure description is included
      uploaderName: fullname || username || 'Unknown',
      uploaderUsername: username || 'unknown',
      fileId: `${filename}_${Date.now()}`, // More unique fileId
      uploadDate: new Date(),
      totalPages: parseInt(totalPages), // Ensure it's a number
      processingStatus: 'processing',
      extractionMethod: extractionMethod,
      isPublic: isPublic,
      genre: genre || 'Other',
      summary: summary || '',
      confidence: 0, // Initialize confidence
      //createdAt: new Date()
    });

    const savedBook = await book.save();
    console.log(`Book created successfully: ${savedBook._id}`);
    return savedBook;
  } catch (error) {
    console.error('Error creating book:', error);
    throw error;
  }
}


// Helper function to extract native text from PDF
async function extractNativeText(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    
    // Split text by pages (this is approximate since pdf-parse doesn't provide page breaks)
    const pages = [];
    const textLines = data.text.split('\n');
    const linesPerPage = Math.ceil(textLines.length / data.numpages) || 1;
    
    for (let i = 0; i < data.numpages; i++) {
      const startLine = i * linesPerPage;
      const endLine = Math.min((i + 1) * linesPerPage, textLines.length);
      const pageText = textLines.slice(startLine, endLine).join('\n');
      
      pages.push({
        pageNumber: i + 1,
        text: pageText.trim()
      });
    }
    
    return {
      fullText: data.text,
      totalPages: data.numpages,
      pages: pages,
      confidence: 1.0 // Native text extraction is 100% accurate
    };
  } catch (error) {
    console.error('Error extracting native text:', error);
    throw error;
  }
}

// Helper function to clean OCR text
function cleanOcrText(text) {
  if (!text) return '';
  
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove weird characters that OCR sometimes produces
    .replace(/[^\w\s\.\,\!\?\;\:\-\(\)\[\]\{\}\"\']/g, '')
    // Fix common OCR mistakes
    .replace(/\bl\b/g, 'I') // lowercase l often mistaken for I
    .replace(/\b0\b/g, 'O') // zero often mistaken for O
    // Remove excessive line breaks
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

// Helper function to compute text embedding (simple implementation)
function computeTextEmbedding(text) {
  // This is a very simple embedding - in production you'd want to use
  // a proper embedding model like sentence-transformers
  if (!text || text.trim().length === 0) {
    return new Array(100).fill(0); // Return zero vector for empty text
  }
  
  // Simple word frequency based embedding
  const words = text.toLowerCase().split(/\s+/);
  const wordFreq = {};
  
  words.forEach(word => {
    const cleanWord = word.replace(/[^\w]/g, '');
    if (cleanWord.length > 2) { // Skip very short words
      wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
    }
  });
  
  // Create a simple hash-based embedding
  const embedding = new Array(100).fill(0);
  
  Object.keys(wordFreq).forEach(word => {
    const hash = simpleHash(word) % 100;
    embedding[hash] += wordFreq[word];
  });
  
  // Normalize the embedding
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    return embedding.map(val => val / magnitude);
  }
  
  return embedding;
}

// Simple hash function for embedding
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}



// Helper function to convert PDF to images
async function convertPdfToImages(pdfPath, outputDir) {
  const convert = fromPath(pdfPath, {
    density: 300,
    saveFilename: "page",
    savePath: outputDir,
    format: "png",
    width: 2000,
    height: 2000
  });
  
  const pages = await convert.bulk(-1);
  return pages;
}

// Helper function to clean up temporary files
function cleanupTempFiles(filePaths) {
  filePaths.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Failed to delete temp file ${filePath}:`, err);
      }
    }
  });
}


// OCR using PaddleOCR (for Asian languages) - UPDATED VERSION
async function paddleOCR(imagePath, languages = ['en', 'ch']) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== PaddleOCR Debug ===`);
    console.log(`Image path: ${imagePath}`);
    console.log(`Languages: ${languages.join(',')}`);
    console.log(`Image exists: ${fs.existsSync(imagePath)}`);
    
    const options = {
      pythonOptions: ['-u'],
      scriptPath: './python-scripts/',
      args: [imagePath, languages.join(',')]
    };
    
    console.log(`Running: python paddle_ocr.py ${options.args.join(' ')}`);
    
    PythonShell.run('paddle_ocr.py', options, (err, results) => {
      console.log(`Python script finished`);
      console.log(`Error: ${err}`);
      console.log(`Results: ${JSON.stringify(results)}`);
      
      if (err) {
        console.error('PaddleOCR error:', err);
        reject(err);
      } else {
        const output = results ? results.join('\n') : '';
        console.log(`Final output length: ${output.length}`);
        resolve(output);
      }
    });
  });
}



// Helper function to clean Asian OCR results and remove debug info
function cleanAsianOcrResult(rawResult) {
  try {
    // If it's a JSON string, parse it
    if (typeof rawResult === 'string' && rawResult.startsWith('{')) {
      const parsed = JSON.parse(rawResult);
      if (parsed.text && Array.isArray(parsed.text)) {
        // Join all text results and remove duplicates
        const uniqueTexts = [...new Set(parsed.text.filter(t => t && t.trim()))];
        return uniqueTexts.join('\n');
      }
    }
    
    // If it's already clean text, return as is
    return typeof rawResult === 'string' ? rawResult.trim() : '';
  } catch (error) {
    console.error('Error cleaning Asian OCR result:', error);
    return rawResult ? rawResult.toString().trim() : '';
  }
}








// Try PaddleOCR for Arabic (since it works well for your Chinese)
async function paddleOCRArabic(imagePath) {
  return new Promise((resolve, reject) => {
    // Use PaddleOCR with Arabic language support
    const pythonScript = `
import sys
from paddleocr import PaddleOCR
import json

try:
    # Initialize PaddleOCR with Arabic support
    ocr = PaddleOCR(use_angle_cls=True, lang='arabic', show_log=False)
    
    # Process the image
    result = ocr.ocr('${imagePath}', cls=True)
    
    # Extract text from results
    text_lines = []
    if result and result[0]:
        for line in result[0]:
            if len(line) > 1 and line[1][0]:
                text_lines.append(line[1][0])
    
    # Join lines with proper Arabic text direction
    full_text = '\\n'.join(text_lines)
    
    print(json.dumps({
        'success': True,
        'text': full_text,
        'confidence': 0.85
    }))
    
except Exception as e:
    print(json.dumps({
        'success': False,
        'error': str(e),
        'text': '',
        'confidence': 0
    }))
`;

    const python = spawn('python3', ['-c', pythonScript]);
    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output.trim());
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse OCR output: ${parseError.message}`));
        }
      } else {
        reject(new Error(`Python script failed: ${errorOutput}`));
      }
    });

    python.on('error', (error) => {
      reject(error);
    });
  });
}

// Fallback to Tesseract for Arabic
async function tesseractArabic(imagePath) {
  try {
    const { data: { text, confidence } } = await Tesseract.recognize(
      imagePath,
      'ara+eng',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`Tesseract Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
        preserve_interword_spaces: '1'
      }
    );
    
    return {
      success: true,
      text: text.trim(),
      confidence: confidence / 100
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      confidence: 0,
      error: error.message
    };
  }
}

// Enhanced EasyOCR with better Arabic handling
async function easyOCRArabic(imagePath) {
  try {
    // Your existing easyOCR function but with better text processing
    const rawText = await easyOCR(imagePath, ['ar', 'en']);
    
    // Better Arabic text processing
    const processedText = rawText
      .replace(/[\u202A-\u202E]/g, '') // Remove direction markers
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    return {
      success: true,
      text: processedText,
      confidence: 0.75 // EasyOCR confidence
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      confidence: 0,
      error: error.message
    };
  }
}

// Main OCR function that tries multiple approaches
async function performArabicOCR(imagePath) {
  console.log(`Starting OCR for: ${imagePath}`);
  
  // Try PaddleOCR first (since it works well for your Chinese)
  try {
    console.log('Trying PaddleOCR for Arabic...');
    const paddleResult = await paddleOCRArabic(imagePath);
    if (paddleResult.success && paddleResult.text.trim().length > 0) {
      console.log('PaddleOCR succeeded');
      return paddleResult;
    }
    console.log('PaddleOCR failed or returned empty text');
  } catch (error) {
    console.log('PaddleOCR error:', error.message);
  }
  
  // Fallback to Tesseract
  try {
    console.log('Trying Tesseract for Arabic...');
    const tesseractResult = await tesseractArabic(imagePath);
    if (tesseractResult.success && tesseractResult.text.trim().length > 0) {
      console.log('Tesseract succeeded');
      return tesseractResult;
    }
    console.log('Tesseract failed or returned empty text');
  } catch (error) {
    console.log('Tesseract error:', error.message);
  }
  
  // Final fallback to EasyOCR
  try {
    console.log('Trying EasyOCR for Arabic...');
    const easyResult = await easyOCRArabic(imagePath);
    if (easyResult.success) {
      console.log('EasyOCR succeeded');
      return easyResult;
    }
    console.log('EasyOCR failed');
  } catch (error) {
    console.log('EasyOCR error:', error.message);
  }
  
  return {
    success: false,
    text: '',
    confidence: 0,
    error: 'All OCR methods failed'
  };
}

// 1. FIXED Upload PDF endpoint - consistent field mapping with DISK IMAGE STORAGE
app.post('/api/upload-pdf-native', verifyToken, upload.single('pdf'), async (req, res) => {
  let tempFiles = [];
  let tempImageDir = null;
  let book = null;
  
  try {
    console.log('Starting native PDF upload process...');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Validate user authentication
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`Processing PDF: ${req.file.originalname} for user: ${req.userId}`);

    const tempPdfPath = savePdfToTemp(req.file.buffer);
    tempFiles.push(tempPdfPath);

    // Extract native text first to get page count
    const nativeResult = await extractNativeText(tempPdfPath);
    console.log(`Extracted ${nativeResult.totalPages} pages from PDF`);
    
    // Get isPublic from request body (default to false if not provided)
    const isPublic = req.body.isPublic === 'true' || req.body.isPublic === true;
    const genre = req.body.genre || 'Other';
    const summary = req.body.summary || '';
    console.log(`Book will be ${isPublic ? 'public' : 'private'}, genre: ${genre}`);

    // Create book in database FIRST with proper error handling
    book = await createBook(
      req.userId,                    // userId
      req.body.bookName || req.file.originalname, // title
      req.body.author || req.fullname,           // author
      req.body.description || `Extracted from ${req.file.originalname}`, // description
      req.file.originalname,         // filename
      req.fullname,                  // fullname
      req.username,                  // username
      nativeResult.totalPages,       // totalPages
      'native',                      // extractionMethod
      isPublic,                      // isPublic
      genre,                         // genre
      summary                        // summary
    );
    const bookId = book._id.toString();
    console.log(`Created book with ID: ${bookId}, isPublic: ${book.isPublic}, genre: ${book.genre}`);
    
    // Convert PDF to images using the generated bookId
    tempImageDir = path.join(__dirname, 'temp', bookId);
    if (!fs.existsSync(tempImageDir)) {
      fs.mkdirSync(tempImageDir, { recursive: true });
    }
    
    const imagePages = await convertPdfToImages(tempPdfPath, tempImageDir);
    console.log(`Converted ${imagePages.length} pages to images`);

    // Create image storage directory for this book
    const imagesDir = createImageStorageDir(bookId);
    console.log(`Created image storage directory: ${imagesDir}`);

    // Generate and save thumbnail from first page (store in MongoDB)
    let thumbnailBuffer = null;
    if (imagePages.length > 0) {
      try {
        const sharp = require('sharp');
        thumbnailBuffer = await sharp(imagePages[0].path)
          .resize(200, 300, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
        
        // Save thumbnail to book in MongoDB
        book.thumbnail = thumbnailBuffer;
        console.log('Generated thumbnail from first page');
      } catch (thumbError) {
        console.error('Error generating thumbnail:', thumbError);
      }
    }

    // Save pages and images to database with better error handling
    const savedPages = [];
    const savedImages = [];
    let totalConfidence = 0;

    for (let i = 0; i < nativeResult.pages.length; i++) {
      try {
        const pageData = nativeResult.pages[i];
        
        // Save page text
        const page = new Page({
          bookId: bookId,
          fileId: book.fileId,
          pageNumber: pageData.pageNumber,
          text: pageData.text,
          confidence: nativeResult.confidence,
          extractionMethod: 'native',
          embedding: computeTextEmbedding(pageData.text)
        });
        
        const savedPage = await page.save();
        savedPages.push(savedPage);
        totalConfidence += nativeResult.confidence;
        
        console.log(`Saved page ${pageData.pageNumber} with ${pageData.text.length} characters`);

        // Save corresponding image to DISK (not MongoDB)
        if (imagePages[i]) {
          const imageBuffer = fs.readFileSync(imagePages[i].path);
          const savedImage = await saveImageToDisk(imageBuffer, bookId, pageData.pageNumber, 'png');
          
          // Store image metadata in MongoDB (with disk path)
          const image = new Image({
            bookId: bookId,
            fileId: book.fileId, 
            pageNumber: pageData.pageNumber,
            imagePath: savedImage.relativePath, // Path to disk file
            format: 'png',
            width: imagePages[i].width || 2000,
            height: imagePages[i].height || 2000,
            fileSize: savedImage.fileSize
            // Note: NO imageData field - image is stored on disk
          });
          
          const savedImageDoc = await image.save();
          savedImages.push({
            pageNumber: pageData.pageNumber,
            imageId: savedImageDoc._id
          });
          tempFiles.push(imagePages[i].path);
          
          console.log(`Saved image for page ${pageData.pageNumber} to disk: ${savedImage.relativePath}`);
        }
      } catch (pageError) {
        console.error(`Error saving page ${i + 1}:`, pageError);
        // Continue processing other pages
      }
    }

    // Update book status to completed with average confidence
    const avgConfidence = savedPages.length > 0 ? totalConfidence / savedPages.length : 0;
    book.processingStatus = 'completed';
    book.confidence = avgConfidence;
    // Update counts
    book.totalPages = savedPages.length;
    book.totalImages = savedImages.length;
    book.totalWords = savedPages.reduce((sum, page) => sum + (page.text?.split(' ').length || 0), 0);
    await book.save();
    
    console.log(`Book processing completed. Saved ${savedPages.length} pages and ${savedImages.length} images`);

    res.json({
      success: true,
      bookId: bookId,
      bookName: book.title,
      author: book.author,
      description: book.description,
      genre: book.genre,
      summary: book.summary,
      totalPages: book.totalPages,
      extractionMethod: 'native',
      confidence: avgConfidence,
      pages: savedPages.length,
      images: savedImages.length,
      preview: nativeResult.fullText.substring(0, 500),
      hasThumbnail: !!thumbnailBuffer,
      createdAt: book.createdAt.toLocaleString(),
      uploaderName: book.uploaderName,
      uploaderUsername: book.uploaderUsername,
      isPublic: book.isPublic,
      storageInfo: {
        thumbnailStorage: 'mongodb',
        imageStorage: 'disk',
        imageDirectory: imagesDir
      }
    });

  } catch (error) {
    console.error('Native extraction error:', error);
    
    // Update book status to failed if book was created
    if (book) {
      try {
        book.processingStatus = 'failed';
        await book.save();
      } catch (updateError) {
        console.error('Error updating book status to failed:', updateError);
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to extract native text', 
      details: error.message 
    });
  } finally {
    // Clean up temp files
    cleanupTempFiles(tempFiles);
    if (tempImageDir && fs.existsSync(tempImageDir)) {
      try {
        fs.rmSync(tempImageDir, { recursive: true });
      } catch (err) {
        console.error('Failed to cleanup temp directory:', err);
      }
    }
  }
});

// 3. FIXED Arabic OCR endpoint with DISK IMAGE STORAGE
app.post('/api/ocr-arabic', verifyToken, upload.single('pdf'), async (req, res) => {
  let tempFiles = [];
  let tempImageDir = null;
  let progress = null;
  let book = null;
  
  try {
    console.log('Starting Arabic OCR process...');
    console.log('Request body:', req.body); // Debug log
    
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const tempPdfPath = savePdfToTemp(req.file.buffer);
    tempFiles.push(tempPdfPath);

    // Convert PDF to images first to get page count
    const tempDir = path.join(__dirname, 'temp', uuidv4());
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    tempImageDir = tempDir;

    console.log('Converting PDF to images...');
    const imagePages = await convertPdfToImages(tempPdfPath, tempImageDir);
    console.log(`PDF converted to ${imagePages.length} images`);
    
    // Get all form fields with proper defaults
    const isPublic = req.body.isPublic === 'true' || req.body.isPublic === true;
    const genre = req.body.genre || 'Other';
    const summary = req.body.summary || '';
    
    console.log(`Book will be ${isPublic ? 'public' : 'private'}, genre: ${genre}`);
    
    // Create book in database with ALL parameters
    book = await createBook(
      req.userId,
      req.body.bookName || req.file.originalname,
      req.body.author || req.fullname,
      req.body.description || `Extracted from ${req.file.originalname}`, 
      req.file.originalname,
      req.fullname,
      req.username,
      imagePages.length,
      'multi-arabic',
      isPublic,
      genre,
      summary
    );
    const bookId = book._id.toString();
    console.log(`Created book with ID: ${bookId}, isPublic: ${book.isPublic}, genre: ${book.genre}`);

    // Create image storage directory for this book
    const imagesDir = createImageStorageDir(bookId);
    console.log(`Created image storage directory: ${imagesDir}`);

    // Generate and save thumbnail from first page (store in MongoDB)
    if (imagePages.length > 0) {
      try {
        const thumbnailBuffer = await sharp(imagePages[0].path)
          .resize(200, 300, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
        
        book.thumbnail = thumbnailBuffer; // Store in MongoDB
        await book.save();
        console.log('Generated and saved thumbnail to MongoDB');
      } catch (thumbError) {
        console.error('Error generating thumbnail:', thumbError);
      }
    }

    // Create progress tracker
    progress = new Progress({
      bookId: bookId,
      fileId: book.fileId,
      userId: req.userId,
      totalPages: imagePages.length,
      currentPage: 0,
      status: 'processing',
      extractionMethod: 'multi-arabic'
    });
    await progress.save();

    // Process each page with multiple OCR approaches
    const extractedPages = [];
    let allText = '';

    console.log(`Starting to process ${imagePages.length} pages...`);
    
    for (let i = 0; i < imagePages.length; i++) {
      console.log(`\n=== Processing page ${i + 1}/${imagePages.length} ===`);
      
      try {
        // Update progress
        progress.currentPage = i + 1;
        await progress.save();

        // Check if image file exists
        if (!fs.existsSync(imagePages[i].path)) {
          throw new Error(`Image file not found: ${imagePages[i].path}`);
        }

        // OCR with multiple approaches
        const ocrResult = await performArabicOCR(imagePages[i].path);
        
        if (ocrResult.success && ocrResult.text.trim().length > 0) {
          console.log(`Page ${i + 1} OCR successful. Text length: ${ocrResult.text.length}`);
          allText += ocrResult.text + '\n\n';
          
          extractedPages.push({
            pageNumber: i + 1,
            text: ocrResult.text,
            confidence: ocrResult.confidence,
            source: 'multi-arabic'
          });

          // Save page to database
          const page = new Page({
            fileId: book.fileId,
            bookId: bookId,
            pageNumber: i + 1,
            text: ocrResult.text,
            confidence: ocrResult.confidence,
            extractionMethod: 'multi-arabic',
            embedding: computeTextEmbedding(ocrResult.text)
          });
          await page.save();
        } else {
          console.log(`Page ${i + 1} OCR failed:`, ocrResult.error);
          extractedPages.push({
            pageNumber: i + 1,
            text: '',
            confidence: 0,
            source: 'multi-arabic',
            error: ocrResult.error || 'OCR failed'
          });
        }

        // Save page image to DISK (not MongoDB)
        const imageBuffer = fs.readFileSync(imagePages[i].path);
        const savedImage = await saveImageToDisk(imageBuffer, bookId, i + 1, 'png');
        
        // Store image metadata in MongoDB (with disk path)
        const image = new Image({
          bookId: bookId,
          fileId: book.fileId,
          pageNumber: i + 1,
          imagePath: savedImage.relativePath, // Path to disk file
          format: 'png',
          width: imagePages[i].width || 2000,
          height: imagePages[i].height || 2000,
          fileSize: savedImage.fileSize
          // Note: NO imageData field - image is stored on disk
        });
        await image.save();

        console.log(`Saved page ${i + 1} image to disk: ${savedImage.relativePath}`);
        tempFiles.push(imagePages[i].path);
        
        console.log(`Page ${i + 1} processing completed`);
      } catch (pageError) {
        console.error(`Error processing page ${i + 1}:`, pageError);
        extractedPages.push({
          pageNumber: i + 1,
          text: '',
          confidence: 0,
          source: 'multi-arabic',
          error: pageError.message
        });
      }
    }

    console.log(`\nCompleted processing all ${imagePages.length} pages`);
    console.log(`Total text length: ${allText.length}`);

    // Update progress and book status to completed
    progress.status = 'completed';
    progress.currentPage = imagePages.length;
    await progress.save();

    book.processingStatus = 'completed';
    await book.save();

    res.json({
      success: true,
      bookId: bookId,
      bookName: book.title,
      author: book.author,
      description: book.description,
      genre: book.genre,
      summary: book.summary,
      totalPages: imagePages.length,
      extractionMethod: 'multi-arabic',
      preview: allText.substring(0, 500),
      hasThumbnail: !!book.thumbnail,
      isPublic: book.isPublic,
      storageInfo: {
        thumbnailStorage: 'mongodb',
        imageStorage: 'disk',
        imageDirectory: imagesDir
      },
      debug: {
        processedPages: extractedPages.length,
        totalTextLength: allText.length
      }
    });

  } catch (error) {
    console.error('Arabic OCR error:', error);
    if (progress) {
      progress.status = 'failed';
      await progress.save();
    }
    if (book) {
      book.processingStatus = 'failed';
      await book.save();
    }
    res.status(500).json({ error: 'Failed to perform Arabic OCR', details: error.message });
  } finally {
    // Clean up temp files
    cleanupTempFiles(tempFiles);
    if (tempImageDir && fs.existsSync(tempImageDir)) {
      try {
        fs.rmSync(tempImageDir, { recursive: true });
      } catch (err) {
        console.error('Failed to cleanup temp directory:', err);
      }
    }
  }
});

// 4. FIXED English/Latin OCR endpoint with DISK IMAGE STORAGE
app.post('/api/ocr-english-latin', verifyToken, upload.single('pdf'), async (req, res) => {
  let tempFiles = [];
  let tempImageDir = null;
  let progress = null;
  let book = null;
  
  try {
    console.log('Starting English/Latin OCR process...');
    console.log('Request body:', req.body); // Debug log
    
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const tempPdfPath = savePdfToTemp(req.file.buffer);
    tempFiles.push(tempPdfPath);

    // Convert PDF to images first to get page count
    const tempDir = path.join(__dirname, 'temp', uuidv4());
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    tempImageDir = tempDir;

    const imagePages = await convertPdfToImages(tempPdfPath, tempImageDir);
    
    // Get all form fields with proper defaults
    const isPublic = req.body.isPublic === 'true' || req.body.isPublic === true;
    const genre = req.body.genre || 'Other';
    const summary = req.body.summary || '';
    
    console.log(`Book will be ${isPublic ? 'public' : 'private'}, genre: ${genre}`);
    
    // Create book in database with ALL parameters
    book = await createBook(
      req.userId,
      req.body.bookName || req.file.originalname,
      req.body.author || req.fullname,
      req.body.description || `OCR extracted from ${req.file.originalname}`, 
      req.file.originalname,
      req.fullname,
      req.username,
      imagePages.length,
      'tesseract-latin',
      isPublic,
      genre,
      summary
    );
    const bookId = book._id.toString();
    console.log(`Created book with ID: ${bookId}, isPublic: ${book.isPublic}, genre: ${book.genre}`);

    // Create image storage directory for this book
    const imagesDir = createImageStorageDir(bookId);
    console.log(`Created image storage directory: ${imagesDir}`);

    // Generate and save thumbnail from first page (store in MongoDB)
    if (imagePages.length > 0) {
      try {
        const sharp = require('sharp');
        const thumbnailBuffer = await sharp(imagePages[0].path)
          .resize(200, 300, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
        
        book.thumbnail = thumbnailBuffer; // Store in MongoDB
        await book.save();
        console.log('Generated and saved thumbnail to MongoDB');
      } catch (thumbError) {
        console.error('Error generating thumbnail:', thumbError);
      }
    }

    // Create progress tracker
    progress = new Progress({
      bookId: bookId,
      fileId: book.fileId,
      userId: req.userId,
      totalPages: imagePages.length,
      currentPage: 0,
      status: 'processing',
      extractionMethod: 'tesseract-latin'
    });
    await progress.save();

    // Process each page with Tesseract
    const extractedPages = [];
    let allText = '';

    for (let i = 0; i < imagePages.length; i++) {
      try {
        // Update progress
        progress.currentPage = i + 1;
        await progress.save();

        // OCR with Tesseract for English/Latin languages
        const { data: { text, confidence } } = await Tesseract.recognize(
          imagePages[i].path,
          'eng+fra+deu+spa+ita+por', // English, French, German, Spanish, Italian, Portuguese
          {
            logger: m => console.log(`Page ${i + 1}: ${m.status} - ${m.progress}`)
          }
        );

        const cleanedText = cleanOcrText(text);
        allText += cleanedText + '\n\n';

        extractedPages.push({
          pageNumber: i + 1,
          text: cleanedText,
          confidence: confidence,
          source: 'tesseract-latin'
        });

        // Save page to database
        const page = new Page({
          bookId: bookId,
          fileId: book.fileId,
          pageNumber: i + 1,
          text: cleanedText,
          confidence: confidence,
          extractionMethod: 'tesseract-latin',
          embedding: computeTextEmbedding(cleanedText)
        });
        await page.save();

        // Save page image to DISK (not MongoDB)
        const imageBuffer = fs.readFileSync(imagePages[i].path);
        const savedImage = await saveImageToDisk(imageBuffer, bookId, i + 1, 'png');
        
        // Store image metadata in MongoDB (with disk path)
        const image = new Image({
          bookId: bookId,
          fileId: book.fileId,
          pageNumber: i + 1,
          imagePath: savedImage.relativePath, // Path to disk file
          format: 'png',
          width: imagePages[i].width || 2000,
          height: imagePages[i].height || 2000,
          fileSize: savedImage.fileSize
          // Note: NO imageData field - image is stored on disk
        });
        await image.save();

        console.log(`Saved page ${i + 1} image to disk: ${savedImage.relativePath}`);
        tempFiles.push(imagePages[i].path);
        
      } catch (pageError) {
        console.error(`Error processing page ${i + 1}:`, pageError);
        extractedPages.push({
          pageNumber: i + 1,
          text: '',
          confidence: 0,
          source: 'tesseract-latin',
          error: pageError.message
        });
      }
    }

    // Update progress and book status to completed
    progress.status = 'completed';
    progress.currentPage = imagePages.length;
    await progress.save();

    book.processingStatus = 'completed';
    await book.save();

    res.json({
      success: true,
      bookId: bookId,
      bookName: book.title,
      author: book.author,
      description: book.description,
      genre: book.genre,
      summary: book.summary,
      totalPages: imagePages.length,
      extractionMethod: 'tesseract-latin',
      avgConfidence: extractedPages.reduce((sum, p) => sum + p.confidence, 0) / extractedPages.length,
      preview: allText.substring(0, 500),
      hasThumbnail: !!book.thumbnail,
      isPublic: book.isPublic,
      storageInfo: {
        thumbnailStorage: 'mongodb',
        imageStorage: 'disk',
        imageDirectory: imagesDir
      }
    });

  } catch (error) {
    console.error('English/Latin OCR error:', error);
    if (progress) {
      progress.status = 'failed';
      await progress.save();
    }
    if (book) {
      book.processingStatus = 'failed';
      await book.save();
    }
    res.status(500).json({ error: 'Failed to perform English/Latin OCR', details: error.message });
  } finally {
    // Clean up temp files
    cleanupTempFiles(tempFiles);
    if (tempImageDir && fs.existsSync(tempImageDir)) {
      try {
        fs.rmSync(tempImageDir, { recursive: true });
      } catch (err) {
        console.error('Failed to cleanup temp directory:', err);
      }
    }
  }
});

// Updated Asian OCR endpoint - thumbnails in MongoDB, page images on disk
app.post('/api/ocr-asian', verifyToken, upload.single('pdf'), async (req, res) => {
  let tempFiles = [];
  let tempImageDir = null;
  let progress = null;
  let book = null;
  
  try {
    console.log('Starting Asian OCR process...');
    console.log('Request body:', req.body);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { languages } = req.body;
    const targetLanguages = languages ? languages.split(',') : ['chi_sim', 'jpn', 'kor'];

    const tempPdfPath = savePdfToTemp(req.file.buffer);
    tempFiles.push(tempPdfPath);

    // Convert PDF to images first to get page count
    const tempDir = path.join(__dirname, 'temp', uuidv4());
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    tempImageDir = tempDir;

    const imagePages = await convertPdfToImages(tempPdfPath, tempImageDir);
    
    // Get all form fields with proper defaults
    const isPublic = req.body.isPublic === 'true' || req.body.isPublic === true;
    const genre = req.body.genre || 'Other';
    const summary = req.body.summary || '';
    
    console.log(`Book will be ${isPublic ? 'public' : 'private'}, genre: ${genre}`);
    
    // Create book in database with ALL parameters
    book = await createBook(
      req.userId,
      req.body.bookName || req.file.originalname,
      req.body.author || req.fullname,
      req.body.description || `Extracted from ${req.file.originalname}`, 
      req.file.originalname,
      req.fullname,
      req.username,
      imagePages.length,
      'paddle-asian',
      isPublic,
      genre,
      summary
    );
    const bookId = book._id.toString();
    console.log(`Created book with ID: ${bookId}, isPublic: ${book.isPublic}, genre: ${book.genre}`);

    // Generate and save thumbnail from first page (store in MongoDB)
    if (imagePages.length > 0) {
      try {
        const sharp = require('sharp');
        const thumbnailBuffer = await sharp(imagePages[0].path)
          .resize(200, 300, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
        
        book.thumbnail = thumbnailBuffer; // Store in MongoDB
        await book.save();
        console.log('Generated and saved thumbnail to MongoDB');
      } catch (thumbError) {
        console.error('Error generating thumbnail:', thumbError);
      }
    }

    // Create image storage directory for this book
    const imagesDir = createImageStorageDir(bookId);
    console.log(`Created image storage directory: ${imagesDir}`);

    // Create progress tracker
    progress = new Progress({
      bookId: bookId,
      fileId: book.fileId,
      userId: req.userId,
      totalPages: imagePages.length,
      currentPage: 0,
      status: 'processing',
      extractionMethod: 'paddle-asian'
    });
    await progress.save();

    // Process each page with PaddleOCR
    const extractedPages = [];
    let allText = '';

    for (let i = 0; i < imagePages.length; i++) {
      try {
        // Update progress
        progress.currentPage = i + 1;
        await progress.save();

        // OCR with PaddleOCR for Asian languages
        const rawText = await paddleOCR(imagePages[i].path, targetLanguages);
        const cleanedText = cleanAsianOcrResult(rawText);
        allText += cleanedText + '\n\n';

        extractedPages.push({
          pageNumber: i + 1,
          text: cleanedText,
          confidence: 0.8,
          source: 'paddle-asian'
        });

        // Save page to database
        const page = new Page({
          fileId: book.fileId,
          bookId: bookId,
          pageNumber: i + 1,
          text: cleanedText,
          confidence: 0.8,
          extractionMethod: 'paddle-asian',
          embedding: computeTextEmbedding(cleanedText)
        });
        await page.save();

        // Save page image to DISK (not MongoDB)
        const imageBuffer = fs.readFileSync(imagePages[i].path);
        const savedImage = await saveImageToDisk(imageBuffer, bookId, i + 1, 'png');
        
        // Store image metadata in MongoDB (with disk path)
        const image = new Image({
          bookId: bookId,
          fileId: book.fileId,
          pageNumber: i + 1,
          imagePath: savedImage.relativePath, // Path to disk file
          format: 'png',
          width: imagePages[i].width || 2000,
          height: imagePages[i].height || 2000,
          fileSize: savedImage.fileSize
          // Note: NO imageData field - image is stored on disk
        });
        await image.save();

        console.log(`Saved page ${i + 1} image to disk: ${savedImage.relativePath}`);
        tempFiles.push(imagePages[i].path);
        
      } catch (pageError) {
        console.error(`Error processing page ${i + 1}:`, pageError);
        extractedPages.push({
          pageNumber: i + 1,
          text: '',
          confidence: 0,
          source: 'paddle-asian',
          error: pageError.message
        });
      }
    }

    // Update progress and book status to completed
    progress.status = 'completed';
    progress.currentPage = imagePages.length;
    await progress.save();

    book.processingStatus = 'completed';
    await book.save();

    res.json({
      success: true,
      bookId: bookId,
      bookName: book.title,
      author: book.author,
      description: book.description,
      genre: book.genre,
      summary: book.summary,
      totalPages: imagePages.length,
      extractionMethod: 'paddle-asian',
      languages: targetLanguages,
      preview: allText.substring(0, 500),
      hasThumbnail: !!book.thumbnail,
      isPublic: book.isPublic,
      storageInfo: {
        thumbnailStorage: 'mongodb',
        imageStorage: 'disk',
        imageDirectory: imagesDir
      }
    });

  } catch (error) {
    console.error('Asian OCR error:', error);
    if (progress) {
      progress.status = 'failed';
      await progress.save();
    }
    if (book) {
      book.processingStatus = 'failed';
      await book.save();
    }
    res.status(500).json({ error: 'Failed to perform Asian OCR', details: error.message });
  } finally {
    // Clean up temp files
    cleanupTempFiles(tempFiles);
    if (tempImageDir && fs.existsSync(tempImageDir)) {
      try {
        fs.rmSync(tempImageDir, { recursive: true });
      } catch (err) {
        console.error('Failed to cleanup temp directory:', err);
      }
    }
  }
});



// UPDATED: Get book images list
app.get('/api/book/:bookId/images', verifyToken, async (req, res) => {
  try {
    const { bookId } = req.params;
    
    // Verify book access
    const book = await Book.findOne({ _id: bookId, userId: req.userId });
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // Get all images for this book
    const images = await Image.find({ bookId: bookId })
      .sort({ pageNumber: 1 })
      .select('pageNumber format width height fileSize imagePath _id');
    
    const imageList = images.map(img => ({
      pageNumber: img.pageNumber,
      imageId: img._id,
      format: img.format,
      width: img.width,
      height: img.height,
      fileSize: img.fileSize,
      imagePath: img.imagePath,
      url: `/api/book/${bookId}/page/${img.pageNumber}/image`,
      diskPath: path.join(__dirname, img.imagePath)
    }));
    
    res.json({
      success: true,
      bookId: bookId,
      totalImages: imageList.length,
      images: imageList,
      storageInfo: {
        storageType: 'disk',
        baseDirectory: path.join(__dirname, 'storage', 'images', bookId)
      }
    });
    
  } catch (error) {
    console.error('Error fetching book images:', error);
    res.status(500).json({ error: 'Failed to fetch book images' });
  }
});

// ADDITIONAL: Helper function to validate image buffers
function validateImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return false;
  }
  
  // Check for PNG signature
  if (buffer.length >= 8) {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    return buffer.subarray(0, 8).equals(pngSignature);
  }
  
  return false;
}
// ADDITIONAL: Debugging endpoint to check image integrity
app.get('/api/debug/image/:bookId/:pageNumber', verifyToken, async (req, res) => {
  try {
    const { bookId, pageNumber } = req.params;
    
    const image = await Image.findOne({ 
      bookId: mongoose.Types.ObjectId.isValid(bookId) ? bookId : null,
      pageNumber: parseInt(pageNumber)
    });
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const isBuffer = Buffer.isBuffer(image.imageData);
    const isValidPNG = validateImageBuffer(image.imageData);
    
    res.json({
      pageNumber: image.pageNumber,
      format: image.format,
      isBuffer: isBuffer,
      isValidPNG: isValidPNG,
      dataLength: image.imageData ? image.imageData.length : 0,
      fileSize: image.fileSize,
      width: image.width,
      height: image.height,
      firstBytes: image.imageData ? Array.from(image.imageData.subarray(0, 16)) : []
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// UPDATED Get book details endpoint with privacy check
app.get('/api/books/:bookId', verifyToken, async (req, res) => {
  try {
    const { bookId } = req.params;
    
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Find book by fileId or _id
    let book = await Book.findOne({
      $or: [
        { fileId: bookId },
        { _id: mongoose.Types.ObjectId.isValid(bookId) ? bookId : null }
      ]
    });
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // Check if user can access this book
    const canAccess = book.userId === req.userId || book.isPublic;
    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get pages and images
    const pages = await Page.find({ fileId: book.fileId })
      .sort({ pageNumber: 1 })
      .lean();
    
    const images = await Image.find({ fileId: book.fileId })
      .sort({ pageNumber: 1 })
      .select('pageNumber format width height fileSize')
      .lean();
    
    res.json({
      book: {
        id: book._id.toString(),
        fileId: book.fileId,
        title: book.title,
        author: book.author,
        description: book.description,
        genre: book.genre,
        summary: book.summary,
        isPublic: book.isPublic,
        isOwner: book.userId === req.userId,
        uploaderName: book.uploaderName,
        uploaderUsername: book.uploaderUsername,
        createdAt: book.createdAt.toLocaleString(),
        totalPages: book.totalPages || 0,
        totalWords: book.totalWords || 0,
        totalImages: book.totalImages || 0,
        thumbnail: book.thumbnail ? `/api/book/${book._id}/thumbnail` : null,
        processingStatus: book.processingStatus,
        confidence: book.confidence,
        extractionMethod: book.extractionMethod
      },
      pages: pages.map(page => ({
        ...page,
        imageUrl: `/api/book/${book._id}/page/${page.pageNumber}/image`
      })),
      images: images.map(img => ({
        ...img,
        url: `/api/book/${book._id}/page/${img.pageNumber}/image`
      }))
    });
    
  } catch (error) {
    console.error('Error fetching book details:', error);
    res.status(500).json({
      error: 'Failed to fetch book details',
      details: error.message
    });
  }
});


// FIXED: Thumbnail endpoint with proper buffer handling
app.get('/api/book/:bookId/thumbnail', async (req, res) => {
  try {
    const { bookId } = req.params;
    
    // Find book
    const book = await Book.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(bookId) ? bookId : null },
        { fileId: bookId }
      ]
    });
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // No access control - all thumbnails are public
    
    if (!book.thumbnail) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }
    
    // Handle thumbnail buffer
    let thumbnailBuffer;
    if (Buffer.isBuffer(book.thumbnail)) {
      thumbnailBuffer = book.thumbnail;
    } else if (typeof book.thumbnail === 'string') {
      try {
        thumbnailBuffer = Buffer.from(book.thumbnail, 'base64');
      } catch (error) {
        console.error('Error decoding base64 thumbnail:', error);
        return res.status(500).json({ error: 'Invalid thumbnail data' });
      }
    } else {
      return res.status(500).json({ error: 'Invalid thumbnail format' });
    }
    
    // Set proper headers
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': thumbnailBuffer.length,
      'Cache-Control': 'public, max-age=86400',
      'Accept-Ranges': 'bytes'
    });
    
    res.send(thumbnailBuffer);
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    res.status(500).json({ error: 'Failed to serve thumbnail' });
  }
});


// NEW: Update book settings endpoint
app.put('/api/books/:bookId/settings', verifyToken, async (req, res) => {
  try {
    const { bookId } = req.params;
    const { title, author, description, genre, summary, isPublic } = req.body;
    
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Find book and verify ownership
    const book = await Book.findOne({
      $or: [
        { fileId: bookId, userId: req.userId },
        { _id: mongoose.Types.ObjectId.isValid(bookId) ? bookId : null, userId: req.userId }
      ]
    });
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found or access denied' });
    }
    
    // Update fields
    if (title !== undefined) book.title = title;
    if (author !== undefined) book.author = author;
    if (description !== undefined) book.description = description;
    if (genre !== undefined) book.genre = genre;
    if (summary !== undefined) book.summary = summary;
    if (isPublic !== undefined) book.isPublic = isPublic;
    
    await book.save();
    
    res.json({
      success: true,
      book: {
        id: book._id.toString(),
        title: book.title,
        author: book.author,
        description: book.description,
        genre: book.genre,
        summary: book.summary,
        isPublic: book.isPublic,
        updatedAt: book.updatedAt.toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error updating book settings:', error);
    res.status(500).json({
      error: 'Failed to update book settings',
      details: error.message
    });
  }
});

// UPDATED Get all books endpoint with privacy filter
app.get('/api/books', verifyToken, async (req, res) => {
  try {
    const { includePublic = false, genre, search } = req.query;
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Build query based on privacy settings
    let query = {};
    if (includePublic === 'true') {
      // Get user's books + public books from others
      query = {
        $or: [
          { userId: req.userId },
          { isPublic: true }
        ]
      };
    } else {
      // Get only user's books
      query = { userId: req.userId };
    }

    // Add genre filter if specified
    if (genre && genre !== 'All') {
      query.genre = genre;
    }

    // Add search filter if specified
    if (search) {
      // Need to handle the $or properly when we already have one
      const searchConditions = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];

      if (query.$or) {
        // If we already have $or for privacy, we need to combine them with $and
        query = {
          $and: [
            { $or: query.$or }, // privacy conditions
            { $or: searchConditions } // search conditions
          ]
        };
      } else {
        query.$or = searchConditions;
      }
    }

    const books = await Book.find(query)
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Found ${books.length} books for user ${req.userId}`);

    const transformedBooks = books.map((book) => {
      // Handle missing or invalid createdAt dates
      let createdAtFormatted = 'Unknown Date';
      if (book.createdAt) {
        try {
          const date = new Date(book.createdAt);
          if (!isNaN(date.getTime())) {
            createdAtFormatted = date.toLocaleString();
          }
        } catch (error) {
          console.warn(`Invalid date for book ${book._id}:`, book.createdAt);
        }
      }

      return {
        id: book._id.toString(),
        fileId: book.fileId,
        title: book.title,
        author: book.author,
        description: book.description,
        genre: book.genre,
        summary: book.summary,
        isPublic: book.isPublic || false,
        isOwner: book.userId === req.userId,
        createdAt: createdAtFormatted,
        thumbnail: book.thumbnail ? `/api/book/${book._id}/thumbnail` : null,
        uploaderUsername: book.uploaderUsername,
        uploaderName: book.uploaderName,
        totalPages: book.totalPages || 0,
        totalWords: book.totalWords || 0,
        totalImages: book.totalImages || 0,
        processingStatus: book.processingStatus || 'unknown'
      };
    });

    res.json({ books: transformedBooks });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({
      error: 'Failed to fetch books',
      details: error.message
    });
  }
});

// Updated public books endpoint
app.get('/api/publicbooks', async (req, res) => {
  try {
    const { genre, search, limit = 20, offset = 0, excludeUser } = req.query;
    
    let query = { isPublic: true };
    
    // Optionally exclude the requesting user's books
    if (excludeUser) {
      query.uploaderUsername = { $ne: excludeUser };
    }
    
    if (genre && genre !== 'All') {
      query.genre = genre;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const books = await Book.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
      
    const total = await Book.countDocuments(query);
    
    const transformedBooks = books.map((book) => ({
      id: book._id.toString(),
      fileId: book.fileId,
      title: book.title,
      author: book.author,
      description: book.description,
      genre: book.genre,
      summary: book.summary,
      createdAt: book.createdAt.toLocaleString(),
      thumbnail: book.thumbnail ? `/api/book/${book._id}/thumbnail` : null,
      uploaderUsername: book.uploaderUsername,
      uploaderName: book.uploaderName,
      totalPages: book.totalPages || 0,
      totalWords: book.totalWords || 0,
      totalImages: book.totalImages || 0
    }));
    
    res.json({
      books: transformedBooks,
      total: total,
      hasMore: (parseInt(offset) + parseInt(limit)) < total
    });
  } catch (error) {
    console.error('Error fetching public books:', error);
    res.status(500).json({
      error: 'Failed to fetch public books',
      details: error.message
    });
  }
});

// Updated endpoint to serve page images from disk
app.get('/api/book/:bookId/page/:pageNumber/image', async (req, res) => {
  try {
    const { bookId, pageNumber } = req.params;
    console.log(`🖼️ Image request: bookId=${bookId}, pageNumber=${pageNumber}`);
    // Find the book first
    const book = await Book.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(bookId) ? bookId : null },
        { fileId: bookId }
      ]
    });
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    

    
    // Find the image metadata
    const image = await Image.findOne({
      bookId: book._id,
      pageNumber: parseInt(pageNumber)
    });
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Construct the full path to the image file
    const fullImagePath = path.join(__dirname, image.imagePath);
    console.log(`📁 Looking for image at: ${fullImagePath}`);
    console.log(`📁 File exists: ${fs.existsSync(fullImagePath)}`);

    // Check if file exists on disk
    if (!fs.existsSync(fullImagePath)) {
      console.error(`Image file not found on disk: ${fullImagePath}`);
      return res.status(404).json({ error: 'Image file not found on disk' });
    }
    
    // Set proper headers
    res.set({
      'Content-Type': `image/${image.format}`,
      'Cache-Control': 'public, max-age=86400',
      'Accept-Ranges': 'bytes'
    });
    
    // Stream the file from disk
    const imageStream = fs.createReadStream(fullImagePath);
    
    imageStream.on('error', (error) => {
      console.error('Error streaming image:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming image' });
      }
    });
    
    imageStream.pipe(res);
    
  } catch (error) {
    console.error('Error serving page image:', error);
    res.status(500).json({ error: 'Failed to serve page image' });
  }
});


// NEW: Delete book with cleanup of disk images
app.delete('/api/books/:bookId', verifyToken, async (req, res) => {
  try {
    const { bookId } = req.params;
    
    // Find book and verify ownership
    const book = await Book.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(bookId) ? bookId : null, userId: req.userId },
        { fileId: bookId, userId: req.userId }
      ]
    });
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found or access denied' });
    }
    
    // Get all images to delete from disk
    const images = await Image.find({ bookId: book._id });
    
    // Delete image files from disk
    let deletedImageCount = 0;
    for (const image of images) {
      try {
        const imagePath = path.join(__dirname, image.imagePath);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          deletedImageCount++;
        }
      } catch (fileError) {
        console.error(`Error deleting image file ${image.imagePath}:`, fileError);
      }
    }
    
    // Delete image directory if empty
    const imageDir = path.join(__dirname, 'storage', 'images', book._id.toString());
    try {
      if (fs.existsSync(imageDir)) {
        const dirContents = fs.readdirSync(imageDir);
        if (dirContents.length === 0) {
          fs.rmdirSync(imageDir);
        }
      }
    } catch (dirError) {
      console.error('Error removing image directory:', dirError);
    }
    
    // Delete database records
    await Image.deleteMany({ bookId: book._id });
    await Page.deleteMany({ bookId: book._id });
    await Progress.deleteMany({ bookId: book._id });
    await Book.findByIdAndDelete(book._id);
    
    res.json({
      success: true,
      message: 'Book and all associated data deleted successfully',
      deletedImageFiles: deletedImageCount,
      deletedImageRecords: images.length
    });
    
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({
      error: 'Failed to delete book',
      details: error.message
    });
  }
});

// NEW: Check disk storage health
app.get('/api/admin/storage-health', verifyToken, async (req, res) => {
  try {
    // Get all image records
    const images = await Image.find({}).select('imagePath bookId pageNumber');
    
    let foundFiles = 0;
    let missingFiles = 0;
    let totalSize = 0;
    const missingFilesList = [];
    
    for (const image of images) {
      const imagePath = path.join(__dirname, image.imagePath);
      if (fs.existsSync(imagePath)) {
        foundFiles++;
        const stats = fs.statSync(imagePath);
        totalSize += stats.size;
      } else {
        missingFiles++;
        missingFilesList.push({
          bookId: image.bookId,
          pageNumber: image.pageNumber,
          expectedPath: imagePath
        });
      }
    }
    
    res.json({
      success: true,
      totalImageRecords: images.length,
      foundFiles,
      missingFiles,
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      missingFilesList: missingFilesList.slice(0, 10) // Show first 10 missing files
    });
    
  } catch (error) {
    console.error('Error checking storage health:', error);
    res.status(500).json({
      error: 'Failed to check storage health',
      details: error.message
    });
  }
});


// Helper API to get processing progress
app.get('/api/progress/:bookId', verifyToken, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const progress = await Progress.findOne({ 
      bookId: req.params.bookId,
      userId: req.userId 
    });
    
    if (!progress) {
      return res.status(404).json({ error: 'Progress not found' });
    }
    
    res.json(progress);
  } catch (error) {
    console.error('Progress fetch error:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});


const PORT = process.env.BOOKSPORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});