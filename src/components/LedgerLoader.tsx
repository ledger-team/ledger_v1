'use client'

/**
 * LedgerLoader — animated "ledger" wordmark for loading states.
 *
 * Used during Canvas sync (~15-40s) so the user sees branded motion
 * instead of a blank screen. Transparent background — inherits whatever
 * surface it sits on (dark #0B0B0E or light #FAFAF7). Lime stays constant.
 *
 * Honors prefers-reduced-motion: animation is disabled, wordmark renders
 * static at full opacity.
 *
 * Usage:
 *   {syncing ? <LedgerLoader label="Syncing your courses…" /> : <Dashboard />}
 */

type LedgerLoaderProps = {
  /** Optional caption shown beneath the wordmark. */
  label?: string
  /** Pixel size of the wordmark text. Default 64. */
  size?: number
}

const LETTERS = ['l', 'e', 'd', 'g', 'e', 'r']

// Per-letter x positions tuned for the default 64px weight-800 wordmark.
const X = [40, 68, 108, 150, 192, 232]

export function LedgerLoader({ label, size = 64 }: LedgerLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        minHeight: '60vh',
      }}
    >
      <svg
        width={320}
        viewBox="0 0 320 120"
        role="img"
        aria-label={label ?? 'Loading'}
        style={{ maxWidth: '80vw' }}
      >
        {LETTERS.map((char, i) => (
          <text
            key={i}
            x={X[i]}
            y={80}
            className="ledger-loader-char"
            style={{ animationDelay: `${i * 0.12}s`, fontSize: size }}
          >
            {char}
          </text>
        ))}
      </svg>

      {label && <p className="ledger-loader-label">{label}</p>}

      <style>{`
        @keyframes ledgerLoaderWave {
          0%, 60%, 100% { opacity: 0.25; transform: translateY(0px); }
          30% { opacity: 1; transform: translateY(-6px); }
        }
        .ledger-loader-char {
          font-family: var(--font-sans, -apple-system, BlinkMacSystemFont,
            'Segoe UI', Roboto, sans-serif);
          font-weight: 800;
          fill: #B5FF3D;
          animation: ledgerLoaderWave 1.6s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        .ledger-loader-label {
          font-size: 14px;
          color: var(--muted, #8C8C8E);
          margin: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .ledger-loader-char { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  )
}
