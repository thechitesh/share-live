# ShareLive

> Lightweight browser-based live streaming — go live in seconds.

A single host can stream video and audio to up to **10 concurrent viewers** using WebRTC peer connections and a WebSocket signaling server. No accounts, no plugins, no install.

---

## Quick Start

### 1. Start the backend

```bash
cd server
npm install
npm run dev
```

Server runs at `http://localhost:3001`

### 2. Start the frontend

```bash
cd client
npm install
npm run dev
```

Client runs at `http://localhost:5173`

### 3. Go Live

1. Open `http://localhost:5173`
2. Enter your display name
3. Click **Start Broadcasting** — allow camera & microphone
4. Click **Go Live**
5. Copy the share URL and send it to viewers
6. Viewers open the URL and watch instantly

---

## Architecture

```
Host Browser ──────── WebSocket (signaling) ──────── Node.js Server
     │                                                     │
     └── WebRTC Peer Connection (video+audio) ─────── Viewer Browser
```

- **Signaling**: WebSocket server relays SDP offers/answers and ICE candidates
- **Media**: Direct WebRTC connections from host to each viewer (no media through server)
- **SFU pattern**: Host creates one RTCPeerConnection per viewer

## Technology Stack

| Layer      | Technology |
|------------|-----------|
| Frontend   | React 18 + TypeScript + Vite |
| Backend    | Node.js + Express + ws |
| Media      | WebRTC (native browser API) |
| Styling    | Vanilla CSS (dark theme) |

## Media Quality

- **Video**: 1280×720 @ 30fps (target), up to 1920×1080 if available
- **Audio**: 48kHz stereo, echo cancellation, noise suppression, auto gain

## Environment Variables (server)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
| `CLIENT_URL` | `http://localhost:5173` | Base URL for share links |
