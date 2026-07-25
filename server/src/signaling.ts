import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import {
  createRoom,
  getRoom,
  setRoomLive,
  endRoom,
  addViewer,
  removeViewer,
  getViewerCount,
  getRoomMetadata,
} from './room-manager';

// ── Types ────────────────────────────────────────────────────────────────────

interface SignalingClient extends WebSocket {
  clientId: string;
  role: 'host' | 'viewer' | 'unknown';
  roomId?: string;
}

// Plain object types for WebRTC signaling (server is just a relay, doesn't use WebRTC)
type SDPInit = { type: string; sdp?: string };
type ICECandidateInit = { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null; usernameFragment?: string | null };

type Message =
  | { type: 'host:join'; roomId: string; hostName: string }
  | { type: 'host:publish'; offer: SDPInit }
  | { type: 'host:leave' }
  | { type: 'viewer:join'; roomId: string }
  | { type: 'viewer:leave' }
  | { type: 'offer'; offer: SDPInit; viewerId: string }
  | { type: 'answer'; answer: SDPInit; viewerId?: string; hostId?: string }
  | { type: 'ice-candidate'; candidate: ICECandidateInit; targetId?: string; viewerId?: string };

// ── State ────────────────────────────────────────────────────────────────────

// Map roomId → host WS client
const hostClients = new Map<string, SignalingClient>();
// Map clientId → WS client (all clients)
const allClients = new Map<string, SignalingClient>();
// Map roomId → Map<viewerId, SignalingClient>
const viewerClients = new Map<string, Map<string, SignalingClient>>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function send(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastToViewers(roomId: string, data: object) {
  const viewers = viewerClients.get(roomId);
  if (!viewers) return;
  for (const [, viewer] of viewers) {
    send(viewer, data);
  }
}

function broadcastViewerCount(roomId: string) {
  const count = getViewerCount(roomId);
  const host = hostClients.get(roomId);
  if (host) send(host, { type: 'viewer-count', count });
  broadcastToViewers(roomId, { type: 'viewer-count', count });
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── WebSocket Server Setup ────────────────────────────────────────────────────

export function setupSignaling(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const client = ws as SignalingClient;
    client.clientId = generateId();
    client.role = 'unknown';
    allClients.set(client.clientId, client);

    console.log(`[Signaling] Client connected: ${client.clientId}`);

    client.on('message', (raw) => {
      let msg: Message;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      handleMessage(client, msg);
    });

    client.on('close', () => {
      handleDisconnect(client);
      allClients.delete(client.clientId);
      console.log(`[Signaling] Client disconnected: ${client.clientId}`);
    });

    client.on('error', (err) => {
      console.error(`[Signaling] Client error ${client.clientId}:`, err.message);
    });

    // Acknowledge connection
    send(client, { type: 'connected', clientId: client.clientId });
  });
}

// ── Message Handling ──────────────────────────────────────────────────────────

function handleMessage(client: SignalingClient, msg: Message) {
  switch (msg.type) {
    case 'host:join':
      handleHostJoin(client, msg);
      break;
    case 'host:leave':
      handleHostLeave(client);
      break;
    case 'viewer:join':
      handleViewerJoin(client, msg);
      break;
    case 'viewer:leave':
      handleViewerLeave(client);
      break;
    case 'offer':
      handleOffer(client, msg);
      break;
    case 'answer':
      handleAnswer(client, msg);
      break;
    case 'ice-candidate':
      handleIceCandidate(client, msg);
      break;
    default:
      console.warn(`[Signaling] Unknown message type`);
  }
}

function handleHostJoin(
  client: SignalingClient,
  msg: { type: 'host:join'; roomId: string; hostName: string }
) {
  const { roomId, hostName } = msg;

  // Check if room exists (created via REST) or create it now
  let room = getRoom(roomId);
  if (!room) {
    room = createRoom(roomId, client.clientId, hostName);
  }

  if (room.status === 'ENDED') {
    send(client, { type: 'error', message: 'Room has ended' });
    return;
  }

  client.role = 'host';
  client.roomId = roomId;
  hostClients.set(roomId, client);
  setRoomLive(roomId);

  // Initialize viewer map for room
  if (!viewerClients.has(roomId)) {
    viewerClients.set(roomId, new Map());
  }

  send(client, {
    type: 'host:joined',
    roomId,
    viewerCount: getViewerCount(roomId),
  });

  // If viewers joined before host was ready, notify host now
  const existingViewers = viewerClients.get(roomId);
  if (existingViewers) {
    for (const [viewerId] of existingViewers) {
      send(client, { type: 'viewer:ready', viewerId });
    }
  }

  console.log(`[Signaling] Host joined room: ${roomId}`);
}

function handleHostLeave(client: SignalingClient) {
  if (!client.roomId) return;
  const roomId = client.roomId;

  endRoom(roomId);
  hostClients.delete(roomId);

  // Notify all viewers
  broadcastToViewers(roomId, { type: 'stream-ended' });

  // Disconnect all viewers
  const viewers = viewerClients.get(roomId);
  if (viewers) {
    for (const [viewerId] of viewers) {
      removeViewer(roomId, viewerId);
    }
    viewerClients.delete(roomId);
  }

  console.log(`[Signaling] Host left room: ${roomId}`);
}

