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

# --- 3. Install Google Chrome (Required for WhatsApp Automation) ---
# Google Chrome is more stable than Chromium for Puppeteer on EC2
echo "--- Step 3: Installing Google Chrome Stable ---"
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
rm google-chrome-stable_current_amd64.deb

# --- 4. Install PM2 & Serve ---
echo "--- Step 4: Installing Global PM2 and Serve ---"
sudo npm install -g pm2 serve

# --- 5. Project Setup ---
echo "--- Step 5: Setting up Project Dependencies ---"
# Navigate to the project directory (assuming script is run from inside it)
npm install

# --- 6. Build the Frontend ---
echo "--- Step 6: Building the Frontend ---"
# This ensures the Vite build is ready for production hosting
npm run build

# --- 7. Configure PM2 for Production ---
echo "--- Step 7: Starting Processes with PM2 ---"
# Stop existing processes to avoid conflicts
pm2 stop all || true
pm2 delete all || true

# Start Backend (WhatsApp Automation Server)
pm2 start server.js --name "whatsapp-server"

# Start Frontend (Serving the build folder on port 3000)
pm2 start "serve -s dist -l 3000" --name "whatsapp-frontend"

# --- 8. Persistence ---
echo "--- Step 8: Configuring Auto-Start on Reboot ---"
pm2 save
# Generate startup script
pm2 startup | grep "sudo env" | bash

echo "=========================================================="
echo "DEPLOYMENT COMPLETE!"
echo "=========================================================="
echo "Frontend URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
echo "Backend URL:  http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3001"
echo "----------------------------------------------------------"
echo "Check logs: pm2 logs whatsapp-server"
echo "Important: Ensure AWS Security Group Port 3000 & 3001 are OPEN."
echo "=========================================================="
