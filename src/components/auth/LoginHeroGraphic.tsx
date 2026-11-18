import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Animated hero graphic for the login page: a glass leaf, an orbiting light ring
 * and four frosted glass cards. Every card gets its own randomly generated motion
 * profile (position drift, tilt, 3D rotation, breathing) on each page load, so no two
 * cards ever move alike. Motion is driven by requestAnimationFrame writing straight
 * to the DOM, so React never re-renders while it animates.
 */

const REF_WIDTH = 620; // design width the amplitudes below are expressed in

type Wave = { amp: number; freq: number; phase: number };

interface MotionProfile {
  x: [Wave, Wave];
  y: [Wave, Wave];
  rz: [Wave, Wave];
  rx: Wave;
  ry: Wave;
  scale: Wave;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const wave = (amp: [number, number], freq: [number, number]): Wave => ({
  amp: rand(amp[0], amp[1]),
  freq: rand(freq[0], freq[1]),
  phase: rand(0, Math.PI * 2),
});
const sample = (w: Wave, t: number) => w.amp * Math.sin(w.freq * t + w.phase);

// Each card has a unique, randomly generated profile. Incommensurate frequencies
// mean the combined motion never visibly repeats.
const makeProfile = (strength: number): MotionProfile => ({
  x: [wave([8, 18].map((v) => v * strength) as [number, number], [0.35, 0.9]), wave([3, 8], [1.1, 1.9])],
  y: [wave([9, 20].map((v) => v * strength) as [number, number], [0.3, 0.85]), wave([3, 7], [1.2, 2.1])],
  rz: [wave([4, 11], [0.25, 0.7]), wave([1, 3], [0.9, 1.6])],
  rx: wave([6, 16], [0.3, 0.8]),
  ry: wave([8, 22], [0.28, 0.75]),
  scale: wave([0.025, 0.06], [0.4, 1.0]),
});

interface CardDef {
  id: string;
  left: number; // % of stage width
  top: number; // % of stage height
  width: number; // % of stage width
  baseRotate: number;
  strength: number;
  z: number;
  icon: ReactNode;
}

const ICON_SHADOW = 'drop-shadow(0 3px 8px rgba(5,150,105,0.28))';

const CalendarIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-1/2 text-[#2E8B6A]" style={{ filter: ICON_SHADOW }}>
    <rect x="14" y="6" width="3.2" height="6" rx="1.6" fill="currentColor" />
    <rect x="30.8" y="6" width="3.2" height="6" rx="1.6" fill="currentColor" />
    <rect x="8" y="9" width="32" height="32" rx="7" stroke="currentColor" strokeWidth="2.4" />
    <path d="M8 18H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {[16, 24, 32].flatMap((cx) => [25, 33].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" fill="currentColor" />))}
  </svg>
);

const PeopleIcon = () => (
  <svg viewBox="0 0 56 56" fill="currentColor" className="w-[58%] text-[#1F9A62]" style={{ filter: 'drop-shadow(0 4px 12px rgba(5,150,105,0.35))' }}>
    <circle cx="16" cy="22" r="5" opacity="0.85" />
    <path d="M7 38C7 32.5 11.2 29 16.5 29C20 29 23 30.5 24.5 33C20.5 34.5 18.5 37.5 18.5 41H7V38Z" opacity="0.85" />
    <circle cx="40" cy="22" r="5" opacity="0.85" />
    <path d="M49 38C49 32.5 44.8 29 39.5 29C36 29 33 30.5 31.5 33C35.5 34.5 37.5 37.5 37.5 41H49V38Z" opacity="0.85" />
    <circle cx="28" cy="18.5" r="6.8" />
    <path d="M15.5 41C15.5 34.5 21 31 28 31C35 31 40.5 34.5 40.5 41C40.5 42 39.8 43 38 43H18C16.2 43 15.5 42 15.5 41Z" />
  </svg>
);

const ChartIcon = () => (
  <svg viewBox="0 0 48 48" fill="currentColor" className="w-1/2 text-[#2E8B4F]" style={{ filter: ICON_SHADOW }}>
    <rect x="10" y="27" width="6.8" height="14" rx="3.4" />
    <rect x="20.6" y="18" width="6.8" height="23" rx="3.4" />
    <rect x="31.2" y="9" width="6.8" height="32" rx="3.4" />
  </svg>
);

const DocumentIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" className="w-1/2 text-[#5E8A74]" style={{ filter: ICON_SHADOW }}>
    <path d="M12 8C12 6.34 13.34 5 15 5H27L36 14V39C36 40.66 34.66 42 33 42H15C13.34 42 12 40.66 12 39V8Z" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M27 5V14H36" strokeWidth="2.4" strokeLinejoin="round" />
    <line x1="18" y1="22" x2="30" y2="22" strokeWidth="2.4" strokeLinecap="round" />
    <line x1="18" y1="28" x2="30" y2="28" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="31" cy="35" r="3" strokeWidth="2" />
  </svg>
);

