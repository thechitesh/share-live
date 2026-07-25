import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createRoom, getRoom, getRoomMetadata } from './room-manager';
import { setupSignaling } from './signaling';

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: [CLIENT_ORIGIN, /localhost:\d+/],
  credentials: true,
}));
app.use(express.json());

// Simple rate limiting store
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const window = 60_000; // 1 minute
  const max = 20;

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + window });
    return next();
  }

  entry.count++;
  if (entry.count > max) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  next();
}

// ── REST API ──────────────────────────────────────────────────────────────────

// Serve static client assets in production if available
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

/**
 * POST /api/rooms
 * Creates a new room and returns roomId + shareUrl
 */
app.post('/api/rooms', rateLimit, (req, res) => {
  const { hostName } = req.body;

  if (!hostName || typeof hostName !== 'string' || hostName.trim().length === 0) {
    return res.status(400).json({ error: 'hostName is required' });
  }

  const trimmedName = hostName.trim().slice(0, 50);
  const roomId = uuidv4().replace(/-/g, '').slice(0, 12);
  const room = createRoom(roomId, 'pending', trimmedName);

  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const host = req.get('host') || 'localhost:3001';
  const defaultClientUrl = `${protocol}://${host}`;
  const baseUrl = process.env.CLIENT_URL || defaultClientUrl;
  const shareUrl = `${baseUrl}/live/${roomId}`;

  return res.status(201).json({
    roomId: room.roomId,
    shareUrl,
    hostName: room.hostName,
  });
});

/**
 * GET /api/rooms/:roomId
 * Returns room metadata for viewers
 */
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;

  if (!/^[a-zA-Z0-9_-]{6,20}$/.test(roomId)) {
    return res.status(400).json({ error: 'Invalid room ID format' });
  }

  const metadata = getRoomMetadata(roomId);
  if (!metadata) {
    return res.status(404).json({ error: 'Room not found' });
  }

  return res.json(metadata);
});

/**
 * GET /api/health
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React SPA fallback for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      next();
    }
  });
});

// ── HTTP Server + WebSocket ───────────────────────────────────────────────────

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: '/ws',
  // Max message size 64KB (signaling only, no media)
  maxPayload: 65536,
});

setupSignaling(wss);

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════╗
║      ShareLive Server Started      ║
╠════════════════════════════════════╣
║  HTTP: http://localhost:${PORT}       ║
║  WS:   ws://localhost:${PORT}/ws      ║
╚════════════════════════════════════╝
  `);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
});
