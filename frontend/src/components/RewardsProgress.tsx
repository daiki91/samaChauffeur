import { useEffect, useRef, useState } from 'react'

type Props = {
  totalDistanceKm: number
  lastCheckpointKm: number
  nextCheckpointKm: number
  compact?: boolean
}

// A gentle S-curve rather than a straight line — reads as"a road", not a progress bar.
const ROAD_PATH = 'M 10 65 C 100 15, 170 115, 260 60 S 400 10, 460 65'

/**"Mini car on a winding road"progress visual for the km-based gift/checkpoint system.
 * The road itself draws in on mount (animate-road-draw, index.css) to suggest it keeps
 * going beyond what's shown; the car's position along it reflects real progress towards
 * the next checkpoint and glides smoothly whenever that progress changes. */
export default function RewardsProgress({ totalDistanceKm, lastCheckpointKm, nextCheckpointKm, compact = false }: Props) {
  const roadRef = useRef<SVGPathElement>(null)
  const [pathLength, setPathLength] = useState(0)
  const [carPoint, setCarPoint] = useState<{ x: number; y: number } | null>(null)

  const span = Math.max(0.001, nextCheckpointKm - lastCheckpointKm)
  const progressRatio = Math.min(1, Math.max(0, (totalDistanceKm - lastCheckpointKm) / span))
  const remainingKm = Math.max(0, nextCheckpointKm - totalDistanceKm)

  useEffect(() => {
    if (roadRef.current) setPathLength(roadRef.current.getTotalLength())
  }, [])

  useEffect(() => {
    if (!roadRef.current || !pathLength) return
    // The car only travels the first ~72% of the drawn path — the remaining stretch stays
    // visible but untouched, reinforcing that the road (and the checkpoints after this one)
    // continues further than what's drawn here.
    const travel = pathLength * 0.72 * progressRatio
    setCarPoint(roadRef.current.getPointAtLength(travel))
  }, [pathLength, progressRatio])

  const height = compact ? 100 : 140

  return (
    <div className="w-full">
      <svg viewBox={`0 0 470 ${height}`} className="w-full overflow-visible" style={{ height }}>
        <path d={ROAD_PATH} fill="none" strokeWidth={10} strokeLinecap="round" className="stroke-stone-200" />
        <path ref={roadRef} d={ROAD_PATH} fill="none" strokeWidth={10} strokeLinecap="round" className="stroke-brand-400 animate-road-draw" style={pathLength ? ({ '--road-length': pathLength, strokeDasharray: pathLength } as React.CSSProperties) : undefined} />
        <path d={ROAD_PATH} fill="none" stroke="white" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="5 9" className="" />

        <circle cx={10} cy={65} r={7} className="fill-secondary-500" />

        <g transform="translate(460, 65)" className="animate-checkpoint-pop">
          <circle r={11} strokeWidth={2} className="fill-white stroke-brand-400" />
          <text x={0} y={5} textAnchor="middle" fontSize={13}>
            🚩
          </text>
        </g>
        <text x={468} y={69} fontSize={16} className="fill-stone-300">
          ⋯
        </text>

        {carPoint && (
          <g transform={`translate(${carPoint.x}, ${carPoint.y})`} style={{ transition: 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}>
            <text x={0} y={7} textAnchor="middle" fontSize={22}>
              🚗
            </text>
          </g>
        )}
      </svg>
      <div className="flex items-center justify-between text-xs text-stone-500 -mt-1 px-2">
        <span>{lastCheckpointKm.toFixed(0)} km</span>
        <span className="font-medium text-brand-600">{remainingKm < 0.05 ? 'Checkpoint atteint !' : `Encore ${remainingKm.toFixed(1)} km`}</span>
        <span>{nextCheckpointKm.toFixed(0)} km</span>
      </div>
    </div>
  )
}
