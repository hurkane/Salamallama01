const express = require("express");
const sequelize = require("./config/db");
const bodyParser = require("body-parser");
const authRoutes = require("./routes/authRoutes");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const cors = require("cors");

const app = express();

// Helper function to read Docker secrets
function readSecret(secretName) {
  const secretPath = path.join('/run/secrets', secretName);
  try {
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf8').trim();
    }
  } catch (error) {
    console.warn(`Could not read secret ${secretName}:`, error.message);
  }
  return null;
}

// Load secrets with fallback to environment variables
const DB_PASSWORD = readSecret('db_password') || process.env.DB_PASSWORD;
const JWT_SECRET = readSecret('jwt_secret') || process.env.JWT_SECRET;

// Make secrets available to the app
process.env.DB_PASSWORD = DB_PASSWORD;
process.env.JWT_SECRET = JWT_SECRET;

app.use(cors());
app.use(bodyParser.json());
app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await sequelize.sync();
});