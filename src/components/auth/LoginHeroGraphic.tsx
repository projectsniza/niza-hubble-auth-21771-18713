import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Login hero: a glossy glass leaf (gold at the base, fresh green to the tip) with eight
 * frosted cards that weave behind and in front of it.
 *
 * Performance notes (this page used to feel heavy):
 *  - cards are positioned with transforms only (no left/top changes -> no layout per frame)
 *  - no backdrop-filter or filter: blur on moving elements (those force full repaints)
 *  - the leaf itself is a static SVG (no SMIL animations repainting it every frame)
 *  - swaps pause while the tab is hidden
 */

const SWAP_EVERY_MS: [number, number] = [700, 1200]; // short interval between depth swaps
const GLIDE = 0.022; // per-frame easing toward a new spot (~1.6s = medium speed)
const LEAF_Z = 20;

type Wave = { amp: number; freq: number; phase: number };
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const wave = (amp: [number, number], freq: [number, number]): Wave => ({
  amp: rand(amp[0], amp[1]),
  freq: rand(freq[0], freq[1]),
  phase: rand(0, Math.PI * 2),
});
const sample = (w: Wave, t: number) => w.amp * Math.sin(w.freq * t + w.phase);

/** Card centre points (in % of the stage), spread evenly around the leaf. */
const SLOTS: Array<[number, number]> = [
  [12, 30], [34, 24], [57, 20], [80, 26],
  [16, 56], [40, 52], [63, 50], [85, 58],
  [15, 82], [38, 80], [61, 80], [83, 84],
];

const ICON_SHADOW = 'drop-shadow(0 3px 6px rgba(5,150,105,0.25))';
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
  <svg viewBox="0 0 56 56" fill="currentColor" className="w-[58%] text-[#1F9A62]" style={{ filter: 'drop-shadow(0 4px 10px rgba(5,150,105,0.32))' }}>
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

const CARDS: Array<{ id: string; width: number; icon: ReactNode }> = [
  { id: 'people', width: 24, icon: <PeopleIcon /> },
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
  x: number;
  y: number;
  tx: number;
  ty: number;
  depth: number; // 0 = behind the leaf, 1 = in front
  targetDepth: number;
  layer: number; // last z-index written (only written when it changes)
  float: { x: Wave; y: Wave; rz: Wave; rx: Wave; ry: Wave };
  baseRotate: number;
}

// Leaf geometry (viewBox 620 x 500): base tip bottom-left, pointed tip top-right,
// a plump body with the widest part around the middle - matching the brand artwork.
const LEAF = 'M34 476 C 70 360, 170 232, 318 146 C 410 92, 500 50, 586 14 C 574 122, 534 236, 462 322 C 392 404, 264 462, 34 476 Z';
const LEAF_INNER = 'M78 452 C 120 360, 210 258, 330 184 C 412 134, 492 92, 556 56 C 540 140, 506 224, 446 296 C 384 368, 270 426, 78 452 Z';
const MIDRIB = 'M58 462 C 190 360, 360 200, 566 32';

