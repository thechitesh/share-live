import { useEffect } from 'react';
import { useViewerStream } from '../hooks/useViewerStream';

// ── Icons ──────────────────────────────────────────────────────────────────

// ── ViewerView Component ───────────────────────────────────────────────────

interface ViewerViewProps {
  roomId: string;
}

export default function ViewerView({ roomId }: ViewerViewProps) {
  const {
    status,
    hostName,
    viewerCount,
    error,
    remoteVideoRef,
  } = useViewerStream(roomId);

  // Autoplay workaround: click to play on mobile
  useEffect(() => {
    const vid = remoteVideoRef.current;
    if (vid && status === 'live') {
      vid.play().catch(() => {
        // Autoplay blocked — will need user gesture
      });
    }
  }, [status, remoteVideoRef]);

  const isLive = status === 'live';

  return (
    <div className="viewer-view">
      {/* ── Video Stage ───────────────────────────────────────────────── */}
      <div className="viewer-video-stage">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={false}
        />

        {/* Overlays based on status */}
        {status === 'connecting' && (
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

      {/* ── Styles ──────────────────────────────────────────────────── */}
      <style>{`
        .viewer-view {
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          animation: fade-in 0.5s var(--ease-out);
        }

        .viewer-video-stage {
          position: relative;
          background: #000;
          border-radius: var(--radius-xl);
          overflow: hidden;
          aspect-ratio: 16 / 9;
          box-shadow: var(--shadow-lg);
          border: 1px solid var(--border);
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