function handleViewerJoin(
  client: SignalingClient,
  msg: { type: 'viewer:join'; roomId: string }
) {
  const { roomId } = msg;
  const room = getRoom(roomId);

  if (!room) {
    send(client, { type: 'error', message: 'Room not found' });
    return;
  }

  if (room.status === 'ENDED') {
    send(client, { type: 'stream-ended', message: 'Stream has ended' });
    return;
  }

  const added = addViewer(roomId, client.clientId);
  if (!added) {
    send(client, { type: 'error', message: 'Room is full (max 10 viewers)' });
    return;
  }

  client.role = 'viewer';
  client.roomId = roomId;

  let viewers = viewerClients.get(roomId);
  if (!viewers) {
    viewers = new Map();
    viewerClients.set(roomId, viewers);
  }
  viewers.set(client.clientId, client);

  send(client, {
    type: 'viewer:joined',
    roomId,
    hostName: room.hostName,
    status: room.status,
  });

  // Notify host about new viewer and updated count
  broadcastViewerCount(roomId);

  // Notify host to create WebRTC offer for this viewer if host is present
  const host = hostClients.get(roomId);
  if (host) {
    setRoomLive(roomId);
    send(host, { type: 'viewer:ready', viewerId: client.clientId });
  }

  console.log(`[Signaling] Viewer ${client.clientId} joined room: ${roomId}`);
}

function handleViewerLeave(client: SignalingClient) {
  if (!client.roomId) return;
  const { roomId, clientId } = client;

  const viewers = viewerClients.get(roomId);
  if (viewers) viewers.delete(clientId);
  removeViewer(roomId, clientId);

  broadcastViewerCount(roomId);
  console.log(`[Signaling] Viewer ${clientId} left room: ${roomId}`);
}

function handleOffer(
  client: SignalingClient,
  msg: { type: 'offer'; offer: SDPInit; viewerId?: string }
) {
  if (!client.roomId) return;

  if (client.role === 'host' && msg.viewerId) {
    // Host sends offer to a specific viewer
    const viewers = viewerClients.get(client.roomId);
    const viewer = viewers?.get(msg.viewerId);

    if (viewer) {
      send(viewer, {
        type: 'offer',
        offer: msg.offer,
        hostId: client.clientId,
      });
      // Mark room as LIVE when host publishes first offer
      const room = getRoom(client.roomId);
      if (room && room.status !== 'LIVE') {
        setRoomLive(client.roomId);
        broadcastToViewers(client.roomId, { type: 'stream-started' });
      }
    }
  } else if (client.role === 'viewer') {
    // Viewer sends offer (e.g. mic renegotiation) to host
    const host = hostClients.get(client.roomId);
    if (host) {
      send(host, {
        type: 'offer',
        offer: msg.offer,
        viewerId: client.clientId,
      });
    }
  }
}

function handleAnswer(
  client: SignalingClient,
  msg: { type: 'answer'; answer: SDPInit; hostId?: string; viewerId?: string }
) {
  if (!client.roomId) return;

  if (client.role === 'viewer') {
    // Viewer sends answer → forward to host
    const host = hostClients.get(client.roomId);
    if (host) {
      send(host, { type: 'answer', answer: msg.answer, viewerId: client.clientId });
    }
  } else if (client.role === 'host' && msg.viewerId) {
    // Host sends answer → forward to specific viewer
    const viewers = viewerClients.get(client.roomId);
    const viewer = viewers?.get(msg.viewerId);
    if (viewer) {
      send(viewer, { type: 'answer', answer: msg.answer, hostId: client.clientId });
    }
  }
}

function handleIceCandidate(
  client: SignalingClient,
  msg: { type: 'ice-candidate'; candidate: ICECandidateInit; targetId?: string; viewerId?: string }
) {
  if (!client.roomId) return;

  if (client.role === 'host') {
    // Host sends ICE candidate for a specific viewer
    if (msg.viewerId) {
      const viewers = viewerClients.get(client.roomId);
      const viewer = viewers?.get(msg.viewerId);
      if (viewer) {
        send(viewer, { type: 'ice-candidate', candidate: msg.candidate, fromHost: true });
      }
    }
  } else if (client.role === 'viewer') {
    // Viewer sends ICE candidate → forward to host
    const host = hostClients.get(client.roomId);
    if (host) {
      send(host, { type: 'ice-candidate', candidate: msg.candidate, viewerId: client.clientId });
    }
  }
}

// ── Disconnect Handling ───────────────────────────────────────────────────────

function handleDisconnect(client: SignalingClient) {
  if (client.role === 'host') {
    handleHostLeave(client);
  } else if (client.role === 'viewer') {
    handleViewerLeave(client);
  }
}
