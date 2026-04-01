#!/bin/bash
set -e

echo "=========================================================="
echo "       WhatsApp Inviter - Full Setup Script"
echo "=========================================================="

# --- 1. System Updates & Essentials ---
echo ""
echo "--- Step 1: Updating System & Installing Essentials ---"
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl build-essential git wget unzip

# --- 2. Install Node.js 20 ---
echo ""
echo "--- Step 2: Installing Node.js 20 ---"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# --- 3. Install All Chrome Dependencies ---
echo ""
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
    libxss1 \
    libglib2.0-0 \
    libnss3-dev \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxcomposite1 \
    libxcursor1 \
    libxi6 \
    libxtst6 \
    fonts-liberation

# --- 4. Install Google Chrome Stable ---
echo ""
echo "--- Step 4: Installing Google Chrome Stable ---"
wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
rm -f google-chrome-stable_current_amd64.deb
echo "Chrome version: $(google-chrome-stable --version)"

# --- 5. Install PM2 & Serve globally ---
echo ""
echo "--- Step 5: Installing PM2 & Serve ---"
sudo npm install -g pm2 serve

# --- 6. Project Setup ---
echo ""
echo "--- Step 6: Installing Project Dependencies ---"
npm install

echo ""
echo "--- Step 7: Building Frontend ---"
npm run build

# --- 8. Clean old WhatsApp session (prevents onQRChangedEvent error) ---
echo ""
echo "--- Step 8: Cleaning Old WhatsApp Session Cache ---"
rm -rf .wwebjs_auth .wwebjs_cache
echo "Session cache cleared."

# --- 9. Stop & remove old PM2 processes ---
echo ""
echo "--- Step 9: Resetting PM2 Processes ---"
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# --- 10. Start PM2 Processes ---
echo ""
echo "--- Step 10: Starting PM2 Processes ---"
pm2 start server.js --name "whatsapp-server" --node-args="--experimental-vm-modules"
pm2 start "serve -s dist -l 3000" --name "whatsapp-frontend"

# --- 11. Save & Enable PM2 on Boot ---
echo ""
echo "--- Step 11: Configuring PM2 Startup ---"
pm2 save
STARTUP_CMD=$(pm2 startup | grep "sudo env")
if [ -n "$STARTUP_CMD" ]; then
    eval "$STARTUP_CMD"
else
    echo "Warning: Could not auto-configure PM2 startup. Run 'pm2 startup' manually."
fi

# --- 12. Show Status ---
echo ""
echo "--- Step 12: Final Status ---"
pm2 list

echo ""
echo "=========================================================="
echo "              DEPLOYMENT COMPLETE!"
echo "=========================================================="
echo ""
echo "  Frontend  : http://YOUR_SERVER_IP:3000"
echo "  Backend   : http://YOUR_SERVER_IP:3001"
echo ""
echo "  To view logs  : pm2 logs whatsapp-server"
echo "  To restart    : pm2 restart whatsapp-server"
echo "  To monitor    : pm2 monit"
echo "=========================================================="