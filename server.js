import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

const state = {
  qr: null,
  status: 'DISCONNECTED'
};

let client = null;

function createClient() {
  const c = new Client({
    authStrategy: new LocalAuth(),  // FIX 1: Use LocalAuth to persist session
    puppeteer: {
      headless: true,
      executablePath: '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-zygote',
        '--single-process'
      ]
    }
  });

  c.on('qr', (qr) => {
    qrcode.toDataURL(qr, (err, url) => {  // FIX 2: use 'url' not 'qrCodeData'
      if (err) {
        console.error('QR generation error:', err);
        return;
      }
      state.qr = url;
      state.status = 'QR_RECEIVED';
      io.emit('status', { status: state.status, qr: state.qr });
    });
  });

  c.on('ready', () => {
    state.qr = null;
    state.status = 'READY';
    io.emit('status', { status: state.status });
    console.log('WhatsApp Client is ready!');
  });

  c.on('disconnected', () => {
    state.status = 'DISCONNECTED';
    state.qr = null;
    io.emit('status', { status: state.status });
  });

  return c;
}

io.on('connection', (socket) => {
  socket.emit('status', { status: state.status, qr: state.qr });

  socket.on('logout', async () => {
    try {
      if (client) {
        await client.logout();
        await client.destroy();
      }
    } catch (err) {
      console.error('Logout error:', err.message);
    } finally {
      state.status = 'DISCONNECTED';
      state.qr = null;
      io.emit('status', { status: state.status });
      // Recreate and reinitialize client cleanly
      client = createClient();
      client.initialize().catch(e => console.error('Re-init Error:', e.message));
    }
  });

  socket.on('send-bulk', async (data) => {
    const { candidates, message, groupLink, countryCode } = data;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      let fullPhone = candidate.phone.toString().replace(/\D/g, ''); // strip non-digits
      if (fullPhone.length <= 10 && !fullPhone.startsWith(countryCode)) {
        fullPhone = countryCode + fullPhone;
      }
      const personalizedMessage = message
        .replace(/\[Name\]/g, candidate.name)
        .replace(/\[Link\]/g, groupLink || '');
      try {
        await client.sendMessage(`${fullPhone}@c.us`, personalizedMessage);
        io.emit('message-sent', { index: i, status: 'sent' });
        console.log(`Sent to ${fullPhone}`);
        await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
      } catch (err) {
        console.error(`Failed to send to ${fullPhone}:`, err.message);
        io.emit('message-sent', { index: i, status: 'error' });
      }
    }
    io.emit('bulk-finished');
  });
});

// Initialize once cleanly
client = createClient();
console.log('Initializing WhatsApp client...');
client.initialize().catch(e => console.error('CRITICAL: Failed to initialize WhatsApp client:', e.message));

httpServer.listen(3001, () => {
  console.log('Automation server running on port 3001');
});