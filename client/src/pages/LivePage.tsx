import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ViewerView from '../components/ViewerView';

// ── LivePage Component ─────────────────────────────────────────────────────

export default function LivePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Validate room ID format before connecting
  useEffect(() => {
    if (!roomId || !/^[a-zA-Z0-9_-]{6,20}$/.test(roomId)) {
      setValidationError('Invalid room ID');
      setIsValidating(false);
      return;
    }

    // Quick REST check to get room metadata before connecting
    fetch(`/api/rooms/${roomId}`)
      .then(async res => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Room not found');
        }
        return res.json();
      })
      .then(() => {
        setIsValidating(false);
      })
      .catch(err => {
        setValidationError(err.message || 'Room not found');
        setIsValidating(false);
      });
  }, [roomId]);

  if (!roomId) {
    return null;
  }

  return (
    <div className="page">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="live-header">
        <div className="container">
          <div className="live-header-inner">
            <a href="/" className="logo-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="2"/>
                <path d="M4.93 4.93a10 10 0 0 0 0 14.14"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                <path d="M7.76 7.76a6 6 0 0 0 0 8.48"/>
                <path d="M16.24 7.76a6 6 0 0 1 0 8.48"/>
              </svg>
              <span>ShareLive</span>
            </a>

            <div className="live-room-id">
              <span className="text-xs text-muted">Room</span>
              <span className="text-sm font-mono">{roomId}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="live-main">
        <div className="container">
          {isValidating ? (
            <div className="live-loading animate-fade-in">
              <div className="spinner" style={{ width: 36, height: 36 }} />
              <p>Joining stream…</p>
            </div>
          ) : validationError ? (
            <div className="live-error-state animate-slide-up">
              <div className="live-error-icon">🔍</div>
              <h2>Stream Not Found</h2>
              <p>{validationError}. The link may be invalid or expired.</p>
              <button
                className="btn btn-secondary"
                onClick={() => navigate('/')}
                style={{ marginTop: 16 }}
              >
                Go to Home
              </button>
            </div>
          ) : (
            <ViewerView roomId={roomId} />
          )}
        </div>
      </main>

      <style>{`
        .live-header {
          padding: 16px 0;
          border-bottom: 1px solid var(--border);
          background: rgba(10, 10, 15, 0.85);
          backdrop-filter: blur(20px);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .live-header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .logo-link {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          text-decoration: none;
          letter-spacing: -0.01em;
        }

        .logo-link svg {
          color: var(--accent-red);
        }

        .live-room-id {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
        }

        .live-main {
          flex: 1;
          padding: 32px 0 64px;
          display: flex;
          flex-direction: column;
        }

        .live-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          min-height: 400px;
          color: var(--text-secondary);
        }

        .live-error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-height: 400px;
          text-align: center;
          max-width: 400px;
          margin: 0 auto;
        }

        .live-error-icon {
          font-size: 3rem;
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}
