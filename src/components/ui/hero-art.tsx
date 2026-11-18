import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Decorative hero illustration (glass office, rolling hills, sun and growth bars).
 * It fades into its container on the left/top through a CSS mask, so it never shows
 * hard cut-off edges, and it animates gently. Purely visual.
 */
export default function HeroArt({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const id = (n: string) => `${n}-${uid}`;

  return (
    <svg
      viewBox="0 0 640 260"
      preserveAspectRatio="xMaxYMax meet"
      fill="none"
      aria-hidden="true"
      className={cn('pointer-events-none select-none', className)}
      style={{
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 28%), linear-gradient(to bottom, transparent 0%, #000 22%)',
        WebkitMaskComposite: 'source-in',
        maskImage: 'linear-gradient(to right, transparent 0%, #000 28%), linear-gradient(to bottom, transparent 0%, #000 22%)',
        maskComposite: 'intersect',
      }}
    >
      <defs>
        <radialGradient id={id('sun')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff7cc" />
          <stop offset="0.45" stopColor="#fde68a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fcd34d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('hillBack')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9f5e5" />
          <stop offset="1" stopColor="#a7e3c3" />
        </linearGradient>
        <linearGradient id={id('hillMid')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c8ef9f" />
          <stop offset="1" stopColor="#7cc56a" />
        </linearGradient>
        <linearGradient id={id('hillFront')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4fbf86" />
          <stop offset="1" stopColor="#1f8f5f" />
        </linearGradient>
        <linearGradient id={id('glass')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ecfdf5" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#a7f3d0" stopOpacity="0.85" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id={id('glassSide')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6ee7b7" stopOpacity="0.85" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={id('bar')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={id('reflect')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={id('tower')}>
          <path d="M392 72 L 470 52 L 470 210 L 392 210 Z" />
        </clipPath>
      </defs>

      {/* Sun glow */}
      <circle cx="560" cy="62" r="70" fill={`url(#${id('sun')})`}>
        <animate attributeName="r" values="64;78;64" dur="7s" repeatCount="indefinite" />
      </circle>

      {/* Back hills */}
      <path d="M120 210 C 210 150, 300 160, 380 185 C 460 210, 540 140, 640 150 L 640 260 L 120 260 Z" fill={`url(#${id('hillBack')})`} />

      {/* Growth bars */}
      {[0, 1, 2, 3, 4].map((i) => {
        const h = 40 + i * 22;
        return (
          <rect key={i} x={250 + i * 26} y={210 - h} width="16" height={h} rx="5" fill={`url(#${id('bar')})`} opacity={0.55 + i * 0.09}>
            <animate attributeName="height" values={`${h};${h + 10};${h}`} dur={`${4 + i * 0.6}s`} repeatCount="indefinite" />
            <animate attributeName="y" values={`${210 - h};${200 - h};${210 - h}`} dur={`${4 + i * 0.6}s`} repeatCount="indefinite" />
          </rect>
        );
      })}

      {/* Glass office tower */}
      <g>
        <path d="M470 52 L 520 70 L 520 210 L 470 210 Z" fill={`url(#${id('glassSide')})`} />
        <path d="M392 72 L 470 52 L 470 210 L 392 210 Z" fill={`url(#${id('glass')})`} />
        <g stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.2">
          {[0, 1, 2, 3, 4, 5, 6].map((r) => (
            <line key={`h${r}`} x1="392" y1={92 + r * 18} x2="470" y2={86 + r * 18 - r * 0.2} />
          ))}
          {[0, 1, 2].map((c) => (
            <line key={`v${c}`} x1={412 + c * 19.5} y1={66 - c * 5} x2={412 + c * 19.5} y2="210" />
          ))}
          {[0, 1, 2, 3, 4, 5, 6].map((r) => (
            <line key={`s${r}`} x1="470" y1={86 + r * 18} x2="520" y2={100 + r * 17} strokeOpacity="0.45" />
          ))}
        </g>
        {/* moving reflection */}
        <g clipPath={`url(#${id('tower')})`}>
          <rect x="300" y="40" width="40" height="190" fill={`url(#${id('reflect')})`} transform="skewX(-20)">
            <animate attributeName="x" values="300;560;560" keyTimes="0;0.55;1" dur="6s" repeatCount="indefinite" />
          </rect>
        </g>
        {/* low wing */}
        <path d="M520 150 L 600 160 L 600 212 L 520 212 Z" fill={`url(#${id('glass')})`} opacity="0.9" />
        <path d="M520 150 L 600 160" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.5" />
      </g>

      {/* Trees */}
      {[
        [372, 206, 13],
        [538, 210, 11],
        [612, 212, 15],
      ].map(([x, y, r], i) => (
        <g key={i} style={{ transformOrigin: `${x}px ${y + r}px`, animation: `niza-float ${5 + i}s ease-in-out infinite` }}>
          <rect x={x - 1.5} y={y} width="3" height={r} fill="#2f7a4f" />
          <circle cx={x} cy={y - r * 0.2} r={r} fill="#3fb57a" />
          <circle cx={x - r * 0.35} cy={y - r * 0.5} r={r * 0.55} fill="#7fd6a3" opacity="0.8" />
        </g>
      ))}

      {/* Mid + front hills */}
      <path d="M180 232 C 280 196, 360 214, 440 220 C 520 226, 580 200, 640 206 L 640 260 L 180 260 Z" fill={`url(#${id('hillMid')})`} opacity="0.95">
        <animate
          attributeName="d"
          dur="10s"
          repeatCount="indefinite"
          values="M180 232 C 280 196, 360 214, 440 220 C 520 226, 580 200, 640 206 L 640 260 L 180 260 Z;M180 228 C 280 206, 360 204, 440 214 C 520 224, 580 208, 640 200 L 640 260 L 180 260 Z;M180 232 C 280 196, 360 214, 440 220 C 520 226, 580 200, 640 206 L 640 260 L 180 260 Z"
        />
      </path>
      <path d="M260 252 C 360 230, 460 246, 540 238 C 590 234, 620 236, 640 232 L 640 260 L 260 260 Z" fill={`url(#${id('hillFront')})`} opacity="0.85" />

      {/* Sparkles */}
      {[
        [330, 110, 0],
        [600, 120, 1.5],
        [450, 30, 3],
      ].map(([x, y, d], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill="#fff">
          <animate attributeName="opacity" values="0;1;0" dur="3.5s" begin={`${d}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}
