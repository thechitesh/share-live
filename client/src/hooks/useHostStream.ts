import { useCallback, useEffect, useRef, useState } from 'react';
import { createPeerConnection, addStreamToPeer, getUserMedia } from '../lib/webrtc';

// ── Types ─────────────────────────────────────────────────────────────────

export type HostStatus = 'idle' | 'requesting-media' | 'previewing' | 'connecting' | 'live' | 'error';

interface HostStreamState {
  status: HostStatus;
  localStream: MediaStream | null;
  shareUrl: string | null;
  roomId: string | null;
  viewerCount: number;
  duration: number;
  isMuted: boolean;
  isCameraOff: boolean;
  error: string | null;
}

interface UseHostStreamReturn extends HostStreamState {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  startPreview: (hostName: string) => Promise<void>;
  startStream: () => Promise<void>;
  stopStream: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

// ── Hook ──────────────────────────────────────────────────────────────────

export function useHostStream(): UseHostStreamReturn {
  const [state, setState] = useState<HostStreamState>({
    status: 'idle',
    localStream: null,
    shareUrl: null,
    roomId: null,
    viewerCount: 0,
    duration: 0,
    isMuted: false,
    isCameraOff: false,
    error: null,
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const hostNameRef = useRef<string>('');
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clientIdRef = useRef<string | null>(null);

  // ── Peer Connection Factory ───────────────────────────────────────────

  const createViewerPeer = useCallback((viewerId: string): RTCPeerConnection => {
    const existing = peerConnections.current.get(viewerId);
    if (existing) {
      existing.close();
    }

    const pc = createPeerConnection();

    // Add all local tracks to this viewer's peer connection
    if (streamRef.current) {
      addStreamToPeer(pc, streamRef.current);
    }

    // ICE candidate handling
    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: e.candidate.toJSON(),
          viewerId,
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Host] ICE state for viewer ${viewerId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[Host] Connection state for viewer ${viewerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        peerConnections.current.delete(viewerId);
        pendingCandidates.current.delete(viewerId);
      }
    };

    peerConnections.current.set(viewerId, pc);
    return pc;
  }, []);

  // ── Offer to Viewer ────────────────────────────────────────────────────

  const sendOfferToViewer = useCallback(async (viewerId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const pc = createViewerPeer(viewerId);

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      wsRef.current.send(JSON.stringify({
        type: 'offer',
        offer: pc.localDescription,
        viewerId,
      }));
    } catch (err) {
      console.error('[Host] Failed to create offer for viewer:', viewerId, err);
    }
  }, [createViewerPeer]);

  // ── WebSocket Setup ───────────────────────────────────────────────────

  const setupWebSocket = useCallback((roomId: string, hostName: string) => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Host] WS connected');
      ws.send(JSON.stringify({ type: 'host:join', roomId, hostName }));
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'connected':
          clientIdRef.current = msg.clientId;
          break;

        case 'host:joined':
          setState(prev => ({
            ...prev,
            status: 'live',
            viewerCount: msg.viewerCount ?? 0,
          }));

          // Start duration timer
          durationTimerRef.current = setInterval(() => {
            setState(prev => ({ ...prev, duration: prev.duration + 1 }));
          }, 1000);
          break;

        case 'viewer:ready':
          // A new viewer joined; host needs to send them an offer
          await sendOfferToViewer(msg.viewerId);
          break;

        case 'answer':
          // Viewer sent back an answer
          {
            const pc = peerConnections.current.get(msg.viewerId);
            if (pc && (pc.signalingState === 'have-local-offer' || pc.signalingState === 'stable')) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
                // Drain queued ICE candidates
                const queued = pendingCandidates.current.get(msg.viewerId) || [];
                for (const candidate of queued) {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
                }
                pendingCandidates.current.delete(msg.viewerId);
              } catch (e) {
                console.error('[Host] Error setting remote answer', e);
              }
            }
          }
          break;

        case 'ice-candidate':
          // ICE candidate from a viewer
          {
            const pc = peerConnections.current.get(msg.viewerId);
            if (pc && msg.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
              } catch (e) {
                console.warn('[Host] Failed to add ICE candidate', e);
              }
            }
          }
          break;

        case 'viewer-count':
          setState(prev => ({ ...prev, viewerCount: msg.count }));
          break;

        case 'error':
          setState(prev => ({ ...prev, error: msg.message, status: 'error' }));
          break;
      }
    };

    ws.onerror = () => {
      setState(prev => ({ ...prev, error: 'WebSocket connection error', status: 'error' }));
    };

    ws.onclose = () => {
      console.log('[Host] WS disconnected');
    };
  }, [sendOfferToViewer]);

  // ── Public API ─────────────────────────────────────────────────────────

  const startPreview = useCallback(async (hostName: string) => {
    setState(prev => ({ ...prev, status: 'requesting-media', error: null }));
    hostNameRef.current = hostName;

    try {
      const stream = await getUserMedia();
      streamRef.current = stream;

      setState(prev => ({ ...prev, status: 'previewing', localStream: stream }));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      const domErr = err as DOMException;
      let message = 'Failed to access camera/microphone.';
      if (domErr.name === 'NotAllowedError') {
        message = 'Camera and microphone permission is required to go live.';
      } else if (domErr.name === 'NotFoundError') {
        message = 'No camera or microphone found.';
      }
      setState(prev => ({ ...prev, status: 'error', error: message }));
    }
  }, []);

  const startStream = useCallback(async () => {
    if (!streamRef.current) return;
    setState(prev => ({ ...prev, status: 'connecting', error: null }));

    try {
      // Create room via REST
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: hostNameRef.current }),
      });

      if (!res.ok) throw new Error('Failed to create room');

      const { roomId, shareUrl } = await res.json();
      roomIdRef.current = roomId;

      setState(prev => ({
        ...prev,
        roomId,
        shareUrl,
      }));

      // Connect WebSocket and join as host
      setupWebSocket(roomId, hostNameRef.current);
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'Failed to start stream. Is the server running?',
      }));
    }
  }, [setupWebSocket]);

  const stopStream = useCallback(() => {
    // Notify server
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'host:leave' }));
      wsRef.current.close();
    }

    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    // Stop local media tracks
    streamRef.current?.getTracks().forEach(t => t.stop());

    // Clear timer
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);

    setState({
      status: 'idle',
      localStream: null,
      shareUrl: null,
      roomId: null,
      viewerCount: 0,
      duration: 0,
      isMuted: false,
      isCameraOff: false,
      error: null,
    });
  }, []);

  const toggleMute = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setState(prev => ({ ...prev, isMuted: !audioTrack.enabled }));
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setState(prev => ({ ...prev, isCameraOff: !videoTrack.enabled }));
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────

  // Attach stream to video element when it becomes available
  useEffect(() => {
    if (localVideoRef.current && state.localStream) {
      localVideoRef.current.srcObject = state.localStream;
    }
  }, [state.localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    localVideoRef,
    startPreview,
    startStream,
    stopStream,
    toggleMute,
    toggleCamera,
  };
}
