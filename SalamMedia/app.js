const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const cors = require("cors");

const app = express();
app.use(cors());

const mimeTypes = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "image/bmp": ["bmp"],
  "image/tiff": ["tif", "tiff"],
  "video/mp4": ["mp4"],
  "video/avi": ["avi"],
  "video/mov": ["mov"],
  "video/mpeg": ["mpeg", "mpg"],
  "video/quicktime": ["qt"],
  "video/x-msvideo": ["avi"],
  "video/x-matroska": ["mkv"],
  "video/webm": ["webm"],
  "audio/mpeg": ["mp3"],
  "audio/wav": ["wav"],
  "audio/ogg": ["ogg"],
  "audio/mp4": ["m4a"],
  "audio/aac": ["aac"],
  "audio/x-wav": ["wav"],
  "audio/flac": ["flac"],
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = req.query.type || "others";
    const uploadPath = path.join(__dirname, uploadDir); // Storing in the main root directory
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const originalFilename = `${file.fieldname}-${Date.now()}${
      path.extname(file.originalname) || ".jpg"
    }`;
    cb(null, originalFilename);
  },
});

const fileFilter = (req, file, cb) => {
  let mimeType = file.mimetype;
  const fileExt = path.extname(file.originalname).toLowerCase().substring(1);

  console.log("Received file MIME type:", mimeType);
  console.log("File extension:", fileExt);
  console.log("File details:", file);

  if (mimeType === "application/octet-stream") {
    for (const [type, extensions] of Object.entries(mimeTypes)) {
      if (extensions.includes(fileExt)) {
        mimeType = type;
        break;
      }
    }
  }

  if (Object.keys(mimeTypes).includes(mimeType)) {
    cb(null, true);
  } else {
    console.error("Unsupported file type:", mimeType);
    cb(new Error("Unsupported file type"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB size limit
});

// Define a secret for JWT
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Upload endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded or unsupported file type" });
    }

    const mediaPath = `${req.query.type || "others"}/${req.file.filename}`;
    const token = jwt.sign({ filePath: mediaPath }, JWT_SECRET, {
      expiresIn: "1h",
    }); // Token valid for 1 hour
    const responseUrl = `http://salam-media:5003/media/${
      req.query.type || "others"
    }/${req.file.filename}`;

    res.status(200).json({
      message: "File uploaded successfully",
      filePath: mediaPath,
      fileUrl: responseUrl, // Providing the URL without token in the response
    });
  } catch (error) {
    console.error("Error processing file:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// First layer endpoint: generates the access token URL
app.get("/media/:type/:filename", async (req, res) => {
  try {
    const mediaPath = `${req.params.type}/${req.params.filename}`;
    const token = jwt.sign({ filePath: mediaPath }, JWT_SECRET, {
      expiresIn: "1h",
    }); // Token valid for 1 hour
    const fileUrl = `http://192.168.12.242:5003/serve-file/${req.params.type}/${req.params.filename}?token=${token}`;

    res.status(200).json({ fileUrl });
  } catch (error) {
    console.error("Error generating file URL:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Second layer endpoint: serves the file
app.get("/serve-file/:type/:filename", async (req, res) => {
  try {
    const { token } = req.query;

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: "Invalid token" });
      }

      const filePath = path.join(__dirname, decoded.filePath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }

      res.sendFile(filePath);
    });
  } catch (error) {
    console.error("Error retrieving file:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/preview", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send({ error: "URL is required" });

  try {
    const response = await fetch(url);
    const html = await response.text();
    const metadata = await metascraper({ html, url });
    res.json(metadata);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to fetch metadata" });
  }
});

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
  console.log(`Media service running on port ${PORT}`);
});
