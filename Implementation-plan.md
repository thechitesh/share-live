# Lightweight Live Streaming Platform (Agentic Development Specification)

# Project Goal

Build a lightweight, browser-based live streaming platform where a single broadcaster (Host) can stream live video/audio to multiple viewers (maximum 10 concurrent viewers) using a shareable URL.

The system should prioritize:

- Low latency
- Simplicity
- Minimal infrastructure
- High reliability
- Easy deployment

This is **not** intended to compete with YouTube Live or Twitch. It is designed for small private broadcasts such as demos, interviews, internal meetings, customer support, or remote monitoring.

---

# Product Overview

## Primary Use Case

1. Host opens the application.
2. Host enters a display name.
3. Host starts broadcasting using webcam and microphone.
4. System creates a unique room.
5. System generates a shareable URL.
6. Viewers open the URL.
7. Viewers immediately receive the live stream.
8. Host can see the number of connected viewers.
9. Stream ends when the host stops broadcasting.

---

# Scope

## In Scope

- One host per room
- Up to 10 viewers
- Live audio
- Live video
- Browser only
- No account system
- No recording
- No chat
- No moderation
- No screen sharing (future enhancement)

## Out of Scope

- Authentication
- Multi-host broadcasting
- Stream recording
- Playback
- RTMP ingest
- CDN
- Adaptive bitrate
- Chat
- Reactions
- Screen sharing
- Mobile applications

---

# High-Level Architecture

```
                +----------------------+
                |    Signaling Server  |
                |   (WebSocket/WS)     |
                +----------+-----------+
                           |
                 SDP / ICE Exchange
                           |
        +------------------+------------------+
        |                                     |
     Host Browser                        Viewer Browser
        |                                     |
        |                                     |
        +------------- WebRTC ----------------+
                      via SFU
                           |
                  +----------------+
                  |      SFU       |
                  | mediasoup/livekit|
                  +----------------+
                           |
                     TURN/STUN Server
```

---

# Technology Stack

## Frontend

- React
- TypeScript
- Vite
- WebRTC API
- WebSocket client

---

## Backend

- Node.js
- TypeScript
- Express
- WebSocket Server

---

## Media Layer

Preferred SFU options:

- mediasoup (recommended)
- LiveKit
- Janus (optional)

---

## NAT Traversal

- STUN server
- TURN server (Coturn)

TURN should be automatically used when direct peer connectivity fails.

---

# Functional Requirements

## Host

### Create Broadcast

The host can:

- Enter display name
- Allow camera permission
- Allow microphone permission
- Start broadcasting

Expected Result

- Media is published to the SFU.
- Room is created.
- Share URL is generated.

---

### Stream Controls

Host can:

- Stop stream
- Mute microphone
- Unmute microphone
- Disable camera
- Enable camera

---

### Viewer Statistics

Display

- Current viewer count
- Stream duration
- Connection status

---

## Viewer

### Join Stream

Viewer opens:

```
https://domain/live/{roomId}
```

Expected flow

- Connect to signaling server
- Receive room metadata
- Join SFU
- Receive media
- Start playback automatically

---

### Playback

Viewer should:

- Watch live video
- Hear live audio

Viewer cannot:

- Publish media
- Enable microphone
- Enable camera

---

### Auto Reconnect

If network temporarily disconnects:

- reconnect signaling
- reconnect WebRTC transport
- resume playback automatically

---

# Room Lifecycle

## Create Room

Triggered when host starts stream.

State:

```
CREATED
```

---

## Broadcasting

Host publishing.

State:

```
LIVE
```

---

## End Stream

Host stops stream.

State:

```
ENDED
```

Behavior:

- Notify all viewers.
- Disconnect transports.
- Destroy room after configurable timeout (e.g., 5 minutes).

---

# Signaling Requirements

WebSocket will be used only for signaling.

Responsibilities:

- Join room
- Leave room
- Exchange SDP
- Exchange ICE candidates
- Notify viewer count changes
- Notify stream ended

No media should flow through WebSocket.

---

# SFU Requirements

The SFU should:

- Accept one publisher
- Forward media to multiple viewers
- Support VP8 and H.264 video codecs
- Support Opus audio codec
- Avoid transcoding
- Forward packets with minimal processing
- Scale efficiently up to 10 viewers

