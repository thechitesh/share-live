import { useState } from 'react';
import HostView from '../components/HostView';

// ── Icons ──────────────────────────────────────────────────────────────────

const IconBroadcast = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2"/>
    <path d="M4.93 4.93a10 10 0 0 0 0 14.14"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M7.76 7.76a6 6 0 0 0 0 8.48"/>
    <path d="M16.24 7.76a6 6 0 0 1 0 8.48"/>
  </svg>
);

// ── HomePage Component ─────────────────────────────────────────────────────

type Stage = 'landing' | 'broadcasting';

export default function HomePage() {
  const [stage, setStage] = useState<Stage>('landing');
  const [hostName, setHostName] = useState('');
  const [nameError, setNameError] = useState('');

  const handleStart = () => {
    const trimmed = hostName.trim();
    if (!trimmed) {
      setNameError('Please enter your display name');
      return;
    }
    if (trimmed.length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }
    setNameError('');
    setStage('broadcasting');
  };

  const handleExit = () => {
    setStage('landing');
    setHostName('');
  };

  if (stage === 'broadcasting') {
    return (
      <div className="page">
        <header className="home-header">
          <div className="container">
            <div className="home-header-inner">
              <a href="/" className="logo" onClick={handleExit}>
                <IconBroadcast />
                <span>ShareLive</span>
              </a>
              <div className="badge badge-live">
                <div className="pulse-dot" />
                Broadcasting
              </div>
            </div>
          </div>
        </header>
        <main className="home-main">
          <div className="container">
            <HostView hostName={hostName} onExit={handleExit} />
          </div>
        </main>
        <HomeStyles />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="home-header">
        <div className="container">
          <div className="home-header-inner">
            <div className="logo">
              <IconBroadcast />
              <span>ShareLive</span>
            </div>
          </div>
        </div>
      </header>

      <main className="home-main home-hero">
        <div className="container">
          {/* ── Hero Section ─────────────────────────────────────────── */}
          <div className="hero-content animate-slide-up">
            <div className="hero-eyebrow">
              <div className="badge badge-live">
                <div className="pulse-dot" />
                No sign-up required
              </div>
            </div>

            <h1>
              Go live in{' '}
              <span className="text-gradient">seconds</span>
            </h1>

            <p className="hero-subtitle">
              Share your camera and microphone with up to 10 viewers.
              Just enter your name, click Go Live, and share the link.
            </p>

            {/* ── Name Input Card ─────────────────────────────────────── */}
            <div className="card hero-card">
              <div className="hero-card-inner">
                <div className="form-group">
                  <label htmlFor="host-name-input" className="form-label">
                    Your display name
                  </label>
                  <input
                    id="host-name-input"
                    className="input"
                    type="text"
                    placeholder="e.g. Alex Johnson"
                    value={hostName}
                    maxLength={50}
                    onChange={e => {
                      setHostName(e.target.value);
                      if (nameError) setNameError('');
                    }}
                    onKeyDown={e => e.key === 'Enter' && handleStart()}
                    autoFocus
                  />
                  {nameError && (
                    <span className="form-error">{nameError}</span>
                  )}
                </div>

                <button
                  id="start-broadcasting-btn"
                  className="btn btn-primary btn-lg w-full"
                  onClick={handleStart}
                >
                  🔴 Start Broadcasting
                </button>

                <p className="hero-card-note text-sm text-center">
                  Your browser will ask for camera &amp; microphone permission
                </p>
              </div>
            </div>
          </div>

          {/* ── Feature Pills ────────────────────────────────────────── */}
          <div className="hero-features animate-fade-in">
            {[
              { icon: '⚡', label: 'Low latency WebRTC' },
              { icon: '🔒', label: 'No account required' },
              { icon: '👥', label: 'Up to 10 viewers' },
              { icon: '🌐', label: 'Works in any browser' },
            ].map(({ icon, label }) => (
              <div key={label} className="feature-pill">
                <span>{icon}</span>
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <HomeStyles />
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

function HomeStyles() {
  return (
    <style>{`
      .home-header {
        padding: 20px 0;
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 100;
        background: rgba(10, 10, 15, 0.8);
        backdrop-filter: blur(20px);
      }

      .home-header-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .logo {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--text-primary);
        text-decoration: none;
        letter-spacing: -0.01em;
      }

      .logo svg {
        color: var(--accent-red);
      }

      .home-main {
        flex: 1;
        padding: 48px 0 80px;
      }

      .home-hero {
        display: flex;
        align-items: center;
      }

      .hero-content {
        max-width: 640px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .hero-eyebrow {
        display: flex;
      }

      .hero-subtitle {
        font-size: 1.125rem;
        line-height: 1.7;
        color: var(--text-secondary);
      }

      .hero-card {
        padding: 28px;
      }

      .hero-card-inner {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .form-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text-secondary);
      }

      .form-error {
        font-size: 0.8125rem;
        color: var(--accent-red);
      }

      .hero-card-note {
        color: var(--text-muted);
      }

      .hero-features {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: center;
        animation-delay: 0.2s;
        opacity: 0;
        animation-fill-mode: forwards;
      }

      .feature-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: rgba(255,255,255,0.03);
        border: 1px solid var(--border);
        border-radius: var(--radius-full);
        color: var(--text-secondary);
        white-space: nowrap;
        transition: all 0.2s;
      }

      .feature-pill:hover {
        background: rgba(255,255,255,0.06);
        color: var(--text-primary);
        border-color: var(--border-active);
      }
    `}</style>
  );
}
