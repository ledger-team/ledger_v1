// Inline SVG sparkline. No chart library — this is a polyline over N points and
// pulling in a dependency for it would cost more than it saves.
//
// currentColor throughout, so the caller sets tone via a text- class.

export function Sparkline({
  points,
  width = 64,
  height = 20,
}: {
  points: number[]
  width?: number
  height?: number
}) {
  if (points.length < 2) return null

  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1 // a flat line would divide by zero
  const step = width / (points.length - 1)

  // Inset by 1px top and bottom so the stroke isn't clipped at the extremes.
  const y = (v: number) => height - 1 - ((v - min) / span) * (height - 2)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  const lastX = width
  const lastY = y(points[points.length - 1]!)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
      className="overflow-visible"
    >
      <path d={path} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.65" />
      <circle cx={lastX} cy={lastY} r="2" fill="currentColor" />
    </svg>
  )
}
