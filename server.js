
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pkg from 'whatsapp-web.js';
const { Client, NoAuth } = pkg;
import qrcode from 'qrcode';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const client = new Client({
  authStrategy: new NoAuth(),
  puppeteer: {
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

let qrCodeData = null; // FIXED: Added missing variable
let clientStatus = 'DISCONNECTED';

client.on('qr', (qr) => {
  qrcode.toDataURL(qr, (err, url) => {
    qrCodeData = url;
    clientStatus = 'QR_RECEIVED';
    io.emit('status', { status: clientStatus, qr: qrCodeData });
  });
});

client.on('ready', () => {
  qrCodeData = null;
  clientStatus = 'READY';
  io.emit('status', { status: clientStatus });
  console.log('WhatsApp Client is ready!');
});

client.on('authenticated', () => {
  console.log('WhatsApp Authenticated!');
});

client.on('auth_failure', () => {
  clientStatus = 'AUTH_FAILURE';
  io.emit('status', { status: clientStatus });
});

client.on('disconnected', () => {
  clientStatus = 'DISCONNECTED';
  io.emit('status', { status: clientStatus });
});

io.on('connection', (socket) => {
  socket.emit('status', { status: clientStatus, qr: qrCodeData });

  socket.on('logout', async () => {
    try {
      console.log('Logging out...');
      await client.logout();
      await client.destroy();
      clientStatus = 'DISCONNECTED';
      qrCodeData = null;
      io.emit('status', { status: clientStatus });
      console.log('Re-initializing client...');
      client.initialize();
    } catch (err) {
      console.error('Logout error:', err);
      try { await client.destroy(); } catch (e) { }
      client.initialize();
    }
  });

  socket.on('send-bulk', async (data) => {
    const { candidates, message, groupLink, countryCode } = data;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      let fullPhone = candidate.phone;
      if (fullPhone.length <= 10 && !fullPhone.startsWith(countryCode)) {
        fullPhone = countryCode + fullPhone;
      }
      const personalizedMessage = message
        .replace(/\[Name\]/g, candidate.name)
        .replace(/\[Link\]/g, groupLink);

      try {
        const chatId = `${fullPhone}@c.us`;
        await client.sendMessage(chatId, personalizedMessage);
        io.emit('message-sent', { index: i, status: 'sent' });
        await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
      } catch (err) {
        console.error(`Failed to send to ${fullPhone}:`, err);
        io.emit('message-sent', { index: i, status: 'error' });
      }
    }
    io.emit('bulk-finished');
  });
});

console.log('Initializing WhatsApp client...');
client.initialize().catch(err => {
  console.error('CRITICAL: Failed to initialize WhatsApp client:', err);
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Automation server running on port ${PORT}`);
});
