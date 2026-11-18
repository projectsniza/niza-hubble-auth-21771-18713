import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Animated hero graphic for the login page: a glass leaf with eight frosted glass cards.
 *
 * Cards continuously weave around the leaf: at a short, random interval one card drifts
 * from in front of the leaf to behind it while another comes forward (and vice versa),
 * each moving to a new random free spot. Moves glide at a medium, calm speed. On top of
 * that each card has its own gentle float and tilt.
 *
 * Motion runs in requestAnimationFrame and writes straight to the DOM, so React never
 * re-renders while it animates. Respects "reduce motion".
 */

const REF_WIDTH = 620; // design width the pixel amplitudes are expressed in
const SWAP_EVERY_MS: [number, number] = [700, 1200]; // short interval between depth swaps
const GLIDE = 0.022; // per-frame easing toward the new spot (~1.6s glide = medium speed)
const LEAF_Z = 20;

type Wave = { amp: number; freq: number; phase: number };
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const wave = (amp: [number, number], freq: [number, number]): Wave => ({
  amp: rand(amp[0], amp[1]),
  freq: rand(freq[0], freq[1]),
  phase: rand(0, Math.PI * 2),
});
const sample = (w: Wave, t: number) => w.amp * Math.sin(w.freq * t + w.phase);

/** Spots (in % of the stage) the cards travel between, spread around the leaf. */
const SLOTS: Array<[number, number]> = [
  // evenly spaced (~22% apart) so cards rarely cover each other when settled
  [12, 28], [34, 22], [56, 18], [80, 24],
  [16, 54], [39, 50], [62, 48], [84, 56],
  [14, 82], [37, 80], [60, 78], [82, 84],
];

const ICON_SHADOW = 'drop-shadow(0 3px 8px rgba(5,150,105,0.28))';
const iconCls = 'w-1/2';

const CalendarIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className={`${iconCls} text-[#2E8B6A]`} style={{ filter: ICON_SHADOW }}>
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
  <svg viewBox="0 0 48 48" fill="currentColor" className={`${iconCls} text-[#2E8B4F]`} style={{ filter: ICON_SHADOW }}>
    <rect x="10" y="27" width="6.8" height="14" rx="3.4" />
    <rect x="20.6" y="18" width="6.8" height="23" rx="3.4" />
    <rect x="31.2" y="9" width="6.8" height="32" rx="3.4" />
  </svg>
);
const DocumentIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" className={`${iconCls} text-[#5E8A74]`} style={{ filter: ICON_SHADOW }}>
    <path d="M12 8C12 6.34 13.34 5 15 5H27L36 14V39C36 40.66 34.66 42 33 42H15C13.34 42 12 40.66 12 39V8Z" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M27 5V14H36" strokeWidth="2.4" strokeLinejoin="round" />
    <line x1="18" y1="22" x2="30" y2="22" strokeWidth="2.4" strokeLinecap="round" />
    <line x1="18" y1="28" x2="30" y2="28" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="31" cy="35" r="3" strokeWidth="2" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" className={`${iconCls} text-[#1F8A5C]`} style={{ filter: ICON_SHADOW }}>
    <circle cx="24" cy="25" r="15" strokeWidth="2.6" />
    <path d="M24 17V25L30 29" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 6H29" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);
const ShieldIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" className={`${iconCls} text-[#3A9A5E]`} style={{ filter: ICON_SHADOW }}>
    <path d="M24 5L38 10.5V22C38 31.5 32 38.5 24 42C16 38.5 10 31.5 10 22V10.5L24 5Z" strokeWidth="2.6" strokeLinejoin="round" />
    <path d="M17.5 23.5L22 28L31 19" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChatIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" className={`${iconCls} text-[#2D9470]`} style={{ filter: ICON_SHADOW }}>
    <path d="M8 13C8 10.2 10.2 8 13 8H35C37.8 8 40 10.2 40 13V28C40 30.8 37.8 33 35 33H20L12 40V33C9.8 33 8 31.2 8 29V13Z" strokeWidth="2.6" strokeLinejoin="round" />
    <circle cx="17" cy="20.5" r="2" fill="currentColor" stroke="none" />
    <circle cx="24" cy="20.5" r="2" fill="currentColor" stroke="none" />
    <circle cx="31" cy="20.5" r="2" fill="currentColor" stroke="none" />
  </svg>
);
const WalletIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" className={`${iconCls} text-[#4C8F3A]`} style={{ filter: ICON_SHADOW }}>
    <rect x="7" y="13" width="34" height="25" rx="6" strokeWidth="2.6" />
    <path d="M12 13L30 7C32 6.3 34 7.8 34 10V13" strokeWidth="2.6" strokeLinejoin="round" />
    <rect x="29" y="21.5" width="12" height="8" rx="4" strokeWidth="2.4" />
    <circle cx="33.5" cy="25.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

interface CardDef {
  id: string;
  width: number; // % of stage width
  icon: ReactNode;
}

const CARDS: CardDef[] = [
  { id: 'people', width: 22, icon: <PeopleIcon /> },
  { id: 'calendar', width: 17, icon: <CalendarIcon /> },
  { id: 'chart', width: 18, icon: <ChartIcon /> },
  { id: 'document', width: 17, icon: <DocumentIcon /> },
  { id: 'clock', width: 16, icon: <ClockIcon /> },
  { id: 'shield', width: 15, icon: <ShieldIcon /> },
  { id: 'chat', width: 16, icon: <ChatIcon /> },
  { id: 'wallet', width: 15, icon: <WalletIcon /> },
];

interface CardState {
  slot: number;
  x: number; // current anchor (%)
  y: number;
  depth: number; // 0 = behind the leaf, 1 = in front
  targetDepth: number;
  float: { x: Wave; y: Wave; rz: Wave; rx: Wave; ry: Wave };
  baseRotate: number;
}