const CARDS: CardDef[] = [
  { id: 'calendar', left: 5, top: 54, width: 17, baseRotate: -6, strength: 1.1, z: 20, icon: <CalendarIcon /> },
  { id: 'people', left: 25, top: 42, width: 30, baseRotate: -3, strength: 0.8, z: 40, icon: <PeopleIcon /> },
  { id: 'chart', left: 58, top: 30, width: 20, baseRotate: 4, strength: 1.2, z: 30, icon: <ChartIcon /> },
  { id: 'document', left: 69, top: 64, width: 19, baseRotate: 7, strength: 1.0, z: 25, icon: <DocumentIcon /> },
];

const SPARKLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: rand(6, 94),
  top: rand(4, 92),
  size: rand(3, 7),
  delay: rand(0, 6),
  duration: rand(3, 7),
}));

export default function LoginHeroGraphic() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const leafRef = useRef<HTMLDivElement>(null);
  const profiles = useMemo(() => CARDS.map((c) => makeProfile(c.strength)), []);
  const leafProfile = useMemo(
    () => ({ rz: wave([1.2, 2.4], [0.35, 0.6]), x: wave([4, 9], [0.25, 0.5]), y: wave([5, 11], [0.3, 0.55]) }),
    []
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let scale = stage.clientWidth / REF_WIDTH;
    const ro = new ResizeObserver(() => {
      scale = stage.clientWidth / REF_WIDTH;
    });
    ro.observe(stage);

    // Pointer parallax: smoothly eases towards the cursor
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove);

    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      CARDS.forEach((card, i) => {
        const el = cardRefs.current[i];
        if (!el) return;
        const p = profiles[i];
        const depth = card.z / 40;
        const x = (sample(p.x[0], t) + sample(p.x[1], t) + pointer.x * 14 * depth) * scale;
        const y = (sample(p.y[0], t) + sample(p.y[1], t) + pointer.y * 10 * depth) * scale;
        const rz = card.baseRotate + sample(p.rz[0], t) + sample(p.rz[1], t);
        const rx = sample(p.rx, t) - pointer.y * 5;
        const ry = sample(p.ry, t) + pointer.x * 7;
        const s = 1 + sample(p.scale, t);
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${s.toFixed(3)})`;
        // Light glint travels across the glass as the card tilts
        el.style.setProperty('--glint', `${(50 + ry * 2.4).toFixed(1)}%`);
      });

      const leaf = leafRef.current;
      if (leaf) {
        const lx = (sample(leafProfile.x, t) + pointer.x * -8) * scale;
        const ly = (sample(leafProfile.y, t) + pointer.y * -6) * scale;
        leaf.style.transform = `translate3d(${lx.toFixed(2)}px, ${ly.toFixed(2)}px, 0) rotate(${sample(leafProfile.rz, t).toFixed(2)}deg)`;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
    };
  }, [profiles, leafProfile]);

  return (
    <div
      ref={stageRef}
      className="relative w-full select-none pointer-events-none"
      style={{ aspectRatio: '620 / 500', perspective: '1100px' }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes nz-twinkle { 0%,100% { opacity: 0; transform: scale(0.4) } 50% { opacity: 1; transform: scale(1) } }
        @keyframes nz-glow { 0%,100% { opacity: .55; transform: scale(1) } 50% { opacity: .95; transform: scale(1.12) } }
        @keyframes nz-ring-spin { from { transform: rotate(-14deg) } to { transform: rotate(346deg) } }
      `}</style>

      {/* Warm glow pooling at the leaf tip */}
      <div
        className="absolute rounded-full"
        style={{
          left: '2%', bottom: '-2%', width: '42%', height: '22%',
          background: 'radial-gradient(closest-side, rgba(251,191,36,0.75), rgba(251,191,36,0) 70%)',
          filter: 'blur(14px)',
          animation: 'nz-glow 4.5s ease-in-out infinite',
        }}
      />

      {/* Glass leaf */}
      <div ref={leafRef} className="absolute inset-0" style={{ transformOrigin: '8% 95%', willChange: 'transform' }}>
        <svg viewBox="0 0 620 500" className="w-full h-full overflow-visible" fill="none">
          <defs>
            <linearGradient id="nzLeafBody" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#F5B73A" stopOpacity="0.9">
                <animate attributeName="offset" values="0;0.08;0" dur="7s" repeatCount="indefinite" />
              </stop>
              <stop offset="22%" stopColor="#7FD9B0" stopOpacity="0.75" />
              <stop offset="60%" stopColor="#B9EBD3" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#E3F7EC" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="nzLeafBack" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#F5B73A" stopOpacity="0.7" />
              <stop offset="35%" stopColor="#34C48B" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#CFF2E0" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id="nzSheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity="0" />
              <stop offset="50%" stopColor="#fff" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="nzRing" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FBBF24" stopOpacity="0" />
              <stop offset="35%" stopColor="#FDE68A" stopOpacity="0.95" />
              <stop offset="70%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
            </linearGradient>
            <clipPath id="nzLeafClip">
              <path d="M40 470 C 110 290, 290 110, 540 20 C 530 200, 470 350, 330 425 C 240 470, 130 490, 40 470 Z" />
            </clipPath>
            <filter id="nzSoft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          {/* Back leaf layer for depth */}
          <path d="M30 482 C 90 330, 250 150, 520 40 C 440 150, 400 330, 290 430 C 200 480, 110 495, 30 482 Z" fill="url(#nzLeafBack)" opacity="0.7" />

          {/* Main leaf body */}
          <path
            d="M40 470 C 110 290, 290 110, 540 20 C 530 200, 470 350, 330 425 C 240 470, 130 490, 40 470 Z"
            fill="url(#nzLeafBody)"
            stroke="#fff"
            strokeOpacity="0.85"
            strokeWidth="1.8"
          />

          {/* Mid-rib and veins */}
          <path d="M60 465 C 190 330, 340 190, 520 38" stroke="#fff" strokeOpacity="0.8" strokeWidth="2.2" strokeLinecap="round" filter="url(#nzSoft)" />
          <path d="M60 465 C 190 330, 340 190, 520 38" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.2" strokeLinecap="round" />
          {[[170, 355, 215, 410], [250, 285, 300, 350], [330, 220, 385, 285], [410, 150, 465, 215]].map(([x1, y1, x2, y2], i) => (
            <path key={i} d={`M${x1} ${y1} Q ${(x1 + x2) / 2 + 12} ${(y1 + y2) / 2 - 14} ${x2} ${y2}`} stroke="#fff" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" />
          ))}

          {/* Sweeping light across the leaf */}
          <g clipPath="url(#nzLeafClip)">
            <rect x="-160" y="-40" width="140" height="560" fill="url(#nzSheen)" transform="skewX(-24)">
              <animate attributeName="x" values="-200;760" dur="6.5s" repeatCount="indefinite" />
            </rect>
          </g>

          {/* Orbiting light ring around the cards */}
          <g style={{ transformOrigin: '300px 320px' }}>
            <ellipse cx="300" cy="320" rx="270" ry="70" transform="rotate(-9 300 320)" stroke="url(#nzRing)" strokeWidth="2.4" strokeDasharray="420 180">
              <animate attributeName="stroke-dashoffset" values="0;-600" dur="5s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="300" cy="320" rx="270" ry="70" transform="rotate(-9 300 320)" stroke="#FDE68A" strokeOpacity="0.35" strokeWidth="1" />
            <circle r="5" fill="#fff">
              <animateMotion dur="7s" repeatCount="indefinite" path="M30 320 a270 70 0 1 0 540 0 a270 70 0 1 0 -540 0" rotate="auto" />
            </circle>
            <circle r="11" fill="#FDE68A" opacity="0.5" filter="url(#nzSoft)">
              <animateMotion dur="7s" repeatCount="indefinite" path="M30 320 a270 70 0 1 0 540 0 a270 70 0 1 0 -540 0" />
            </circle>
          </g>
        </svg>
      </div>

      {/* Frosted glass cards, each with its own random motion */}
      {CARDS.map((card, i) => (
        <div
          key={card.id}
          ref={(el) => (cardRefs.current[i] = el)}
          className="absolute flex items-center justify-center"
          style={
            {
              left: `${card.left}%`,
              top: `${card.top}%`,
              width: `${card.width}%`,
              aspectRatio: '1 / 1',
              zIndex: card.z,
              borderRadius: '26%',
              transform: `rotate(${card.baseRotate}deg)`,
              transformStyle: 'preserve-3d',
              willChange: 'transform',
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(236,253,245,0.5) 55%, rgba(209,250,229,0.3) 100%)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1.5px solid rgba(255,255,255,0.9)',
              boxShadow:
                '0 22px 40px -14px rgba(5,150,105,0.28), inset 0 2px 4px rgba(255,255,255,0.95), inset -3px -3px 8px rgba(245,158,11,0.18)',
              '--glint': '50%',
            } as CSSProperties
          }
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: 'inherit',
              background:
                'linear-gradient(115deg, transparent calc(var(--glint) - 22%), rgba(255,255,255,0.65) var(--glint), transparent calc(var(--glint) + 22%))',
            }}
          />
          {card.icon}
        </div>
      ))}

      {/* Twinkling sparkles */}
      {SPARKLES.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: 'radial-gradient(circle, #fff 20%, rgba(253,230,138,0.9) 60%, transparent 100%)',
            animation: `nz-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            zIndex: 50,
          }}
        />
      ))}
    </div>
  );
}
