import { useCallback, useEffect, useRef, useState } from 'react';
import { createPeerConnection } from '../lib/webrtc';

// ── Types ─────────────────────────────────────────────────────────────────

export type ViewerStatus =
  | 'connecting'
  | 'waiting'
  | 'live'
  | 'reconnecting'
  | 'stream-ended'
  | 'not-found'
  | 'full'
  | 'error';

interface ViewerStreamState {
  status: ViewerStatus;
  remoteStream: MediaStream | null;
  hostName: string | null;
  viewerCount: number;
  error: string | null;
}

interface UseViewerStreamReturn extends ViewerStreamState {
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  disconnect: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1500; // ms

// ── Hook ──────────────────────────────────────────────────────────────────

export function useViewerStream(roomId: string): UseViewerStreamReturn {
  const [state, setState] = useState<ViewerStreamState>({
    status: 'connecting',
    remoteStream: null,
    hostName: null,
    viewerCount: 0,
    error: null,
  });

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManualDisconnect = useRef(false);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // ── WebRTC Peer Connection ────────────────────────────────────────────

  const createPC = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = createPeerConnection();
    pcRef.current = pc;

    // Collect incoming tracks into a MediaStream
    const stream = new MediaStream();
    remoteStreamRef.current = stream;

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach(track => {
        stream.addTrack(track);
      });

      setState(prev => ({ ...prev, remoteStream: stream, status: 'live' }));

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: e.candidate.toJSON(),
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`[Viewer] ICE state: ${state}`);
      if (state === 'failed') {
        pc.restartIce();
      }
      if (state === 'disconnected') {
        setState(prev => ({ ...prev, status: 'reconnecting' }));
      }
      if (state === 'connected' || state === 'completed') {
        setState(prev => ({ ...prev, status: 'live' }));
      }
    };

    return pc;
  }, []);

  // ── WebSocket Connection ───────────────────────────────────────────────

  const connect = useCallback(() => {
    if (isManualDisconnect.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Viewer] WS connected');
      reconnectAttempts.current = 0;
      ws.send(JSON.stringify({ type: 'viewer:join', roomId }));
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'viewer:joined':
          setState(prev => ({
            ...prev,
            hostName: msg.hostName,
            status: msg.status === 'LIVE' ? 'waiting' : 'waiting',
          }));
          createPC();
          break;

        case 'offer':
          // Host sent us an SDP offer — create answer
          {
            const pc = createPC();
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              ws.send(JSON.stringify({
                type: 'answer',
                answer: pc.localDescription,
              }));
            } catch (err) {
              console.error('[Viewer] Failed to handle offer:', err);
            }
          }
          break;

        case 'ice-candidate':
          if (pcRef.current && msg.candidate) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (e) {
              console.warn('[Viewer] Failed to add ICE candidate', e);
            }
          }
          break;

        case 'viewer-count':
          setState(prev => ({ ...prev, viewerCount: msg.count }));
          break;

        case 'stream-started':
          setState(prev => ({ ...prev, status: 'waiting' }));
          break;

        case 'stream-ended':
          setState(prev => ({ ...prev, status: 'stream-ended' }));
          break;

        case 'error':
          if (msg.message === 'Room not found') {
            setState(prev => ({ ...prev, status: 'not-found', error: msg.message }));
          } else if (msg.message?.includes('full')) {
            setState(prev => ({ ...prev, status: 'full', error: msg.message }));
          } else {
            setState(prev => ({ ...prev, status: 'error', error: msg.message }));
          }
          break;
      }
    };

    ws.onerror = () => {
      console.error('[Viewer] WS error');
    };

    ws.onclose = () => {
      console.log('[Viewer] WS disconnected');

      if (!isManualDisconnect.current) {
        const attempts = reconnectAttempts.current;
        if (attempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_BASE_DELAY * Math.pow(1.5, attempts);
          console.log(`[Viewer] Reconnecting in ${delay}ms (attempt ${attempts + 1})`);
          setState(prev => {
            if (prev.status === 'stream-ended' || prev.status === 'not-found') return prev;
            return { ...prev, status: 'reconnecting' };
          });
          reconnectTimer.current = setTimeout(() => {
            reconnectAttempts.current += 1;
            connect();
          }, delay);
        } else {
          setState(prev => ({ ...prev, status: 'error', error: 'Connection lost. Please refresh.' }));
        }
      }
    };
  }, [roomId, createPC]);

  // ── Public API ─────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    isManualDisconnect.current = true;

    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);

    wsRef.current?.close();
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && state.remoteStream) {
      remoteVideoRef.current.srcObject = state.remoteStream;
    }
  }, [state.remoteStream]);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  return {
    ...state,
    remoteVideoRef,
    disconnect,
  };
}
