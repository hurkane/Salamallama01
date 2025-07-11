# Use an official Node.js image
FROM node:22

# (Optional) Install additional packages for Android builds if required:
RUN apt-get update && apt-get install -y openjdk-17-jdk android-sdk adb wget unzip git

# Install Capacitor CLI globally
RUN npm install -g @capacitor/cli

# Set working directory
WORKDIR /app

# Copy package files and install dependencies.
# Assumes your project's package.json and package-lock.json are at the repository root.
COPY package*.json ./
RUN npm install

# Copy the entire project into the container.
COPY . .

# Copy your pre-made capacitor config if not already copied by the above command.
COPY capacitor.config.json ./

# Build your Remix (or SalamUI) app so that output goes to the folder specified in webDir ("dist").
RUN npm run build

# Run Capacitor commands automatically:
RUN cap copy && cap sync

# For automation, we don't need an interactive shell.
CMD ["tail", "-f", "/dev/null"]
