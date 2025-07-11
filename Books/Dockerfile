# Use a more recent Node.js version with better Python support
FROM node:18-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # Python and pip for PaddleOCR/EasyOCR
    python3 \
    python3-pip \
    python3-dev \
    # Image processing libraries
    libmagickwand-dev \
    imagemagick \
    # PDF processing
    poppler-utils \
    # OCR dependencies
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-ara \
    tesseract-ocr-chi-sim \
    tesseract-ocr-chi-tra \
    # System libraries for native modules
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libffi-dev \
    # Additional dependencies
    ghostscript \
    ffmpeg \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies step by step to avoid conflicts
RUN pip3 install --no-cache-dir numpy==1.24.3 || pip3 install --no-cache-dir numpy
RUN pip3 install --no-cache-dir opencv-python==4.6.0.66 || pip3 install --no-cache-dir opencv-python
RUN pip3 install --no-cache-dir pillow==9.5.0 || pip3 install --no-cache-dir pillow
RUN pip3 install --no-cache-dir paddlepaddle || echo "PaddlePaddle install failed, continuing..."
RUN pip3 install --no-cache-dir paddleocr || echo "PaddleOCR install failed, continuing..."
RUN pip3 install --no-cache-dir easyocr || echo "EasyOCR install failed, continuing..."
RUN pip3 install --no-cache-dir scipy || echo "SciPy install failed, continuing..."

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Create necessary directories
RUN mkdir -p storage/images temp

# Set environment variables
ENV NODE_ENV=production
ENV PYTHONPATH=/usr/local/lib/python3.9/site-packages

# Expose port
EXPOSE 4000

# Start the application
CMD ["node", "server.js"]