export default function LoginHeroGraphic() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const leafRef = useRef<HTMLDivElement>(null);

  // Initial layout: shuffled slots, alternating front/back so it starts balanced.
  const initial = useMemo<CardState[]>(() => {
    const slots = SLOTS.map((_, i) => i).sort(() => Math.random() - 0.5);
    return CARDS.map((_, i) => {
      const slot = slots[i];
      const front = i % 2 === 0 ? 1 : 0;
      return {
        slot,
        x: SLOTS[slot][0],
        y: SLOTS[slot][1],
        depth: front,
        targetDepth: front,
        float: {
          x: wave([4, 9], [0.4, 0.9]),
          y: wave([5, 11], [0.35, 0.85]),
          rz: wave([2, 6], [0.3, 0.7]),
          rx: wave([5, 12], [0.3, 0.8]),
          ry: wave([6, 16], [0.28, 0.75]),
        },
        baseRotate: rand(-8, 8),
      };
    });
  }, []);
  const leafWave = useMemo(() => ({ rz: wave([1, 2], [0.35, 0.6]), y: wave([4, 9], [0.3, 0.55]) }), []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const state = initial.map((c) => ({ ...c }));

    const paint = (t: number, scale: number) => {
      CARDS.forEach((_, i) => {
        const el = cardRefs.current[i];
        if (!el) return;
        const c = state[i];
        const d = c.depth;
        const fx = (sample(c.float.x, t) * scale).toFixed(2);
        const fy = (sample(c.float.y, t) * scale).toFixed(2);
        const s = (0.8 + 0.2 * d).toFixed(3); // behind = smaller, front = full size
        el.style.left = `${c.x}%`;
        el.style.top = `${c.y}%`;
        el.style.zIndex = String(d > 0.5 ? LEAF_Z + 10 + Math.round(d * 10) : LEAF_Z - 10 + Math.round(d * 5));
        el.style.opacity = (0.62 + 0.38 * d).toFixed(3);
        el.style.filter = d < 0.98 ? `blur(${((1 - d) * 1.6).toFixed(2)}px) saturate(${(0.8 + 0.2 * d).toFixed(2)})` : 'none';
        el.style.transform =
          `translate(-50%, -50%) translate3d(${fx}px, ${fy}px, 0) ` +
          `rotateX(${sample(c.float.rx, t).toFixed(2)}deg) rotateY(${sample(c.float.ry, t).toFixed(2)}deg) ` +
          `rotateZ(${(c.baseRotate + sample(c.float.rz, t)).toFixed(2)}deg) scale(${s})`;
        el.style.setProperty('--glint', `${(50 + sample(c.float.ry, t) * 2.4).toFixed(1)}%`);
      });
    };

    let scale = stage.clientWidth / REF_WIDTH;
    const ro = new ResizeObserver(() => {
      scale = stage.clientWidth / REF_WIDTH;
    });
    ro.observe(stage);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paint(0, scale);
      return () => ro.disconnect();
    }

    // ---- choreography: one card goes behind the leaf while another comes in front ----
    let swapTimer = 0;
    const freeSlot = (exclude: number) => {
      const used = new Set(state.map((c) => c.slot));
      const free = SLOTS.map((_, i) => i).filter((i) => !used.has(i) && i !== exclude);
      return free[Math.floor(Math.random() * free.length)] ?? exclude;
    };
    const moveTo = (c: CardState, targetDepth: number) => {
      const slot = freeSlot(c.slot);
      c.slot = slot;
      c.targetDepth = targetDepth;
      c.baseRotate = rand(-9, 9);
      (c as any).tx = SLOTS[slot][0];
      (c as any).ty = SLOTS[slot][1];
    };
    const scheduleSwap = () => {
      swapTimer = window.setTimeout(() => {
        const settled = state.filter((c) => Math.abs(c.depth - c.targetDepth) < 0.05);
        const fronts = settled.filter((c) => c.targetDepth === 1);
        const backs = settled.filter((c) => c.targetDepth === 0);
        const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
        if (fronts.length && backs.length) {
          moveTo(pick(fronts), 0); // goes behind the leaf
          moveTo(pick(backs), 1); // comes forward
        } else if (settled.length) {
          const c = pick(settled);
          moveTo(c, c.targetDepth ? 0 : 1);
        }
        scheduleSwap();
      }, rand(SWAP_EVERY_MS[0], SWAP_EVERY_MS[1]));
    };
    scheduleSwap();

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      state.forEach((c: any) => {
        if (c.tx !== undefined) {
          c.x += (c.tx - c.x) * GLIDE;
          c.y += (c.ty - c.y) * GLIDE;
        }
        c.depth += (c.targetDepth - c.depth) * GLIDE * 1.2;
      });
      paint(t, scale);
      const leaf = leafRef.current;
      if (leaf) {
        leaf.style.transform = `translate3d(0, ${(sample(leafWave.y, t) * scale).toFixed(2)}px, 0) rotate(${sample(leafWave.rz, t).toFixed(2)}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(swapTimer);
      ro.disconnect();
    };
  }, [initial, leafWave]);

  return (
    <div
      ref={stageRef}
      className="relative h-full w-full select-none pointer-events-none"
      style={{ aspectRatio: '620 / 500', perspective: '1100px' }}
      aria-hidden="true"
    >
      <style>{`@keyframes nz-glow { 0%,100% { opacity: .55; transform: scale(1) } 50% { opacity: .95; transform: scale(1.12) } }`}</style>

      {/* Warm glow pooling at the leaf tip */}
      <div
        className="absolute rounded-full"
        style={{
          left: '2%', bottom: '-2%', width: '42%', height: '22%', zIndex: 1,
          background: 'radial-gradient(closest-side, rgba(251,191,36,0.75), rgba(251,191,36,0) 70%)',
          filter: 'blur(14px)',
          animation: 'nz-glow 4.5s ease-in-out infinite',
        }}
      />

      {/* Glass leaf (cards pass behind and in front of it) */}
      <div ref={leafRef} className="absolute inset-0" style={{ transformOrigin: '8% 95%', willChange: 'transform', zIndex: LEAF_Z }}>
        <svg viewBox="0 0 620 500" className="h-full w-full overflow-visible" fill="none">
          <defs>
            <linearGradient id="nzLeafBody" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#F5B73A" stopOpacity="0.9">
                <animate attributeName="offset" values="0;0.08;0" dur="7s" repeatCount="indefinite" />
              </stop>
              <stop offset="22%" stopColor="#7FD9B0" stopOpacity="0.72" />
              <stop offset="60%" stopColor="#B9EBD3" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#E3F7EC" stopOpacity="0.42" />
            </linearGradient>
            <linearGradient id="nzLeafBack" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#F5B73A" stopOpacity="0.7" />
              <stop offset="35%" stopColor="#34C48B" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#CFF2E0" stopOpacity="0.32" />
            </linearGradient>
            <linearGradient id="nzSheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity="0" />
              <stop offset="50%" stopColor="#fff" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <clipPath id="nzLeafClip">
              <path d="M40 470 C 110 290, 290 110, 540 20 C 530 200, 470 350, 330 425 C 240 470, 130 490, 40 470 Z" />
            </clipPath>
            <filter id="nzSoft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          <path d="M30 482 C 90 330, 250 150, 520 40 C 440 150, 400 330, 290 430 C 200 480, 110 495, 30 482 Z" fill="url(#nzLeafBack)" opacity="0.7" />
          <path
            d="M40 470 C 110 290, 290 110, 540 20 C 530 200, 470 350, 330 425 C 240 470, 130 490, 40 470 Z"
            fill="url(#nzLeafBody)"
            stroke="#fff"
            strokeOpacity="0.85"
            strokeWidth="1.8"
          />
          <path d="M60 465 C 190 330, 340 190, 520 38" stroke="#fff" strokeOpacity="0.8" strokeWidth="2.2" strokeLinecap="round" filter="url(#nzSoft)" />
          <path d="M60 465 C 190 330, 340 190, 520 38" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.2" strokeLinecap="round" />
          {[[170, 355, 215, 410], [250, 285, 300, 350], [330, 220, 385, 285], [410, 150, 465, 215]].map(([x1, y1, x2, y2], i) => (
            <path key={i} d={`M${x1} ${y1} Q ${(x1 + x2) / 2 + 12} ${(y1 + y2) / 2 - 14} ${x2} ${y2}`} stroke="#fff" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" />
          ))}
          <g clipPath="url(#nzLeafClip)">
            <rect x="-160" y="-40" width="140" height="560" fill="url(#nzSheen)" transform="skewX(-24)">
              <animate attributeName="x" values="-200;760" dur="6.5s" repeatCount="indefinite" />
            </rect>
          </g>
        </svg>
      </div>

      {/* Frosted glass cards */}
      {CARDS.map((card, i) => (
        <div
          key={card.id}
          ref={(el) => (cardRefs.current[i] = el)}
          className="absolute flex items-center justify-center"
          style={
            {
              left: `${initial[i].x}%`,
              top: `${initial[i].y}%`,
              width: `${card.width}%`,
              aspectRatio: '1 / 1',
              zIndex: initial[i].depth ? LEAF_Z + 10 : LEAF_Z - 10,
              borderRadius: '26%',
              transform: 'translate(-50%, -50%)',
              transformStyle: 'preserve-3d',
              willChange: 'transform, left, top, opacity, filter',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.82) 0%, rgba(236,253,245,0.52) 55%, rgba(209,250,229,0.32) 100%)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1.5px solid rgba(255,255,255,0.9)',
              boxShadow: '0 22px 40px -14px rgba(5,150,105,0.28), inset 0 2px 4px rgba(255,255,255,0.95), inset -3px -3px 8px rgba(245,158,11,0.18)',
              '--glint': '50%',
            } as CSSProperties
          }
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: 'inherit',
              background: 'linear-gradient(115deg, transparent calc(var(--glint) - 22%), rgba(255,255,255,0.65) var(--glint), transparent calc(var(--glint) + 22%))',
            }}
          />
          {card.icon}
        </div>
      ))}
    </div>
  );
}
