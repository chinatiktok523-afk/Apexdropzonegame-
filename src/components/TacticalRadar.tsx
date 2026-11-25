import React from 'react';
import { HudState } from '../types';

interface TacticalRadarProps {
  hud: HudState;
}

const SIZE = 66;
const HALF = SIZE / 2;

export const TacticalRadar: React.FC<TacticalRadarProps> = React.memo(({ hud }) => {
  const worldRange = hud.radarWorldRange || 44;
  const scale = (HALF - 5) / worldRange;
  const headingRad = (hud.headingDeg * Math.PI) / 180;
  const cosH = Math.cos(headingRad);
  const sinH = Math.sin(headingRad);

  const sweepAngle = (hud.elapsedTime * 115) % 360;

  return (
    <div
      className="relative shrink-0 rounded-full bg-zinc-950/85 border border-amber-400/35 shadow-lg overflow-hidden pointer-events-none"
      style={{ width: SIZE, height: SIZE }}
      aria-label="Tactical Mini-Radar"
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="block">
        <defs>
          <clipPath id="radar-clip">
            <circle cx={HALF} cy={HALF} r={HALF - 1.5} />
          </clipPath>
          <linearGradient id="radar-cone" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Range Rings & Cross Grid */}
        <g clipPath="url(#radar-clip)">
          <circle cx={HALF} cy={HALF} r={HALF - 1.5} fill="#090d14" fillOpacity="0.85" />
          <circle cx={HALF} cy={HALF} r={(HALF - 5) * 0.4} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="0.7" />
          <circle cx={HALF} cy={HALF} r={(HALF - 5) * 0.74} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="0.7" />
          <line x1={HALF} y1={2.5} x2={HALF} y2={SIZE - 2.5} stroke="rgba(255,255,255,0.07)" strokeWidth="0.7" />
          <line x1={2.5} y1={HALF} x2={SIZE - 2.5} y2={HALF} stroke="rgba(255,255,255,0.07)" strokeWidth="0.7" />

          {/* Player Forward View Cone */}
          <path
            d={`M ${HALF} ${HALF} L ${HALF - 19} ${HALF - 28} A 33 33 0 0 1 ${HALF + 19} ${HALF - 28} Z`}
            fill="url(#radar-cone)"
          />

          {/* Subtle Rotating Radar Sweep Line */}
          <line
            x1={HALF}
            y1={HALF}
            x2={HALF}
            y2={3}
            stroke="rgba(56, 189, 248, 0.35)"
            strokeWidth="1"
            transform={`rotate(${sweepAngle} ${HALF} ${HALF})`}
          />

          {/* World-Space Rotated Layer: Cover Obstacles */}
          <g transform={`translate(${HALF} ${HALF}) rotate(${-hud.headingDeg})`}>
            {hud.radarObstacles.map((ob, idx) => {
              const dx = ob.cx - hud.playerX;
              const dz = ob.cz - hud.playerZ;
              if (Math.abs(dx) > worldRange + 16 || Math.abs(dz) > worldRange + 16) return null;
              const rw = Math.max(1.2, ob.w * scale);
              const rd = Math.max(1.2, ob.d * scale);
              return (
                <rect
                  key={idx}
                  x={dx * scale - rw * 0.5}
                  y={dz * scale - rd * 0.5}
                  width={rw}
                  height={rd}
                  rx={0.4}
                  fill="rgba(148, 163, 184, 0.44)"
                  stroke="rgba(226, 232, 240, 0.28)"
                  strokeWidth="0.35"
                />
              );
            })}
          </g>

          {/* Dynamic Blips: POIs, Drops, Vehicles, Allies, Crates, Barrels & Hostiles */}
          {hud.radarBlips.map((blip, idx) => {
            const dx = blip.x - hud.playerX;
            const dz = blip.z - hud.playerZ;
            const localRight = dx * cosH + dz * sinH;
            const localForward = dx * sinH - dz * cosH;

            const dist = Math.hypot(localRight, localForward);
            const clampedDist = Math.min(dist, worldRange - 2);
            const ratio = dist > 0.01 ? clampedDist / dist : 1;

            const bx = HALF + localRight * ratio * scale;
            const by = HALF - localForward * ratio * scale;
            const outOfRange = dist > worldRange - 2;

            if (blip.kind === 'poi') {
              return (
                <circle
                  key={`poi-${idx}`}
                  cx={bx}
                  cy={by}
                  r={1.1}
                  fill="#22d3ee"
                  fillOpacity={outOfRange ? 0.35 : 0.75}
                />
              );
            }

            if (blip.kind === 'drop') {
              return (
                <rect
                  key={`drop-${idx}`}
                  x={bx - 1.7}
                  y={by - 1.7}
                  width={3.4}
                  height={3.4}
                  transform={`rotate(45 ${bx} ${by})`}
                  fill="#facc15"
                  stroke="#090b0f"
                  strokeWidth="0.5"
                />
              );
            }

            if (blip.kind === 'vehicle') {
              if (outOfRange) return null;
              return (
                <rect
                  key={`veh-${idx}`}
                  x={bx - 1.8}
                  y={by - 1.3}
                  width={3.6}
                  height={2.6}
                  rx={0.5}
                  fill="#38bdf8"
                  stroke="#090b0f"
                  strokeWidth="0.45"
                />
              );
            }

            if (blip.kind === 'crate') {
              if (outOfRange) return null;
              return (
                <rect
                  key={`c-${idx}`}
                  x={bx - 1.5}
                  y={by - 1.5}
                  width={3}
                  height={3}
                  transform={`rotate(45 ${bx} ${by})`}
                  fill="#34d399"
                  stroke="#052e16"
                  strokeWidth="0.5"
                />
              );
            }

            if (blip.kind === 'barrel') {
              if (outOfRange) return null;
              return <circle key={`b-${idx}`} cx={bx} cy={by} r={1.1} fill="#fb923c" fillOpacity="0.85" />;
            }

            const r = blip.kind === 'heavy' ? 2.2 : 1.7;
            const opacity = outOfRange && !blip.alert ? 0.35 : blip.alert ? 1 : 0.72;
            return (
              <g key={`e-${idx}`} opacity={opacity}>
                {blip.alert && (
                  <circle
                    cx={bx}
                    cy={by}
                    r={r + 1.4}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="0.7"
                    strokeOpacity="0.65"
                  />
                )}
                <circle
                  cx={bx}
                  cy={by}
                  r={r}
                  fill={blip.kind === 'heavy' ? '#f97316' : '#ef4444'}
                  stroke="#090b0f"
                  strokeWidth="0.5"
                />
              </g>
            );
          })}

          {/* Center Player Direction Arrow */}
          <polygon
            points={`${HALF},${HALF - 3.4} ${HALF - 2.4},${HALF + 2.4} ${HALF},${HALF + 1.1} ${HALF + 2.4},${HALF + 2.4}`}
            fill="#fbbf24"
            stroke="#090b0f"
            strokeWidth="0.5"
          />
        </g>

        {/* Outer Bezel + North Indicator */}
        <circle cx={HALF} cy={HALF} r={HALF - 1} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        <g transform={`translate(${HALF} ${HALF}) rotate(${-hud.headingDeg})`}>
          <text
            x={0}
            y={-(HALF - 6)}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fbbf24"
            fontSize="6.5"
            fontWeight="700"
            fontFamily="monospace"
          >
            N
          </text>
        </g>
      </svg>
    </div>
  );
});
