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

# --- 3. Install All Chrome Dependencies (Updated for Ubuntu 24.04+) ---
echo "--- Step 3: Installing Chrome Dependencies ---"
# We try both old and new names (t64) to ensure compatibility
sudo apt-get install -y \
    libatk1.0-0 \
    libatk1.0-0t64 \
    libatk-bridge2.0-0 \
    libatk-bridge2.0-0t64 \
    libcups2 \
    libcups2t64 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libasound2t64 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libxshmfence1 \
    libnss3 \
    libxss1 \
    libglib2.0-0t64 || echo "Some dependencies might have failed, proceeding to Chrome install..."

# --- 4. Install Google Chrome Stable (This usually fixes missing libs) ---
echo "--- Step 4: Installing Google Chrome Stable ---"
wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
rm google-chrome-stable_current_amd64.deb

# --- 5. Install PM2 & Serve ---
sudo npm install -g pm2 serve

# --- 6. Project Setup ---
npm install
npm run build

# --- 7. Configure PM2 ---
# Clean up old processes
pm2 stop all || true
pm2 delete all || true
# Start fresh
pm2 start server.js --name "whatsapp-server"
pm2 start "serve -s dist -l 3000" --name "whatsapp-frontend"

# --- 8. Persistence ---
pm2 save
pm2 startup | grep "sudo env" | bash || true

echo "=========================================================="
echo "DEPLOYMENT COMPLETE!"
echo "=========================================================="
