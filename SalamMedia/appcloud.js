const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const metascraper = require("metascraper");
const metascraperDescription = require("metascraper-description");
const metascraperImage = require("metascraper-image");
const metascraperTitle = require("metascraper-title");
const metascraperUrl = require("metascraper-url");
const {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} = require("@azure/storage-blob");
const fs = require("fs");
require("dotenv").config();
const cors = require("cors");

const app = express();
app.use(cors());

const storage = multer.memoryStorage();
const scraper = metascraper([
  metascraperDescription(),
  metascraperImage(),
  metascraperTitle(),
  metascraperUrl(),
]);

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

const fileFilter = (req, file, cb) => {
  let mimeType = file.mimetype;
  const fileExt = path.extname(file.originalname).toLowerCase().substring(1);

  console.log("Received file MIME type:", mimeType);
  console.log("File extension:", fileExt);
  console.log("File details:", file);

  // Handle application/octet-stream by checking file extension
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

const AZURE_STORAGE_CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.CONTAINER_NAME;
const accountName = process.env.ACCOUNT_NAME;
const accountKey = process.env.ACCOUNT_KEY;

const sharedKeyCredential = new StorageSharedKeyCredential(
  accountName,
  accountKey
);

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded or unsupported file type" });
    }

    const buffer = req.file.buffer;

    const originalFilename = `${req.file.fieldname}-${Date.now()}${
      path.extname(req.file.originalname) || ".jpg"
    }`;
    const processedFilename = `${
      path.parse(originalFilename).name
    }-processed${path.extname(originalFilename)}`;
    let uploadDir = req.query.type || "others";

    const processedBuffer = buffer; // No processing for videos in this example

    if (!processedBuffer) {
      throw new Error("Processed buffer is undefined");
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(
      AZURE_STORAGE_CONNECTION_STRING
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(
      `${uploadDir}/${processedFilename}`
    );
    await blockBlobClient.upload(processedBuffer, processedBuffer.length);

    res.status(200).json({
      message: "File uploaded successfully",
      filePath: `${uploadDir}/${processedFilename}`,
    });
  } catch (error) {
    console.error("Error processing file:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/media/:type/:filename", async (req, res) => {
  try {
    const blobName = `${req.params.type}/${req.params.filename}`;
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      AZURE_STORAGE_CONNECTION_STRING
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("r"),
        startsOn: new Date(),
        expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour
      },
      sharedKeyCredential
    ).toString();

    const fileUrl = `${blockBlobClient.url}?${sasToken}`;

    res.status(200).json({ fileUrl });
  } catch (error) {
    console.error("Error generating SAS token:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/preview", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send({ error: "URL is required" });

  try {
    const response = await fetch(url);
    const html = await response.text();
    const metadata = await scraper({ html, url });
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
