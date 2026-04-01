
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

// Map to store clients per socket connection
const clients = new Map();

io.on('connection', (socket) => {
  console.log(`New user connected: ${socket.id}`);

  // Create a dedicated WhatsApp client for this specific user/tab
  const client = new Client({
    authStrategy: new NoAuth(),
    puppeteer: {
      headless: true,
      executablePath: '/usr/bin/google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote']
    }
  });

  let clientStatus = 'DISCONNECTED';

  client.on('qr', (qr) => {
    qrcode.toDataURL(qr, (err, url) => {
      clientStatus = 'QR_RECEIVED';
      socket.emit('status', { status: clientStatus, qr: url });
    });
  });

  client.on('ready', () => {
    clientStatus = 'READY';
    socket.emit('status', { status: clientStatus });
    console.log(`Client for ${socket.id} is ready!`);
  });

  client.on('disconnected', () => {
    clientStatus = 'DISCONNECTED';
    socket.emit('status', { status: clientStatus });
  });

  // Handle Bulk Sending for this specific client
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
        socket.emit('message-sent', { index: i, status: 'sent' });
        await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
      } catch (err) {
        socket.emit('message-sent', { index: i, status: 'error' });
      }
    }
    socket.emit('bulk-finished');
  });

  socket.on('logout', async () => {
    try {
      await client.logout();
      await client.destroy();
      socket.emit('status', { status: 'DISCONNECTED' });
      client.initialize();
    } catch (err) {
      console.log("Logout error, re-initializing...");
      client.initialize();
    }
  });

  // Cleanup when user closes the browser tab
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}. Cleaning up resources...`);
    try {
      await client.destroy();
    } catch (e) {}
    clients.delete(socket.id);
  });

  // Start the client for this user
  client.initialize().catch(e => console.error('Init Error:', e));
  clients.set(socket.id, client);
});

httpServer.listen(3001, () => {
  console.log('Multi-Session server running on port 3001');
});