export default function LoginHeroGraphic() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const initial = useMemo<CardState[]>(() => {
    const slots = SLOTS.map((_, i) => i).sort(() => Math.random() - 0.5);
    return CARDS.map((_, i) => {
      const slot = slots[i];
      const front = i % 2 === 0 ? 1 : 0;
      return {
        slot,
        x: SLOTS[slot][0],
        y: SLOTS[slot][1],
        tx: SLOTS[slot][0],
        ty: SLOTS[slot][1],
        depth: front,
        targetDepth: front,
        layer: -1,
        float: {
          x: wave([0.6, 1.4], [0.4, 0.9]),
          y: wave([0.8, 1.8], [0.35, 0.85]),
          rz: wave([2, 6], [0.3, 0.7]),
          rx: wave([5, 12], [0.3, 0.8]),
          ry: wave([6, 14], [0.28, 0.75]),
        },
        baseRotate: rand(-8, 8),
      };
    });
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const state = initial.map((c) => ({ ...c }));
    let W = stage.clientWidth;
    let H = stage.clientHeight;
    const ro = new ResizeObserver(() => {
      W = stage.clientWidth;
      H = stage.clientHeight;
    });
    ro.observe(stage);

    // pointer parallax: the cards drift a little toward the mouse (front cards move more)
    let mx = 0, my = 0, tmx = 0, tmy = 0;
    const paint = (t: number) => {
      for (let i = 0; i < CARDS.length; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const c = state[i];
        const d = c.depth;
        const size = (CARDS[i].width / 100) * W;
        const par = 0.45 + 0.55 * d;
        const ox = mx * W * 0.022 * par;
        const oy = my * H * 0.022 * par;
        // float amplitude is a % of the stage so it scales with screen size
        const px = ((c.x + sample(c.float.x, t)) / 100) * W - size / 2 + ox;
        const py = ((c.y + sample(c.float.y, t)) / 100) * H - size / 2 + oy;
        const breathe = 1 + 0.012 * Math.sin(t * 0.9 + i * 1.7);
        const scale = (0.82 + 0.18 * d) * breathe;
        el.style.transform =
          `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) ` +
          `rotateX(${(sample(c.float.rx, t) - my * 3 * par).toFixed(1)}deg) rotateY(${(sample(c.float.ry, t) + mx * 4 * par).toFixed(1)}deg) ` +
          `rotateZ(${(c.baseRotate + sample(c.float.rz, t)).toFixed(1)}deg) scale(${scale.toFixed(3)})`;
        el.style.opacity = (0.55 + 0.45 * d).toFixed(3);
        const layer = d > 0.5 ? LEAF_Z + 10 + Math.round(d * 5) : LEAF_Z - 10;
        if (layer !== c.layer) {
          el.style.zIndex = String(layer);
          c.layer = layer;
        }
      }
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paint(0);
      return () => ro.disconnect();
    }

    // choreography: one card goes behind the leaf while another comes in front
    let swapTimer = 0;
    const freeSlot = (exclude: number) => {
      const used = new Set(state.map((c) => c.slot));
      const free = SLOTS.map((_, i) => i).filter((i) => !used.has(i) && i !== exclude);
      return free[Math.floor(Math.random() * free.length)] ?? exclude;
    };
    const moveTo = (c: CardState, targetDepth: number) => {
      const slot = freeSlot(c.slot);
      c.slot = slot;
      c.tx = SLOTS[slot][0];
      c.ty = SLOTS[slot][1];
      c.targetDepth = targetDepth;
      c.baseRotate = rand(-9, 9);
    };
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const scheduleSwap = () => {
      swapTimer = window.setTimeout(() => {
        if (!document.hidden) {
          const settled = state.filter((c) => Math.abs(c.depth - c.targetDepth) < 0.05);
          const fronts = settled.filter((c) => c.targetDepth === 1);
          const backs = settled.filter((c) => c.targetDepth === 0);
          if (fronts.length && backs.length) {
            moveTo(pick(fronts), 0);
            moveTo(pick(backs), 1);
          } else if (settled.length) {
            const c = pick(settled);
            moveTo(c, c.targetDepth ? 0 : 1);
          }
        }
        scheduleSwap();
      }, rand(SWAP_EVERY_MS[0], SWAP_EVERY_MS[1]));
    };
    scheduleSwap();

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      for (const c of state) {
        c.x += (c.tx - c.x) * GLIDE;
        c.y += (c.ty - c.y) * GLIDE;
        c.depth += (c.targetDepth - c.depth) * GLIDE * 1.2;
      }
      mx += (tmx - mx) * 0.05;
      my += (tmy - my) * 0.05;
      paint(t);
      raf = requestAnimationFrame(tick);
    };
    const onPointer = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      tmx = Math.max(-1, Math.min(1, ((e.clientX - (r.left + r.width / 2)) / r.width) * 2));
      tmy = Math.max(-1, Math.min(1, ((e.clientY - (r.top + r.height / 2)) / r.height) * 2));
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(swapTimer);
      window.removeEventListener('pointermove', onPointer);
      ro.disconnect();
    };
  }, [initial]);

  return (
    <div
      ref={stageRef}
      className="relative h-full w-full select-none pointer-events-none"
      style={{ aspectRatio: '620 / 500', perspective: '1100px' }}
      aria-hidden="true"
    >
      {/* Leaf (static SVG - cheap to render) */}
      <div className="absolute inset-0" style={{ zIndex: LEAF_Z }}>
        <svg viewBox="0 0 620 500" className="h-full w-full overflow-visible" fill="none">
          <defs>
            {/* warm gold glow pooled at the base */}
            <radialGradient id="nzlGlow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#FFE27A" stopOpacity="0.95" />
              <stop offset="0.45" stopColor="#FBC531" stopOpacity="0.45" />
              <stop offset="1" stopColor="#FBC531" stopOpacity="0" />
            </radialGradient>
            {/* body: gold at the base -> lime -> emerald -> pale mint glass at the tip */}
            <linearGradient id="nzlBody" x1="40" y1="470" x2="580" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#F5A70E" stopOpacity="1" />
              <stop offset="0.14" stopColor="#F2CE2B" stopOpacity="0.97" />
              <stop offset="0.3" stopColor="#8BD443" stopOpacity="0.92" />
              <stop offset="0.5" stopColor="#25B86A" stopOpacity="0.86" />
              <stop offset="0.75" stopColor="#4CCB8E" stopOpacity="0.74" />
              <stop offset="1" stopColor="#BDEFD5" stopOpacity="0.7" />
            </linearGradient>
            {/* glassy inner light */}
            <linearGradient id="nzlInner" x1="120" y1="420" x2="520" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.22" />
              <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.5" />
            </linearGradient>
            {/* bright rim along the edges */}
            <linearGradient id="nzlRim" x1="40" y1="470" x2="580" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#FFF4C2" stopOpacity="0.95" />
              <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.85" />
              <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.95" />
            </linearGradient>
            {/* soft shadow under the leaf */}
            <filter id="nzlShadow" x="-10%" y="-10%" width="120%" height="130%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
          </defs>

          {/* ground shadow + base glow */}
          <path d={LEAF} fill="#0f8a57" opacity="0.12" transform="translate(10 18)" filter="url(#nzlShadow)" />
          <ellipse cx="96" cy="452" rx="210" ry="80" fill="url(#nzlGlow)" />

          {/* body */}
          <path d={LEAF} fill="url(#nzlBody)" />
          {/* inner glass highlight */}
          <path d={LEAF_INNER} fill="url(#nzlInner)" />
          {/* rim light */}
          <path d={LEAF} stroke="url(#nzlRim)" strokeWidth="2.4" strokeLinejoin="round" />

          {/* mid-rib and side veins */}
          <path d={MIDRIB} stroke="#FFFFFF" strokeOpacity="0.95" strokeWidth="2.2" strokeLinecap="round" />
          <path d={MIDRIB} stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="7" strokeLinecap="round" />
          {[
            [168, 378, 230, 420],
            [246, 312, 318, 352],
            [326, 244, 400, 280],
            [406, 172, 470, 200],
            [196, 352, 172, 300],
            [282, 282, 262, 226],
            [368, 210, 352, 158],
          ].map(([x1, y1, x2, y2], i) => (
            <path
              key={i}
              d={`M${x1} ${y1} Q ${(x1 + x2) / 2 + 10} ${(y1 + y2) / 2 - 10} ${x2} ${y2}`}
              stroke="#FFFFFF"
              strokeOpacity="0.4"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          ))}

          {/* specular highlight near the tip */}
          <path d="M468 92 C 510 70, 548 48, 574 30" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>

      {/* Frosted cards (no backdrop blur: they move every frame) */}
      {CARDS.map((card, i) => (
        <div
          key={card.id}
          ref={(el) => (cardRefs.current[i] = el)}
          className="absolute left-0 top-0 flex items-center justify-center"
          style={
            {
              width: `${card.width}%`,
              aspectRatio: '1 / 1',
              zIndex: initial[i].depth ? LEAF_Z + 10 : LEAF_Z - 10,
              opacity: initial[i].depth ? 1 : 0.55,
              borderRadius: '26%',
              transformStyle: 'preserve-3d',
              willChange: 'transform, opacity',
              background:
                'linear-gradient(145deg, rgba(255,255,255,0.97) 0%, rgba(243,252,248,0.9) 55%, rgba(222,247,236,0.84) 100%)',
              border: '1px solid rgba(255,255,255,0.9)',
              boxShadow:
                '0 26px 46px -20px rgba(6,95,70,0.36), 0 2px 6px rgba(6,95,70,0.08), inset 0 1px 0 rgba(255,255,255,1), inset 0 -2px 8px rgba(16,185,129,0.12)',
            } as CSSProperties
          }
        >
          {/* static glass sheen */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              borderRadius: 'inherit',
              background: 'linear-gradient(160deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 45%)',
            }}
          />
          {card.icon}
        </div>
      ))}
    </div>
  );
}
