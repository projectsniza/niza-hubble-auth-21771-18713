import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Interactive hero scene: a modern glass HQ tower in two-point perspective, a city skyline,
 * a tree-lined plaza and a street with traffic.
 *  - Layers drift with the pointer (parallax depth)
 *  - Hovering the tower lights its windows
 *  - Clicking the sun / moon switches between day and night
 * The left edge fades into the container, so there are never hard cut-off edges.
 * Purely decorative: it does not affect any app behaviour.
 */

type Pt = [number, number];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** point inside a quad (tl, tr, br, bl) using bilinear interpolation */
const bil = (q: [Pt, Pt, Pt, Pt], u: number, v: number): Pt => lerp(lerp(q[0], q[1], u), lerp(q[3], q[2], u), v);
const poly = (pts: Pt[]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const cell = (q: [Pt, Pt, Pt, Pt], u0: number, v0: number, u1: number, v1: number) =>
  poly([bil(q, u0, v0), bil(q, u1, v0), bil(q, u1, v1), bil(q, u0, v1)]);

// deterministic pseudo-random so the scene is identical on every render
const rnd = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

interface Win {
  pts: string;
  lit: boolean;
  twinkle: boolean;
  delay: number;
}

function windows(q: [Pt, Pt, Pt, Pt], cols: number, rows: number, seed: number, gapU = 0.18, gapV = 0.22, top = 0.06, bottom = 0.1): Win[] {
  const out: Win[] = [];
  const h = (1 - top - bottom) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u0 = (c + gapU / 2) / cols;
      const u1 = (c + 1 - gapU / 2) / cols;
      const v0 = top + r * h + (h * gapV) / 2;
      const v1 = top + (r + 1) * h - (h * gapV) / 2;
      const k = seed + r * 31 + c * 7;
      out.push({ pts: cell(q, u0, v0, u1, v1), lit: rnd(k) > 0.45, twinkle: rnd(k + 3) > 0.9, delay: rnd(k + 5) * 6 });
    }
  }
  return out;
}

const Tree = ({ x, y, s, sway, delay }: { x: number; y: number; s: number; sway: number; delay: number }) => (
  <g style={{ transformOrigin: `${x}px ${y}px`, transformBox: 'view-box', animation: `nzh-sway ${sway}s ease-in-out ${delay}s infinite` }}>
    <ellipse cx={x} cy={y + 1} rx={s * 0.9} ry={s * 0.18} fill="#0f5132" opacity="0.18" />
    <rect x={x - s * 0.08} y={y - s * 0.9} width={s * 0.16} height={s * 0.9} rx={s * 0.05} fill="#6b4f3a" />
    <circle cx={x} cy={y - s * 1.35} r={s * 0.72} fill="#1f8a55" />
    <circle cx={x - s * 0.42} cy={y - s * 1.05} r={s * 0.5} fill="#27a065" />
    <circle cx={x + s * 0.45} cy={y - s * 1.1} r={s * 0.52} fill="#1b7a4b" />
    <circle cx={x - s * 0.18} cy={y - s * 1.62} r={s * 0.42} fill="#3dbb7c" />
    <circle cx={x - s * 0.3} cy={y - s * 1.7} r={s * 0.16} fill="#a7f3d0" opacity="0.7" />
  </g>
);

const Car = ({ color, dur, delay, y, reverse }: { color: string; dur: number; delay: number; y: number; reverse?: boolean }) => (
  <g>
    <animateTransform
      attributeName="transform"
      type="translate"
      from={reverse ? '860 0' : '-80 0'}
      to={reverse ? '-80 0' : '860 0'}
      dur={`${dur}s`}
      begin={`${delay}s`}
      repeatCount="indefinite"
    />
    <g transform={`translate(0 ${y}) ${reverse ? 'scale(-1 1)' : ''}`}>
      <ellipse cx="17" cy="11" rx="19" ry="2.5" fill="#000" opacity="0.18" />
      <path d="M2 8 Q 2 3 7 3 L 11 -2 Q 13 -4 17 -4 L 25 -4 Q 29 -4 31 0 L 33 3 Q 36 4 36 8 L 36 9 L 2 9 Z" fill={color} />
      <path d="M12.5 -1.5 L 15 -3 L 24 -3 L 26.5 0.5 L 12 0.5 Z" fill="#cfefff" opacity="0.9" />
      <circle cx="10" cy="9.5" r="3" fill="#1f2933" />
      <circle cx="28" cy="9.5" r="3" fill="#1f2933" />
      <circle cx="35" cy="5.5" r="1.2" fill="#fff7c2" />
    </g>
  </g>
);

