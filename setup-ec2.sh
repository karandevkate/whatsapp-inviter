#!/bin/bash

# --- 1. System Updates & Essentials ---
echo "--- Step 1: Updating System & Installing Essentials ---"
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl build-essential git wget

# --- 2. Install Node.js 20 ---
echo "--- Step 2: Installing Node.js 20 ---"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# --- 3. Install All Chrome Dependencies (REQUIRED for Puppeteer) ---
echo "--- Step 3: Installing Chrome Dependencies ---"
sudo apt-get install -y \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libxshmfence1 \
    libnss3 \
    libxss1

# --- 4. Install Google Chrome Stable ---
echo "--- Step 4: Installing Google Chrome Stable ---"
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
rm google-chrome-stable_current_amd64.deb

# --- 5. Install PM2 & Serve ---
sudo npm install -g pm2 serve

# --- 6. Project Setup ---
npm install
npm run build

# --- 7. Configure PM2 ---
pm2 stop all || true
pm2 delete all || true
pm2 start server.js --name "whatsapp-server"
pm2 start "serve -s dist -l 3000" --name "whatsapp-frontend"

# --- 8. Persistence ---
pm2 save
pm2 startup | grep "sudo env" | bash

echo "=========================================================="
echo "DEPLOYMENT COMPLETE!"
echo "=========================================================="
