
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
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

// Robust State Management
const state = {
  qr: null,
  status: 'DISCONNECTED'
};

const client = new Client({
  authStrategy: new NoAuth(),
  puppeteer: {
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-zygote'
    ]
  }
});

client.on('qr', (qr) => {
  qrcode.toDataURL(qr, (err, url) => {
    state.qr = url;
    state.status = 'QR_RECEIVED';
    io.emit('status', { status: state.status, qr: state.qr });
  });
});

client.on('ready', () => {
  state.qr = null;
  state.status = 'READY';
  io.emit('status', { status: state.status });
  console.log('WhatsApp Client is ready!');
});

client.on('disconnected', () => {
  state.status = 'DISCONNECTED';
  io.emit('status', { status: state.status });
});

io.on('connection', (socket) => {
  socket.emit('status', { status: state.status, qr: state.qr });

  socket.on('logout', async () => {
    try {
      await client.logout();
      await client.destroy();
      state.status = 'DISCONNECTED';
      state.qr = null;
      io.emit('status', { status: state.status });
      client.initialize();
    } catch (err) {
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
      const personalizedMessage = message.replace(/\[Name\]/g, candidate.name).replace(/\[Link\]/g, groupLink);
      try {
        await client.sendMessage(`${fullPhone}@c.us`, personalizedMessage);
        io.emit('message-sent', { index: i, status: 'sent' });
        await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
      } catch (err) {
        io.emit('message-sent', { index: i, status: 'error' });
      }
    }
    io.emit('bulk-finished');
  });
});

console.log('Initializing WhatsApp client...');
client.initialize().catch(e => console.error('Init Error:', e));

httpServer.listen(3001, () => {
  console.log('Automation server running on port 3001');
});
