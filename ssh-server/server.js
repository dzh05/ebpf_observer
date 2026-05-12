const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { Client } = require('ssh2');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  app.use(express.static(path.join(__dirname, 'build')));
  app.use((req, res, next) => {
    if (req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

const io = new Server(server, {
  cors: {
    origin: [
      'http://127.0.0.1:8000',
      'http://localhost:8000',
      'http://127.0.0.1:4173',
      'http://localhost:4173'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  const conn = new Client();
  let shellStream = null;

  socket.on('initSSH', (config) => {
    if (!config?.host || !config?.username || !config?.password) {
      socket.emit('status', 'SSH 配置不完整\r\n');
      return;
    }

    socket.emit('status', `Connecting to ${config.host}:${config.port || 22}...\r\n`);

    conn.on('ready', () => {
      socket.emit('status', 'SSH 连接成功\r\n');
      conn.shell((err, stream) => {
        if (err) {
          socket.emit('output', `\r\n*** SSH Shell Error: ${err.message} ***\r\n`);
          return;
        }

        shellStream = stream;
        stream.on('data', (data) => socket.emit('output', data.toString('utf-8')));
        stream.on('close', () => {
          conn.end();
          socket.emit('status', 'SSH shell 已关闭\r\n');
          socket.disconnect();
        });

        socket.on('input', (data) => {
          stream.write(data);
        });

        socket.on('resize', ({ rows, cols }) => {
          stream.setWindow(rows, cols);
        });
      });
    }).on('error', (err) => {
      console.error('SSH Connect Error:', err);
      socket.emit('status', `SSH 连接失败: ${err.message}\r\n`);
    }).connect({
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password
    });
  });

  socket.on('disconnect', () => {
    if (shellStream) shellStream.end();
    conn.end();
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`SSH Socket Server listening on port ${PORT}`);
});
