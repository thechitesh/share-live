// ── WebRTC Configuration ──────────────────────────────────────────────────

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Add TURN server config here if needed:
  // {
  //   urls: 'turn:your-turn-server.com:3478',
  //   username: 'user',
  //   credential: 'password'
  // }
];

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

// ── Media Constraints ─────────────────────────────────────────────────────

export const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width:     { ideal: 1280, max: 1920 },
  height:    { ideal: 720,  max: 1080 },
  frameRate: { ideal: 30,   max: 60 },
  facingMode: 'user',
};

export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl:  true,
  sampleRate:       { ideal: 48000 },
  channelCount:     { ideal: 2 },
};

// ── Utility ───────────────────────────────────────────────────────────────

/**
 * Get the local media stream from the user's camera and microphone.
 * Falls back to audio-only if video is denied.
 */
export async function getUserMedia(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: VIDEO_CONSTRAINTS,
      audio: AUDIO_CONSTRAINTS,
    });
  } catch (err) {
    // If video is denied, try audio only
    if ((err as DOMException).name === 'NotAllowedError') {
      throw err;
    }
    return await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: AUDIO_CONSTRAINTS,
    });
  }
}

/**
 * Creates a configured RTCPeerConnection.
 */
export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(RTC_CONFIG);
}

/**
 * Add all tracks from a stream to a peer connection.
 */
export function addStreamToPeer(pc: RTCPeerConnection, stream: MediaStream) {
  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });
}

/**
 * Encode a room ID-safe string.
 */
export function isValidRoomId(roomId: string): boolean {
  return /^[a-zA-Z0-9_-]{6,20}$/.test(roomId);
}

/**
 * Format seconds as mm:ss.
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Create the share URL for a room.
 */
export function makeShareUrl(roomId: string): string {
  return `${window.location.origin}/live/${roomId}`;
}
