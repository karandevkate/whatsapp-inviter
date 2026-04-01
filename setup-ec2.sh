#!/bin/bash

# Update system
echo "Updating system..."
sudo apt-get update -y
sudo apt-get upgrade -y

# Install Node.js 20
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chromium (Required for whatsapp-web.js)
echo "Installing Chromium..."
sudo apt-get install -y chromium-browser \
    libnss3 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2

# Install PM2
echo "Installing PM2..."
sudo npm install -g pm2

# Install project dependencies
echo "Installing project dependencies..."
npm install

# Build the frontend
echo "Building frontend..."
npm run build

# Install serve to host the frontend
sudo npm install -g serve

# Start the automation server
echo "Starting automation server..."
pm2 start server.js --name "whatsapp-server"

# Start the frontend
echo "Starting frontend server..."
pm2 start "serve -s dist -l 3000" --name "whatsapp-frontend"

# Setup PM2 to start on boot
pm2 save
pm2 startup

echo "Setup Complete!"
echo "Your app is running on port 3000 (Frontend) and 3001 (Backend)."
echo "Ensure EC2 Security Group allows inbound traffic on these ports."
