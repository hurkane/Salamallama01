const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} = require("@azure/storage-blob");
require("dotenv").config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

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
    const buffer = req.file.buffer;
    const fileType = req.file.mimetype.split("/")[0];
    const originalFilename = `${req.file.fieldname}-${Date.now()}${
      path.extname(req.file.originalname) || ".jpg"
    }`;
    const processedFilename = `${
      path.parse(originalFilename).name
    }-processed${path.extname(originalFilename)}`;

    let uploadDir = req.query.type || "others";

    let processedBuffer;
    if (fileType === "image") {
      processedBuffer = await sharp(buffer).resize({ width: 800 }).toBuffer();
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
      message: "File uploaded and processed successfully",
      filePath: `${uploadDir}/${processedFilename}`,
    });
  } catch (error) {
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
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
  console.log(`Media service running on port ${PORT}`);
});
