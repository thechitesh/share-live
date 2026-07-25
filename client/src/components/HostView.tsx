import { useEffect, useRef, useState } from 'react';
import { formatDuration } from '../lib/webrtc';
import { useHostStream } from '../hooks/useHostStream';

// ── Icons (inline SVG) ─────────────────────────────────────────────────────

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

const IconCamera = ({ off }: { off?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34" />
        <path d="M3 3l18 18" />
        <path d="M22 16.92V7a2 2 0 0 0-2-2h-.5" />
        <path d="M16 8l6-4v12" />
      </>
    ) : (
      <>
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </>
    )}
  </svg>
);

const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconStop = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

const IconUsers = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// ── HostView Component ─────────────────────────────────────────────────────

interface HostViewProps {
  hostName: string;
  onExit: () => void;
}

export default function HostView({ hostName, onExit }: HostViewProps) {
  const {
    status,
    shareUrl,
    viewerCount,
    duration,
    isMuted,
    isCameraOff,
    error,
    localVideoRef,
    startPreview,
    startStream,
    stopStream,
    toggleMute,
    toggleCamera,
  } = useHostStream();

  const [copied, setCopied] = useState(false);
  const hasStartedPreview = useRef(false);

  // Start camera preview on mount
  useEffect(() => {
    if (!hasStartedPreview.current) {
      hasStartedPreview.current = true;
      startPreview(hostName);
    }
  }, [startPreview, hostName]);

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleStop = () => {
    stopStream();
    onExit();
  };

  const isLive = status === 'live';
  const isPreviewing = status === 'previewing';
  const isConnecting = status === 'connecting';

  return (
    <div className="host-view">
      {/* ── Video Panel ──────────────────────────────────────────────── */}
      <div className="host-video-panel">
        {/* Camera Off Overlay */}
        {isCameraOff && isLive && (
          <div className="overlay">
            <div className="camera-off-icon">
              <IconCamera off />
            </div>
            <span className="text-secondary">Camera is off</span>
          </div>
        )}

        {/* Requesting media overlay */}
        {status === 'requesting-media' && (
          <div className="overlay">
            <div className="spinner" style={{ width: 36, height: 36 }} />
            <p>Requesting camera access…</p>
          </div>
        )}

        {/* Video Element */}
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={{ transform: 'scaleX(-1)' }} // Mirror for self-view
        />

        {/* Live badge */}
        {isLive && (
          <div className="host-live-badge">
            <div className="badge badge-live">
              <div className="pulse-dot" />
              LIVE
            </div>
            <div className="badge badge-viewers">
              <IconUsers />
              {viewerCount} viewer{viewerCount !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Duration */}
        {isLive && (
          <div className="host-duration">
            <span className="font-mono text-sm">{formatDuration(duration)}</span>
          </div>
        )}
      </div>

      {/* ── Controls Panel ───────────────────────────────────────────── */}
      <div className="host-controls-panel">

        {/* Error state */}
        {error && (
          <div className="error-box" style={{ marginBottom: 16 }}>
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Share URL */}
        {shareUrl && isLive && (
          <div className="share-url-box">
            <div className="share-url-label">Share this link with viewers</div>
            <div className="share-url-row">
              <span className="share-url-text font-mono truncate">{shareUrl}</span>
              <button
                id="copy-link-btn"
                className="btn btn-secondary"
                onClick={handleCopyLink}
                title="Copy link"
              >
                <IconCopy />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Stream controls */}
        <div className="host-media-controls">
          {/* Go Live button */}
          {isPreviewing && (
            <button
              id="go-live-btn"
              className="btn btn-primary btn-lg w-full"
              onClick={startStream}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <div className="spinner" />
                  Connecting…
                </>
              ) : (
                '🔴 Go Live'
              )}
            </button>
          )}

          {/* Live controls */}
          {isLive && (
            <div className="live-controls">
              <button
                id="toggle-mute-btn"
                className={`btn btn-icon ${isMuted ? 'btn-danger' : 'btn-ghost'}`}
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                <IconMic off={isMuted} />
              </button>

              <button
                id="toggle-camera-btn"
                className={`btn btn-icon ${isCameraOff ? 'btn-danger' : 'btn-ghost'}`}
                onClick={toggleCamera}
                title={isCameraOff ? 'Enable camera' : 'Disable camera'}
              >
                <IconCamera off={isCameraOff} />
              </button>

              <button
                id="stop-stream-btn"
                className="btn btn-danger"
                onClick={handleStop}
                style={{ marginLeft: 'auto' }}
              >
                <IconStop />
                End Stream
              </button>
            </div>
          )}

          {/* Stats row */}
          {isLive && (
            <div className="host-stats-row">
              <div className="host-stat">
                <span className="status-dot live" />
                <span className="text-sm text-secondary">Live</span>
              </div>
              <div className="host-stat">
                <span className="text-sm text-secondary">Duration</span>
                <span className="text-sm font-mono">{formatDuration(duration)}</span>
              </div>
              <div className="host-stat">
                <span className="text-sm text-secondary">Viewers</span>
                <span className="text-sm">{viewerCount} / 10</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Styles ──────────────────────────────────────────────────── */}
      <style>{`
        .host-view {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          animation: fade-in 0.5s var(--ease-out);
        }

        .host-video-panel {
          position: relative;
          background: #000;
          border-radius: var(--radius-xl);
          overflow: hidden;
          aspect-ratio: 16 / 9;
          box-shadow: var(--shadow-lg), var(--shadow-glow-red);
          border: 1px solid var(--border);
        }

        .host-video-panel video {
          border-radius: 0;
          object-fit: cover;
        }

        .camera-off-icon {
          width: 64px;
          height: 64px;
          background: rgba(255,255,255,0.05);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
        }

        .host-live-badge {
          position: absolute;
          top: 16px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .host-duration {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(10px);
          padding: 4px 12px;
          border-radius: var(--radius-full);
          color: var(--text-primary);
          border: 1px solid var(--border);
        }

        .host-controls-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .share-url-box {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 16px 20px;
        }

        .share-url-label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin-bottom: 10px;
        }

        .share-url-row {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .share-url-text {
          flex: 1;
          font-size: 0.8125rem;
          color: var(--text-secondary);
          min-width: 0;
        }

        .live-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .host-stats-row {
          display: flex;
          gap: 24px;
          padding: 14px 20px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }

        .host-stat {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .host-media-controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
      `}</style>
    </div>
  );
}