---

# Networking Requirements

Support:

- STUN
- TURN fallback
- ICE restart
- Connection recovery

---

# User Experience

## Host

Display:

- Local preview
- Share URL
- Copy link button
- Viewer count
- Stream duration
- Stream status

---

## Viewer

Display:

- Video player
- Host display name
- Connection indicator
- Reconnecting indicator (when applicable)
- Stream ended message

---

# Error Handling

## Camera Denied

Display:

```
Camera permission is required.
```

---

## Microphone Denied

Display:

```
Microphone permission is required.
```

---

## Stream Offline

Display:

```
This stream is no longer available.
```

---

## Network Lost

Display:

```
Reconnecting...
```

Automatically retry connection.

---

## Room Not Found

Display:

```
Invalid or expired room.
```

---

# Non-Functional Requirements

## Performance

- End-to-end latency < 1 second (target)
- Stream startup < 3 seconds
- Viewer join < 5 seconds
- Support up to 10 concurrent viewers per room

---

## Reliability

- Automatic reconnect
- Graceful recovery from temporary network failures
- Handle unexpected browser refreshes

---

## Scalability

Initial target:

- Single server deployment
- Multiple simultaneous rooms
- 10 viewers per room

Future scalability:

- Horizontal SFU scaling
- Distributed signaling
- Redis adapter
- Load balancing

---

## Security

- HTTPS only
- Secure WebSocket (WSS)
- DTLS-SRTP for media encryption
- Validate room IDs
- Prevent unauthorized media publishing
- Basic rate limiting on signaling endpoints

---

# API Design

## REST Endpoints

### Create Room

```
POST /api/rooms
```

Response

```json
{
  "roomId": "...",
  "shareUrl": "...",
  "token": "host-token"
}
```

---

### Get Room

```
GET /api/rooms/:roomId
```

Returns room metadata.

---

# WebSocket Events

## Host

```
host:join
host:publish
host:leave
```

---

## Viewer

```
viewer:join
viewer:leave
```

---

## Server

```
viewer-count
stream-started
stream-ended
ice-candidate
offer
answer
```

---

# Data Model

## Room

```typescript
Room {
  roomId: string
  hostId: string
  hostName: string
  status: CREATED | LIVE | ENDED
  createdAt: Date
  startedAt?: Date
  endedAt?: Date
}
```

---

## Viewer

```typescript
Viewer {
  viewerId: string
  roomId: string
  joinedAt: Date
}
```

---

# Development Milestones

## Milestone 1 – Foundation

- Project setup
- React frontend
- Node backend
- WebSocket signaling
- Basic routing

Deliverable:
Application shell with signaling connectivity.

---

## Milestone 2 – Host Streaming

- Camera access
- Microphone access
- Local preview
- Publish media to SFU

Deliverable:
Host can successfully broadcast.

---

## Milestone 3 – Viewer Playback

- Room join
- Receive media
- Playback stream

Deliverable:
Single viewer receives live stream.

---

## Milestone 4 – Multi-Viewer Support

- Multiple viewers
- Viewer count
- Connection management

Deliverable:
Up to 10 viewers can watch simultaneously.

---

## Milestone 5 – Reliability

- Auto reconnect
- TURN fallback
- Error handling
- Room cleanup

Deliverable:
Production-ready MVP.

---

# Acceptance Criteria

A release is considered complete when:

- A host can create a live room.
- A shareable URL is generated.
- Up to 10 viewers can join concurrently.
- Viewers receive synchronized audio and video with low latency.
- Viewer count updates in real time.
- Temporary network interruptions trigger automatic reconnection.
- TURN relay is used when direct peer connections fail.
- Media is routed exclusively through the SFU (no mesh networking).
- The application runs entirely in modern desktop browsers without requiring user accounts or additional software.

---

# Future Enhancements

- Screen sharing
- Chat
- Recording
- Stream scheduling
- Password-protected rooms
- Viewer authentication
- Adaptive bitrate streaming
- Mobile applications
- Simulcast and SVC for bandwidth optimization
- Stream analytics and monitoring
- Horizontal SFU clustering