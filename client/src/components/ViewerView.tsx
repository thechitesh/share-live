import { useEffect, useState } from 'react';
import { useViewerStream } from '../hooks/useViewerStream';

// ── Icons ──────────────────────────────────────────────────────────────────

const IconMic = ({ off }: { off?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </>
    ) : (
      <>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </>
    )}
  </svg>
);

const IconLeave = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconFullscreen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);

const IconAspect = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M7 15h4v-4" />
    <path d="M17 9h-4v4" />
  </svg>
);

// ── ViewerView Component ───────────────────────────────────────────────────

interface ViewerViewProps {
  roomId: string;
}

export default function ViewerView({ roomId }: ViewerViewProps) {
  const {
    status,
    hostName,
    viewerCount,
    isMicOn,
    error,
    remoteVideoRef,
    toggleMic,
    leaveRoom,
  } = useViewerStream(roomId);

  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [videoFit, setVideoFit] = useState<'cover' | 'contain'>('cover');
  const [aspectRatio, setAspectRatio] = useState<string>('16 / 9');

  // Autoplay workaround: click to play if blocked by browser policy
  useEffect(() => {
    const vid = remoteVideoRef.current;
    if (vid && status === 'live') {
      vid.play().then(() => {
        setIsAutoplayBlocked(false);
      }).catch((err) => {
        console.warn('Autoplay blocked by browser policy:', err);
        setIsAutoplayBlocked(true);
      });
    }
  }, [status, remoteVideoRef]);

  const handleManualPlay = () => {
    const vid = remoteVideoRef.current;
    if (vid) {
      vid.play().then(() => setIsAutoplayBlocked(false)).catch(console.error);
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    if (vid.videoWidth && vid.videoHeight) {
      if (vid.videoHeight > vid.videoWidth) {
        // Portrait stream (e.g. mobile phone) -> Use native aspect ratio
        setAspectRatio(`${vid.videoWidth} / ${vid.videoHeight}`);
      } else {
        setAspectRatio('16 / 9');
      }
    }
  };

  const toggleVideoFit = () => {
    setVideoFit(prev => prev === 'contain' ? 'cover' : 'contain');
  };

  const toggleFullscreen = () => {
    const stage = remoteVideoRef.current?.parentElement;
    if (!stage) return;
    if (!document.fullscreenElement) {
      stage.requestFullscreen().catch(console.warn);
    } else {
      document.exitFullscreen().catch(console.warn);
    }
  };

  const isLive = status === 'live';

  return (
    <div className="viewer-view">
      {/* ── Video Stage ───────────────────────────────────────────────── */}
      <div className="viewer-video-stage" style={{ aspectRatio }}>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={false}
          onLoadedMetadata={handleLoadedMetadata}
          style={{ objectFit: videoFit }}
        />

        {/* Overlays based on status */}
        {isAutoplayBlocked && (
          <div className="overlay animate-fade-in" style={{ cursor: 'pointer' }} onClick={handleManualPlay}>
            <div className="ended-icon">🔊</div>
            <h3>Click to Play Stream</h3>
            <p className="text-sm opacity-60">Your browser blocked automatic audio playback</p>
            <button className="btn btn-primary" style={{ marginTop: 8 }}>
              ▶ Play Stream
            </button>
          </div>
        )}

        {status === 'connecting' && !isAutoplayBlocked && (
          <div className="overlay animate-fade-in">
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <p>Connecting to stream…</p>
          </div>
        )}

        {status === 'waiting' && (
          <div className="overlay animate-fade-in">
            <div className="viewer-pulse-icon">
              <div className="pulse-ring" />
              <span>🎙️</span>
            </div>
            <h3>{hostName ? `${hostName} is about to go live` : 'Waiting for host…'}</h3>
            <p className="text-sm opacity-60">The stream will begin shortly</p>
          </div>
        )}

        {status === 'reconnecting' && (
          <div className="overlay animate-fade-in">
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <h3>Reconnecting…</h3>
            <p className="text-sm opacity-60">Please wait</p>
          </div>
        )}

        {status === 'left' && (
          <div className="overlay animate-fade-in">
            <div className="ended-icon">👋</div>
            <h3>You have left the stream</h3>
            <p className="text-sm opacity-60">Thank you for watching</p>
            <div className="flex gap-3" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                Rejoin Stream
              </button>
              <a href="/" className="btn btn-secondary">
                Go Home
              </a>
            </div>
          </div>
        )}

        {status === 'stream-ended' && (
          <div className="overlay animate-fade-in">
            <div className="ended-icon">📺</div>
            <h3>Stream has ended</h3>
            <p className="text-sm opacity-60">This stream is no longer available</p>
            <a href="/" className="btn btn-secondary" style={{ marginTop: 8 }}>
              Go Home
            </a>
          </div>
        )}

        {status === 'not-found' && (
          <div className="overlay animate-fade-in">
            <div className="ended-icon">🔍</div>
            <h3>Room not found</h3>
            <p className="text-sm opacity-60">Invalid or expired room link</p>
            <a href="/" className="btn btn-secondary" style={{ marginTop: 8 }}>
              Go Home
            </a>
          </div>
        )}

        {status === 'full' && (
          <div className="overlay animate-fade-in">
            <div className="ended-icon">🚫</div>
            <h3>Stream is full</h3>
            <p className="text-sm opacity-60">Maximum 10 viewers reached</p>
            <a href="/" className="btn btn-secondary" style={{ marginTop: 8 }}>
              Go Home
            </a>
          </div>
        )}

        {status === 'error' && (
          <div className="overlay animate-fade-in">
            <div className="ended-icon">⚠️</div>
            <h3>Connection lost</h3>
            <p className="text-sm opacity-60">{error || 'An error occurred'}</p>
            <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        )}

        {/* Live HUD (shown when actually playing) */}
        {isLive && (
          <>
            <div className="viewer-hud-top">
              <div className="badge badge-live">
                <div className="pulse-dot" />
                LIVE
              </div>
              {hostName && (
                <div className="viewer-hostname glass" style={{ padding: '4px 12px', fontSize: '0.8125rem' }}>
                  {hostName}
                </div>
              )}
            </div>

            <div className="viewer-hud-bottom">
              <div className="viewer-connection-pill glass">
                <div className="status-dot connected" />
                <span className="text-sm">Connected</span>
                {viewerCount > 0 && (
                  <span className="text-sm opacity-60">· {viewerCount} watching</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Viewer Control Bar ────────────────────────────────────────── */}
      {isLive && (
        <div className="viewer-control-bar glass" style={{ marginTop: 16, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-3">
            <button
              className={`btn ${isMicOn ? 'btn-primary' : 'btn-secondary'}`}
              onClick={toggleMic}
              title={isMicOn ? 'Mute microphone' : 'Unmute microphone to speak'}
            >
              <IconMic off={!isMicOn} />
              <span>{isMicOn ? 'Mute Mic' : 'Speak / Unmute'}</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={toggleVideoFit}
              title={videoFit === 'cover' ? 'Fit stream in frame' : 'Fill frame (Zoom)'}
            >
              <IconAspect />
              <span>{videoFit === 'cover' ? 'Fit' : 'Fill'}</span>
            </button>

            <button
              className="btn btn-secondary btn-icon"
              onClick={toggleFullscreen}
              title="Fullscreen"
            >
              <IconFullscreen />
            </button>
          </div>

          <button
            className="btn btn-danger"
            onClick={leaveRoom}
            title="Leave Stream"
          >
            <IconLeave />
            <span>Leave Stream</span>
          </button>
        </div>
      )}

      {/* ── Styles ──────────────────────────────────────────────────── */}
      <style>{`
        .viewer-view {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          animation: fade-in 0.5s var(--ease-out);
        }

        .viewer-video-stage {
          position: relative;
          background: #000;
          border-radius: var(--radius-xl);
          overflow: hidden;
          width: 100%;
          max-height: 80vh;
          box-shadow: var(--shadow-lg);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s var(--ease-out);
        }

        .viewer-video-stage video {
          border-radius: 0;
          object-fit: contain;
          background: #000;
        }

        .viewer-hud-top {
          position: absolute;
          top: 16px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 5;
        }

        .viewer-hud-bottom {
          position: absolute;
          bottom: 16px;
          left: 16px;
          z-index: 5;
        }

        .viewer-connection-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          font-size: 0.8125rem;
        }

        .viewer-hostname {
          border-radius: var(--radius-full);
        }

        .viewer-pulse-icon {
          position: relative;
          width: 72px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
        }

        .pulse-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid var(--accent-red);
          animation: pulse-ring 2s ease-out infinite;
        }

        @keyframes pulse-ring {
          0%   { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }

        .ended-icon {
          font-size: 3rem;
          line-height: 1;
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
}
