'use client'

/**
 * LedgerLoader — animated "ledger" wordmark for loading states.
 *
 * Used during Canvas sync (~15-40s) so the user sees branded motion instead of
 * a blank screen. Transparent background — inherits whatever surface it sits on
 * (dark #0B0B0E or light #FAFAF7). Lime stays constant.
 *
 * Layout is flexbox per-letter spans — NOT absolute SVG x-coordinates — so it
 * never goes lopsided across fonts / font-load timing / environments.
 *
 * Honors prefers-reduced-motion: animation off, wordmark static at full opacity.
 *
 * Usage:
 *   {syncing ? <LedgerLoader label="Syncing your courses…" /> : <Dashboard />}
 */

type LedgerLoaderProps = {
  /** Optional caption shown beneath the wordmark. */
  label?: string
  /** Font size (px) of the wordmark letters. Default 56. */
  size?: number
}

const LETTERS = ['l', 'e', 'd', 'g', 'e', 'r']

export function LedgerLoader({ label, size = 56 }: LedgerLoaderProps) {
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
      <div role="img" aria-label={label ?? 'Loading'} style={{ display: 'flex' }}>
        {LETTERS.map((char, i) => (
          <span
            key={i}
            className="ledger-loader-char"
            style={{ animationDelay: `${i * 0.12}s`, fontSize: size }}
          >
            {char}
          </span>
        ))}
      </div>

      {label && <p className="ledger-loader-label">{label}</p>}

      <style>{`
        @keyframes ledgerLoaderWave {
          0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-6px); }
        }
        .ledger-loader-char {
          display: inline-block;
          font-family: var(--font-sans, -apple-system, BlinkMacSystemFont,
            'Segoe UI', Roboto, sans-serif);
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.01em;
          color: #B5FF3D;
          animation: ledgerLoaderWave 1.6s ease-in-out infinite;
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