export default function HeroArt({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const id = (n: string) => `${n}-${uid}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const [night, setNight] = useState(false);
  const [towerHover, setTowerHover] = useState(false);

  // ---- geometry (two-point perspective, eye level ~y150) ----
  const tower = useMemo(() => {
    const front: [Pt, Pt, Pt, Pt] = [[478, 58], [606, 32], [606, 262], [478, 254]];
    const side: [Pt, Pt, Pt, Pt] = [[606, 32], [668, 60], [668, 252], [606, 262]];
    return { front, side, fw: windows(front, 6, 12, 11), sw: windows(side, 3, 12, 97, 0.22) };
  }, []);
  const annex = useMemo(() => {
    const front: [Pt, Pt, Pt, Pt] = [[372, 150], [450, 138], [450, 258], [372, 256]];
    const side: [Pt, Pt, Pt, Pt] = [[450, 138], [478, 146], [478, 255], [450, 258]];
    return { front, side, fw: windows(front, 4, 5, 51, 0.2, 0.35, 0.08, 0.14) };
  }, []);
  const wing = useMemo(() => {
    const front: [Pt, Pt, Pt, Pt] = [[668, 150], [760, 160], [760, 256], [668, 252]];
    return { front, fw: windows(front, 5, 4, 77, 0.2, 0.3, 0.1, 0.15) };
  }, []);
  const skyline = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const w = 22 + rnd(i) * 30;
        const h = 40 + rnd(i + 40) * 95;
        return { x: i * 38 - 10 + rnd(i + 9) * 8, w, h };
      }),
    [],
  );

  // ---- pointer parallax ----
  useEffect(() => {
    const svg = svgRef.current;
    const host = svg?.parentElement;
    if (!svg || !host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layers = Array.from(svg.querySelectorAll<SVGGElement>('[data-depth]'));
    const p = { x: 0, y: 0, tx: 0, ty: 0 };
    let raf = 0;
    let running = false;
    const tick = () => {
      p.x += (p.tx - p.x) * 0.08;
      p.y += (p.ty - p.y) * 0.08;
      layers.forEach((l) => {
        const d = Number(l.dataset.depth);
        l.setAttribute('transform', `translate(${(p.x * d).toFixed(2)} ${(p.y * d * 0.5).toFixed(2)})`);
      });
      if (Math.abs(p.tx - p.x) > 0.01 || Math.abs(p.ty - p.y) > 0.01) raf = requestAnimationFrame(tick);
      else running = false;
    };
    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      p.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      p.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      kick();
    };
    const onLeave = () => {
      p.tx = 0;
      p.ty = 0;
      kick();
    };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  const lit = night || towerHover;
  const winFill = (w: Win) => (lit ? (w.lit || towerHover ? '#ffe8a3' : '#5b8f86') : '#e9fbf3');
  const winOpacity = (w: Win) => (lit ? (w.lit || towerHover ? 0.95 : 0.55) : w.lit ? 0.55 : 0.32);
  const T = 'transition-all duration-700';

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 800 300"
      preserveAspectRatio="xMaxYMax meet"
      fill="none"
      aria-hidden="true"
      className={cn('pointer-events-none select-none', className)}
      style={{
        aspectRatio: '800 / 300',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 12%, #000 30%)',
        maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 12%, #000 30%)',
      }}
    >
      <style>{`
        @keyframes nzh-sway { 0%,100% { transform: rotate(-1.6deg) } 50% { transform: rotate(1.6deg) } }
        @keyframes nzh-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        @keyframes nzh-spin { to { transform: rotate(360deg) } }
      `}</style>
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1f3a" />
          <stop offset="1" stopColor="#1c4d5a" />
        </linearGradient>
        <radialGradient id={id('sun')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.35" stopColor="#fde68a" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('front')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={night ? '#1d5b52' : '#b8f0d8'} />
          <stop offset="0.6" stopColor={night ? '#174a43' : '#6fd4a8'} />
          <stop offset="1" stopColor={night ? '#0f3a34' : '#2fb07c'} />
        </linearGradient>
        <linearGradient id={id('side')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={night ? '#103a33' : '#2a9b6c'} />
          <stop offset="1" stopColor={night ? '#0a2a25' : '#1a7a53'} />
        </linearGradient>
        <linearGradient id={id('concrete')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? '#4b5a60' : '#f4f1ea'} />
          <stop offset="1" stopColor={night ? '#384449' : '#ddd8cc'} />
        </linearGradient>
        <linearGradient id={id('plaza')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? '#2b4a45' : '#dff3e8'} />
          <stop offset="1" stopColor={night ? '#22403b' : '#c4e8d4'} />
        </linearGradient>
        <linearGradient id={id('lawn')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={night ? '#1f5a3e' : '#8fd67a'} />
          <stop offset="1" stopColor={night ? '#174a33' : '#4fbf6a'} />
        </linearGradient>
        <linearGradient id={id('reflect')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity={night ? 0.15 : 0.7} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={id('frontClip')}>
          <polygon points={poly(tower.front)} />
        </clipPath>
      </defs>

      {/* night sky */}
      <rect x="0" y="0" width="800" height="300" fill={`url(#${id('sky')})`} className={T} opacity={night ? 0.9 : 0} />
      {night &&
        Array.from({ length: 26 }, (_, i) => (
          <circle key={i} cx={rnd(i + 200) * 800} cy={rnd(i + 300) * 120} r={rnd(i + 400) * 1.2 + 0.4} fill="#fff">
            <animate attributeName="opacity" values="0.2;1;0.2" dur={`${2 + rnd(i) * 3}s`} repeatCount="indefinite" />
          </circle>
        ))}

      {/* sun / moon: click to toggle day & night */}
      <g data-depth="3">
        <g
          style={{ pointerEvents: 'visiblePainted', cursor: 'pointer' }}
          onClick={() => setNight((n) => !n)}
        >
          <title>{night ? 'Switch to day' : 'Switch to night'}</title>
          {!night ? (
            <>
              <circle cx="720" cy="58" r="74" fill={`url(#${id('sun')})`} opacity="0.85">
                <animate attributeName="r" values="68;80;68" dur="7s" repeatCount="indefinite" />
              </circle>
              <g style={{ transformOrigin: '720px 58px', animation: 'nzh-spin 60s linear infinite' }} opacity="0.35">
                {Array.from({ length: 12 }, (_, i) => (
                  <rect key={i} x="719" y="2" width="2" height="18" rx="1" fill="#fbbf24" transform={`rotate(${i * 30} 720 58)`} />
                ))}
              </g>
              <circle cx="720" cy="58" r="20" fill="#fff6c9" />
            </>
          ) : (
            <>
              <circle cx="720" cy="58" r="40" fill="#e0f2fe" opacity="0.12" />
              <circle cx="720" cy="58" r="17" fill="#f1f5f9" />
              <circle cx="728" cy="52" r="15" fill="#123a45" opacity="0.92" />
            </>
          )}
        </g>
      </g>

      {/* clouds */}
      <g data-depth="2" opacity={night ? 0.25 : 0.9} className={T}>
        {[
          [120, 46, 1, 70, 0],
          [420, 30, 0.8, 90, -30],
          [640, 104, 0.65, 80, -55],
        ].map(([x, y, s, dur, begin], i) => (
          <g key={i}>
            <animateTransform attributeName="transform" type="translate" from="-120 0" to="160 0" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
            <g transform={`translate(${x} ${y}) scale(${s})`} fill="#ffffff">
              <ellipse cx="0" cy="8" rx="34" ry="10" />
              <circle cx="-12" cy="2" r="12" />
              <circle cx="6" cy="-4" r="16" />
              <circle cx="22" cy="3" r="11" />
            </g>
          </g>
        ))}
      </g>

      {/* distant skyline */}
      <g data-depth="4" className={T} opacity={night ? 0.55 : 0.5}>
        {skyline.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={262 - b.h} width={b.w} height={b.h} rx="2" fill={night ? '#29505a' : '#bfe6d4'} />
            {night &&
              Array.from({ length: Math.floor(b.h / 14) }, (_, r) =>
                rnd(i * 13 + r) > 0.6 ? (
                  <rect key={r} x={b.x + 4} y={262 - b.h + 6 + r * 14} width={b.w - 8} height="3" fill="#ffe8a3" opacity="0.6" />
                ) : null,
              )}
          </g>
        ))}
      </g>

      {/* back lawn */}
      <g data-depth="6">
        <path d="M0 250 C 160 228, 320 238, 420 246 C 560 256, 700 232, 800 238 L 800 300 L 0 300 Z" fill={`url(#${id('lawn')})`} opacity="0.75" className={T} />
      </g>

      {/* buildings */}
      <g data-depth="8">
        {/* annex (left, concrete with glass bands) */}
        <polygon points={poly(annex.side)} fill={night ? '#2d3a3e' : '#c9c3b5'} className={T} />
        <polygon points={poly(annex.front)} fill={`url(#${id('concrete')})`} />
        {annex.fw.map((w, i) => (
          <polygon key={i} points={w.pts} fill={night && w.lit ? '#ffe2a0' : night ? '#3f5a5c' : '#9fdcc6'} opacity={night ? 0.9 : 0.8} className={T} />
        ))}

        {/* HQ tower */}
        <g
          style={{ pointerEvents: 'visiblePainted' }}
          onPointerEnter={() => setTowerHover(true)}
          onPointerLeave={() => setTowerHover(false)}
        >
          <title>Niza HQ</title>
          <polygon points={poly(tower.side)} fill={`url(#${id('side')})`} />
          <polygon points={poly(tower.front)} fill={`url(#${id('front')})`} />
          {/* mullions */}
          {[1, 2, 3, 4, 5].map((c) => (
            <line
              key={c}
              x1={bil(tower.front, c / 6, 0)[0]}
              y1={bil(tower.front, c / 6, 0)[1]}
              x2={bil(tower.front, c / 6, 1)[0]}
              y2={bil(tower.front, c / 6, 1)[1]}
              stroke="#ffffff"
              strokeOpacity={night ? 0.15 : 0.55}
              strokeWidth="0.8"
            />
          ))}
          {tower.fw.map((w, i) => (
            <polygon key={`f${i}`} points={w.pts} fill={winFill(w)} opacity={winOpacity(w)} className="transition-all duration-500">
              {w.twinkle && night && <animate attributeName="opacity" values="0.95;0.4;0.95" dur="5s" begin={`${w.delay}s`} repeatCount="indefinite" />}
            </polygon>
          ))}
          {tower.sw.map((w, i) => (
            <polygon key={`s${i}`} points={w.pts} fill={winFill(w)} opacity={winOpacity(w) * 0.75} className="transition-all duration-500" />
          ))}
          {/* moving reflection */}
          <g clipPath={`url(#${id('frontClip')})`}>
            <rect x="380" y="0" width="34" height="300" fill={`url(#${id('reflect')})`} transform="skewX(-18)">
              <animate attributeName="x" values="380;700;700" keyTimes="0;0.5;1" dur="7s" repeatCount="indefinite" />
            </rect>
          </g>
          {/* crown + antenna */}
          <polygon points={poly([[478, 58], [606, 32], [606, 40], [478, 65]])} fill={night ? '#2dd4bf' : '#ffffff'} opacity={night ? 0.7 : 0.85} className={T} />
          <polygon points={poly([[606, 32], [668, 60], [668, 66], [606, 40]])} fill="#ffffff" opacity={night ? 0.2 : 0.6} />
          <line x1="566" y1="40" x2="566" y2="14" stroke={night ? '#94a3b8' : '#64748b'} strokeWidth="1.6" />
          <circle cx="566" cy="13" r="2.2" fill="#ef4444">
            <animate attributeName="opacity" values="1;0.2;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
          {/* entrance canopy + sign */}
          <polygon points={poly([[520, 238], [600, 236], [608, 244], [514, 247]])} fill={night ? '#e2e8f0' : '#0f5132'} opacity="0.9" />
          <text x="562" y="245" textAnchor="middle" fontSize="6.5" fontWeight="700" fill={night ? '#0f5132' : '#ffffff'} letterSpacing="1.4">
            NIZA
          </text>
          <polygon points={cell(tower.front, 0.42, 0.93, 0.72, 1)} fill={night ? '#ffe8a3' : '#d1fae5'} opacity="0.9" />
        </g>

        {/* low wing (right) */}
        <polygon points={poly(wing.front)} fill={`url(#${id('concrete')})`} />
        {wing.fw.map((w, i) => (
          <polygon key={i} points={w.pts} fill={night && w.lit ? '#ffe2a0' : night ? '#3f5a5c' : '#a8e6cf'} opacity="0.85" className={T} />
        ))}
        <polygon points={poly([[668, 150], [760, 160], [760, 164], [668, 155]])} fill="#ffffff" opacity={night ? 0.25 : 0.9} />
      </g>

      {/* plaza, street & traffic */}
      <g data-depth="11">
        <path d="M0 262 L 800 258 L 800 300 L 0 300 Z" fill={`url(#${id('plaza')})`} className={T} />
        <rect x="0" y="272" width="800" height="22" fill={night ? '#1e2a2f' : '#5b6670'} className={T} />
        <line x1="0" y1="283" x2="800" y2="283" stroke="#f8fafc" strokeWidth="1.4" strokeDasharray="14 12" opacity="0.8">
          <animate attributeName="stroke-dashoffset" values="0;-52" dur="2.5s" repeatCount="indefinite" />
        </line>
        <rect x="0" y="270" width="800" height="2" fill="#ffffff" opacity="0.7" />
        <Car color="#10b981" dur={11} delay={0} y={268} />
        <Car color="#f59e0b" dur={14} delay={-6} y={268} />
        <Car color="#0ea5e9" dur={13} delay={-3} y={281} reverse />
        {/* street lamps */}
        {[410, 640, 760].map((x) => (
          <g key={x}>
            <rect x={x} y="244" width="1.6" height="26" fill="#475569" />
            <circle cx={x + 0.8} cy="243" r="2.4" fill={night ? '#fff3c4' : '#e2e8f0'} />
            {night && <circle cx={x + 0.8} cy="250" r="16" fill="#fde68a" opacity="0.18" />}
          </g>
        ))}
        {/* people walking */}
        {[
          [0, 18, '#0f766e'],
          [-7, 22, '#f97316'],
          [-13, 26, '#6366f1'],
        ].map(([begin, dur, c], i) => (
          <g key={i}>
            <animateTransform attributeName="transform" type="translate" from="380 0" to="780 0" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
            <g transform="translate(0 255)">
              <circle cx="0" cy="-9" r="2" fill="#7c5a43" />
              <rect x="-2" y="-7" width="4" height="6" rx="1.5" fill={c as string} />
              <rect x="-1.6" y="-1.5" width="1.3" height="4" fill="#334155">
                <animate attributeName="height" values="4;2.5;4" dur="0.6s" repeatCount="indefinite" />
              </rect>
              <rect x="0.4" y="-1.5" width="1.3" height="4" fill="#334155">
                <animate attributeName="height" values="2.5;4;2.5" dur="0.6s" repeatCount="indefinite" />
              </rect>
            </g>
          </g>
        ))}
      </g>

      {/* foreground trees */}
      <g data-depth="16">
        <Tree x={392} y={266} s={13} sway={5} delay={0} />
        <Tree x={455} y={268} s={10} sway={6} delay={-1} />
        <Tree x={622} y={268} s={12} sway={5.5} delay={-2} />
        <Tree x={700} y={266} s={15} sway={6.5} delay={-0.5} />
        <Tree x={782} y={268} s={11} sway={5} delay={-3} />
      </g>

      {/* floating analytics card */}
      <g data-depth="20">
        <g style={{ animation: 'nzh-float 6s ease-in-out infinite' }}>
        <g transform="translate(372 66)">
          <rect x="0" y="0" width="96" height="64" rx="10" fill="#ffffff" opacity={night ? 0.16 : 0.85} stroke="#ffffff" strokeOpacity="0.9" className={T} />
          <rect x="10" y="10" width="34" height="4" rx="2" fill={night ? '#a7f3d0' : '#0f5132'} opacity="0.6" />
          {[0, 1, 2, 3, 4].map((i) => {
            const h = 10 + i * 6 + (i === 3 ? 4 : 0);
            return (
              <rect key={i} x={12 + i * 15} y={54 - h} width="9" height={h} rx="2.5" fill={i === 4 ? '#f59e0b' : '#10b981'} opacity={0.6 + i * 0.08}>
                <animate attributeName="height" values={`${h};${h + 5};${h}`} dur={`${3 + i * 0.5}s`} repeatCount="indefinite" />
                <animate attributeName="y" values={`${54 - h};${49 - h};${54 - h}`} dur={`${3 + i * 0.5}s`} repeatCount="indefinite" />
              </rect>
            );
          })}
          <polyline points="12,40 30,34 46,36 62,26 82,18" stroke="#047857" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeDasharray="120" strokeDashoffset="0">
            <animate attributeName="stroke-dashoffset" values="120;0;0" keyTimes="0;0.4;1" dur="6s" repeatCount="indefinite" />
          </polyline>
        </g>
        </g>
      </g>
    </svg>
  );
}
