'use client';

import { useEffect, useRef, useState } from 'react';

// Centre of the SVG canvas
const CX = 240;
const CY = 240;

// Orbit radii
const R_INNER = 90;
const R_OUTER = 158;

// Hexagon vertices centred at origin
function hexPoints(r: number, offsetAngle = 0): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + (offsetAngle * Math.PI) / 180;
    return `${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)}`;
  }).join(' ');
}

const GOLD_NODES = [
  { label: 'REGISTER', angleDeg: -90 },
  { label: 'CONSENT',  angleDeg: 0 },
  { label: 'LICENSE',  angleDeg: 90 },
  { label: 'VERIFY',   angleDeg: 180 },
];

const BLUE_NODES = [
  { label: 'GPG 45',  angleDeg: -90 },
  { label: 'eIDAS',   angleDeg: -30 },
  { label: 'W3C‑VC',  angleDeg: 30 },
  { label: 'GDPR',    angleDeg: 90 },
  { label: 'SAG',     angleDeg: 150 },
  { label: 'ISO',     angleDeg: 210 },
];

function toXY(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: +(r * Math.cos(rad)).toFixed(3), y: +(r * Math.sin(rad)).toFixed(3) };
}

export default function IdentityVisual() {
  const [active, setActive] = useState(false);
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setActive(true); },
      { rootMargin: '-40px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      viewBox="0 0 480 480"
      aria-hidden
      className="identity-visual w-full h-full max-w-[500px] select-none"
    >
      <defs>
        {/* Ambient glow */}
        <radialGradient id="iv-ambient" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="hsl(224,76%,55%)" stopOpacity="0.18" />
          <stop offset="60%"  stopColor="hsl(224,76%,50%)" stopOpacity="0.06" />
          <stop offset="100%" stopColor="hsl(224,76%,50%)" stopOpacity="0" />
        </radialGradient>

        {/* Gold gradient */}
        <linearGradient id="iv-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="hsl(40,80%,34%)" />
          <stop offset="45%"  stopColor="hsl(44,92%,62%)" />
          <stop offset="100%" stopColor="hsl(40,80%,34%)" />
        </linearGradient>

        {/* Blue node fill */}
        <radialGradient id="iv-node-blue" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="hsl(222,55%,18%)" />
          <stop offset="100%" stopColor="hsl(222,60%,10%)" />
        </radialGradient>

        {/* Gold node fill */}
        <radialGradient id="iv-node-gold" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="hsl(222,52%,16%)" />
          <stop offset="100%" stopColor="hsl(222,60%,9%)" />
        </radialGradient>

        {/* Centre hex fill */}
        <radialGradient id="iv-centre" cx="35%" cy="30%" r="75%">
          <stop offset="0%"   stopColor="hsl(224,50%,20%)" />
          <stop offset="100%" stopColor="hsl(222,60%,8%)" />
        </radialGradient>

        {/* Glow filter for centre hex */}
        <filter id="iv-glow-gold" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Soft glow for orbit rings */}
        <filter id="iv-ring-glow" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Node shadow/depth */}
        <filter id="iv-node-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="hsl(222,60%,5%)" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* ── Ambient background glow ───────────────────────────────────────── */}
      <circle cx={CX} cy={CY} r="200" fill="url(#iv-ambient)" />

      {/* ── Outer orbit ring ─────────────────────────────────────────────── */}
      <circle
        cx={CX} cy={CY} r={R_OUTER}
        fill="none"
        stroke="hsl(224,76%,55%)"
        strokeOpacity="0.2"
        strokeWidth="1"
        strokeDasharray="2 10"
        filter="url(#iv-ring-glow)"
      />
      {/* Solid arc overlay for premium feel */}
      <circle
        cx={CX} cy={CY} r={R_OUTER}
        fill="none"
        stroke="hsl(224,76%,55%)"
        strokeOpacity="0.08"
        strokeWidth="0.5"
      />

      {/* ── Inner orbit ring ─────────────────────────────────────────────── */}
      <circle
        cx={CX} cy={CY} r={R_INNER}
        fill="none"
        stroke="hsl(44,75%,50%)"
        strokeOpacity="0.22"
        strokeWidth="1"
        strokeDasharray="3 8"
        filter="url(#iv-ring-glow)"
      />
      <circle
        cx={CX} cy={CY} r={R_INNER}
        fill="none"
        stroke="hsl(44,75%,50%)"
        strokeOpacity="0.06"
        strokeWidth="0.5"
      />

      {/* ── Spoke lines from centre ───────────────────────────────────────── */}
      {BLUE_NODES.map(({ angleDeg }) => {
        const p = toXY(R_OUTER, angleDeg);
        return (
          <line
            key={angleDeg}
            x1={CX} y1={CY}
            x2={CX + p.x} y2={CY + p.y}
            stroke="hsl(224,76%,55%)"
            strokeOpacity="0.06"
            strokeWidth="0.75"
          />
        );
      })}

      {/* ── Outer orbit (CW, blue nodes) — SMIL rotation ─────────────────── */}
      <g>
        {active && (
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from={`0 ${CX} ${CY}`}
            to={`360 ${CX} ${CY}`}
            dur="50s"
            repeatCount="indefinite"
          />
        )}
        {BLUE_NODES.map(({ label, angleDeg }) => {
          const p = toXY(R_OUTER, angleDeg);
          const nx = CX + p.x;
          const ny = CY + p.y;
          return (
            <g key={label}>
              {/* Node shadow */}
              <circle cx={nx} cy={ny} r="21" fill="hsl(222,60%,8%)" opacity="0.7" />
              {/* Node fill */}
              <circle cx={nx} cy={ny} r="19" fill="url(#iv-node-blue)" filter="url(#iv-node-shadow)" />
              {/* Border ring */}
              <circle
                cx={nx} cy={ny} r="19"
                fill="none"
                stroke="hsl(224,76%,55%)"
                strokeOpacity="0.45"
                strokeWidth="0.8"
              />
              {/* Highlight arc */}
              <path
                d={`M ${nx - 11},${ny - 13} A 17,17 0 0,1 ${nx + 11},${ny - 13}`}
                fill="none"
                stroke="hsl(224,76%,80%)"
                strokeOpacity="0.15"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* Counter-rotate label */}
              <g transform={`translate(${nx},${ny})`}>
                {active && (
                  <animateTransform
                    attributeName="transform"
                    attributeType="XML"
                    type="rotate"
                    from={`0 0 0`}
                    to={`-360 0 0`}
                    dur="50s"
                    repeatCount="indefinite"
                    additive="sum"
                  />
                )}
                <text
                  x="0" y="0"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="hsl(224,76%,72%)"
                  fontSize="6.2"
                  fontWeight="700"
                  letterSpacing="0.05em"
                  fontFamily="var(--font-inter, ui-sans-serif)"
                  transform={`translate(${-nx},${-ny})`}
                >
                  {label}
                </text>
              </g>
            </g>
          );
        })}
      </g>

      {/* ── Inner orbit (CCW, gold nodes) — SMIL rotation ────────────────── */}
      <g>
        {active && (
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from={`0 ${CX} ${CY}`}
            to={`-360 ${CX} ${CY}`}
            dur="32s"
            repeatCount="indefinite"
          />
        )}
        {GOLD_NODES.map(({ label, angleDeg }) => {
          const p = toXY(R_INNER, angleDeg);
          const nx = CX + p.x;
          const ny = CY + p.y;
          return (
            <g key={label}>
              <circle cx={nx} cy={ny} r="21" fill="hsl(222,60%,8%)" opacity="0.7" />
              <circle cx={nx} cy={ny} r="19" fill="url(#iv-node-gold)" filter="url(#iv-node-shadow)" />
              <circle
                cx={nx} cy={ny} r="19"
                fill="none"
                stroke="hsl(44,75%,50%)"
                strokeOpacity="0.55"
                strokeWidth="0.9"
              />
              {/* Gold inner glow rim */}
              <circle
                cx={nx} cy={ny} r="16"
                fill="none"
                stroke="hsl(44,92%,62%)"
                strokeOpacity="0.12"
                strokeWidth="3"
              />
              {/* Highlight */}
              <path
                d={`M ${nx - 11},${ny - 13} A 17,17 0 0,1 ${nx + 11},${ny - 13}`}
                fill="none"
                stroke="hsl(44,92%,75%)"
                strokeOpacity="0.2"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* Counter-rotate label */}
              <g transform={`translate(${nx},${ny})`}>
                {active && (
                  <animateTransform
                    attributeName="transform"
                    attributeType="XML"
                    type="rotate"
                    from={`0 0 0`}
                    to={`360 0 0`}
                    dur="32s"
                    repeatCount="indefinite"
                    additive="sum"
                  />
                )}
                <text
                  x="0" y="0"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="hsl(44,90%,66%)"
                  fontSize="6.2"
                  fontWeight="700"
                  letterSpacing="0.05em"
                  fontFamily="var(--font-inter, ui-sans-serif)"
                  transform={`translate(${-nx},${-ny})`}
                >
                  {label}
                </text>
              </g>
            </g>
          );
        })}
      </g>

      {/* ── Centre hexagon cluster ────────────────────────────────────────── */}
      {/* Outer glow halo */}
      <polygon
        points={hexPoints(54, 0)}
        transform={`translate(${CX},${CY})`}
        fill="hsl(224,76%,50%)"
        opacity="0.07"
      />
      <polygon
        points={hexPoints(50, 0)}
        transform={`translate(${CX},${CY})`}
        fill="hsl(224,76%,50%)"
        opacity="0.07"
      />

      {/* Main hex border — gold */}
      <polygon
        points={hexPoints(40, 0)}
        transform={`translate(${CX},${CY})`}
        fill="url(#iv-centre)"
        stroke="url(#iv-gold)"
        strokeWidth="1.4"
        filter="url(#iv-glow-gold)"
      >
        {active && (
          <animate
            attributeName="opacity"
            values="0.85;1;0.85"
            dur="3s"
            repeatCount="indefinite"
          />
        )}
      </polygon>

      {/* Inner hex — subtle */}
      <polygon
        points={hexPoints(32, 30)}
        transform={`translate(${CX},${CY})`}
        fill="none"
        stroke="hsl(44,75%,50%)"
        strokeOpacity="0.18"
        strokeWidth="0.75"
      />

      {/* Subtle hex background pattern line */}
      <polygon
        points={hexPoints(22, 0)}
        transform={`translate(${CX},${CY})`}
        fill="none"
        stroke="hsl(224,76%,65%)"
        strokeOpacity="0.15"
        strokeWidth="0.5"
      />

      {/* TI monogram */}
      <text
        x={CX} y={CY - 7}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="hsl(44,90%,64%)"
        fontSize="16"
        fontWeight="800"
        letterSpacing="-0.03em"
        fontFamily="var(--font-display, ui-sans-serif)"
      >
        TI
      </text>
      {/* REGISTRY label */}
      <text
        x={CX} y={CY + 10}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="hsl(224,76%,70%)"
        fontSize="5.5"
        fontWeight="600"
        letterSpacing="0.18em"
        fontFamily="var(--font-inter, ui-sans-serif)"
      >
        REGISTRY
      </text>

      {/* ── Decorative corner dots — depth / ambient particles ────────────── */}
      {[
        [CX - 185, CY - 165, 1.5, 0.25],
        [CX + 170, CY - 180, 1.2, 0.2],
        [CX - 175, CY + 160, 1.2, 0.2],
        [CX + 180, CY + 170, 1.5, 0.22],
        [CX - 130, CY - 195, 1,   0.15],
        [CX + 145, CY + 195, 1,   0.15],
        [CX - 200, CY + 40,  0.8, 0.12],
        [CX + 205, CY - 30,  0.8, 0.12],
      ].map(([x, y, r, op], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="hsl(224,76%,65%)" opacity={op} />
      ))}
    </svg>
  );
}
