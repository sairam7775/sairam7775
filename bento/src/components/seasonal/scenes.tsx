/** The four seasonal scenes and five chosen ones, drawn as SVG so there are
 *  no image downloads. Each has a far layer (sky, mountains — blurred) and a
 *  near layer (the tree, the onsen, the lanterns — not blurred, because it
 *  moves), so depth reads through the blur. Classes beginning `season-` are
 *  animated in globals.css. All original drawings: no shop names, signs or
 *  writing anywhere. */
import type { ReactNode } from "react";
import { noise, type Background } from "./season";

const VIEW = "0 0 1600 900";

function Layer({ children, className }: { children: ReactNode; className: string }) {
  return (
    <svg viewBox={VIEW} preserveAspectRatio="xMidYMax slice" className={`absolute inset-0 h-full w-full ${className}`} aria-hidden="true">
      {children}
    </svg>
  );
}

/** Round canopy from overlapping circles: [cx, cy, r, colour]. */
function Canopy({ blobs, origin }: { blobs: [number, number, number, string][]; origin: string }) {
  return (
    <g className="season-canopy" style={{ transformOrigin: origin }}>
      {blobs.map(([cx, cy, r, fill], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill={fill} />
      ))}
    </g>
  );
}

function Autumn() {
  return (
    <>
      <Layer className="season-far">
        <defs>
          <linearGradient id="au-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbe3cf" />
            <stop offset="1" stopColor="#f6c39d" />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#au-sky)" />
        <circle cx="1180" cy="260" r="90" fill="#ffd9a8" />
        <path d="M0 560 Q260 430 520 520 T1040 500 T1600 470 V900 H0Z" fill="#d98a64" />
        <path d="M0 640 Q300 560 640 620 T1300 590 T1600 600 V900 H0Z" fill="#c4643f" />
        {/* A pagoda on the far hill: Kyoto, roughly. */}
        <g fill="#7a3b2e" transform="translate(470 420)">
          <rect x="-6" y="-120" width="12" height="40" />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i} transform={`translate(0 ${-80 + i * 34})`}>
              <path d={`M${-34 - i * 6} 0 L${34 + i * 6} 0 L${22 + i * 5} -10 L${-22 - i * 5} -10Z`} />
              <rect x={-14 - i * 3} y="0" width={28 + i * 6} height="22" />
            </g>
          ))}
        </g>
      </Layer>
      <Layer className="season-near">
        <path d="M0 760 Q400 700 800 745 T1600 720 V900 H0Z" fill="#a9512f" />
        <g stroke="#4f2f25" strokeLinecap="round" fill="none">
          <path d="M1330 900 C1326 800 1345 700 1318 590" strokeWidth="26" />
          <path d="M1326 690 C1280 650 1230 640 1180 600" strokeWidth="13" />
          <path d="M1334 650 C1390 610 1440 600 1490 560" strokeWidth="13" />
        </g>
        <Canopy
          origin="1330px 900px"
          blobs={[
            [1180, 560, 90, "#d8452a"], [1300, 500, 120, "#e8673a"], [1440, 520, 100, "#c7362a"],
            [1240, 430, 85, "#f08c45"], [1380, 400, 95, "#dc4f2c"], [1520, 450, 80, "#f2a24e"],
            [1120, 470, 60, "#e8673a"], [1330, 330, 70, "#f4b45a"], [1470, 610, 70, "#d8452a"],
          ]}
        />
      </Layer>
    </>
  );
}

function Winter() {
  return (
    <>
      <Layer className="season-far">
        <defs>
          <linearGradient id="wi-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d9e4ec" />
            <stop offset="1" stopColor="#f1f5f8" />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#wi-sky)" />
        <path d="M0 560 L220 360 L380 470 L620 260 L860 470 L1040 330 L1260 500 L1420 390 L1600 480 V900 H0Z" fill="#ffffff" />
        <path d="M620 260 L700 380 L660 370 L640 430 L600 360 Z M1040 330 L1100 420 L1060 410 Z M220 360 L270 420 L230 415 Z" fill="#b8c7d4" />
        {/* Snow-laden cedars. */}
        {[1180, 1250, 1320, 1400, 1470].map((x, i) => (
          <g key={x} transform={`translate(${x} ${560 + (i % 2) * 20})`}>
            <path d="M0 -110 L40 0 L-40 0Z" fill="#5f7466" />
            <path d="M0 -110 L22 -50 L-22 -50Z" fill="#ffffff" />
          </g>
        ))}
      </Layer>
      <Layer className="season-near">
        <path d="M0 700 Q400 650 800 690 T1600 680 V900 H0Z" fill="#ffffff" />
        {/* Jigokudani: the onsen and its monkey, Nagano. */}
        <g transform="translate(420 0)">
          {[[-250, 800, 46], [-200, 845, 40], [250, 805, 44], [205, 850, 38], [-120, 870, 34], [120, 872, 34]].map(([x, y, r], i) => (
            <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.7} fill="#8e9aa3" />
          ))}
          <ellipse cx="0" cy="815" rx="250" ry="62" fill="#8cc0cc" />
          <ellipse cx="0" cy="805" rx="220" ry="40" fill="#a9d3dc" />
          {[-90, -30, 40, 100].map((x, i) => (
            <path key={x} className="season-steam" style={{ animationDelay: `${i * 0.9}s` }} d={`M${x} 760 c-18 -26 18 -42 0 -70 c-18 -28 16 -44 0 -72`} stroke="#ffffff" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.8" />
          ))}
          <g className="season-monkey">
            <ellipse cx="0" cy="790" rx="74" ry="40" fill="#8b786b" />
            <circle cx="0" cy="735" r="50" fill="#9c887a" />
            <circle cx="-42" cy="738" r="12" fill="#8b786b" />
            <circle cx="42" cy="738" r="12" fill="#8b786b" />
            <ellipse cx="0" cy="745" rx="29" ry="31" fill="#e38978" />
            <g className="season-blink" style={{ transformOrigin: "0px 737px" }}>
              <circle cx="-11" cy="737" r="4.5" fill="#3a2a26" />
              <circle cx="11" cy="737" r="4.5" fill="#3a2a26" />
            </g>
            <ellipse cx="0" cy="752" rx="5" ry="3" fill="#b9655a" />
            <path d="M-9 763 Q0 768 9 763" stroke="#9e5249" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <ellipse cx="2" cy="690" rx="30" ry="10" fill="#ffffff" />
          </g>
        </g>
      </Layer>
    </>
  );
}

function Spring() {
  return (
    <>
      <Layer className="season-far">
        <defs>
          <linearGradient id="sp-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fde5ec" />
            <stop offset="1" stopColor="#fdf3ee" />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#sp-sky)" />
        <path d="M520 600 L820 300 L1120 600Z" fill="#a9b9d3" />
        <path d="M820 300 L880 360 L850 355 L830 385 L800 352 L770 362Z" fill="#ffffff" />
        <path d="M0 600 Q300 520 640 580 T1300 560 T1600 570 V900 H0Z" fill="#b9d3a6" />
      </Layer>
      <Layer className="season-near">
        <path d="M0 760 Q400 720 800 750 T1600 735 V900 H0Z" fill="#9cc08a" />
        <g stroke="#5b3f37" strokeLinecap="round" fill="none">
          <path d="M240 900 C246 800 226 700 256 600" strokeWidth="24" />
          <path d="M248 680 C300 640 350 630 400 590" strokeWidth="12" />
          <path d="M240 650 C190 610 140 600 90 560" strokeWidth="12" />
        </g>
        <Canopy
          origin="240px 900px"
          blobs={[
            [100, 540, 90, "#f7c3d2"], [240, 490, 120, "#f9d2dd"], [390, 530, 100, "#f4b1c4"],
            [170, 420, 85, "#fbdbe4"], [320, 400, 90, "#f7c3d2"], [40, 460, 70, "#f4b1c4"],
            [460, 470, 60, "#fbdbe4"], [250, 330, 70, "#fde6ec"],
          ]}
        />
      </Layer>
    </>
  );
}

function Summer() {
  return (
    <>
      <Layer className="season-far">
        <defs>
          <linearGradient id="su-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bfe0e6" />
            <stop offset="0.7" stopColor="#f8e2c4" />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#su-sky)" />
        <path d="M480 620 L800 290 L1120 620Z" fill="#6f8eaa" />
        <path d="M800 290 L850 340 L825 336 L805 360 L782 338 L758 345Z" fill="#eef3f7" />
        <path d="M0 620 Q300 540 640 600 T1300 580 T1600 590 V900 H0Z" fill="#7fae6e" />
      </Layer>
      <Layer className="season-near">
        <path d="M0 770 Q400 730 800 760 T1600 745 V900 H0Z" fill="#5d8f55" />
        {/* Bamboo on the right. */}
        {[1380, 1430, 1490, 1545].map((x, i) => (
          <g key={x} className="season-canopy" style={{ transformOrigin: `${x}px 900px`, animationDelay: `${i * 0.6}s` }}>
            <rect x={x} y={240 + i * 30} width="18" height={660 - i * 30} rx="9" fill="#6f9c5a" />
            {[0, 1, 2, 3, 4].map((j) => (
              <rect key={j} x={x - 2} y={320 + i * 30 + j * 110} width="22" height="5" rx="2" fill="#557f45" />
            ))}
          </g>
        ))}
      </Layer>
    </>
  );
}

/* ---- The chosen scenes. Not seasons: shown only when picked. ---- */

/** Round to a tenth, so generated shapes print short. */
const r1 = (n: number) => Math.round(n * 10) / 10;

/** A hydrangea head: a dark ball covered in florets. [base, light, deep]. */
function Hydrangea({ cx, cy, r, colours, seed }: { cx: number; cy: number; r: number; colours: [string, string, string]; seed: number }) {
  const [base, light, deep] = colours;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={deep} />
      {Array.from({ length: 16 }, (_, i) => {
        const a = noise(seed + i, 1) * Math.PI * 2;
        const d = Math.sqrt(noise(seed + i, 2)) * r * 0.78;
        return <circle key={i} cx={r1(cx + Math.cos(a) * d)} cy={r1(cy + Math.sin(a) * d * 0.9)} r={r1(r * (0.24 + noise(seed + i, 3) * 0.12))} fill={i % 3 === 0 ? light : base} />;
      })}
    </g>
  );
}

const HYD_BLUE: [string, string, string] = ["#8aa6dc", "#b3c6ee", "#6a86c2"];
const HYD_VIOLET: [string, string, string] = ["#a892d4", "#c6b6e8", "#8670b8"];
const HYD_PINK: [string, string, string] = ["#e2a6c6", "#f2c8dc", "#c886ab"];

/** A bush: leaves, then heads on top. Heads are [cx, cy, r, colours].
 *  Still, not swaying: a bush is ~100 circles, and moving SVG repaints every
 *  frame (it measured as the dearest scene); the rain carries the motion. */
function HydrangeaBush({ heads }: { heads: [number, number, number, [string, string, string]][] }) {
  return (
    <g>
      {heads.map(([cx, cy, r], i) => (
        <g key={`l${i}`} fill="#4f7d5c">
          <ellipse cx={cx - r * 0.9} cy={cy + r * 0.7} rx={r * 0.75} ry={r * 0.38} transform={`rotate(-25 ${cx - r * 0.9} ${cy + r * 0.7})`} />
          <ellipse cx={cx + r * 0.9} cy={cy + r * 0.75} rx={r * 0.75} ry={r * 0.38} transform={`rotate(25 ${cx + r * 0.9} ${cy + r * 0.75})`} fill="#5d8d68" />
          <ellipse cx={cx} cy={cy + r * 1.05} rx={r * 0.9} ry={r * 0.45} fill="#456f52" />
        </g>
      ))}
      {heads.map(([cx, cy, r, colours], i) => (
        <Hydrangea key={i} cx={cx} cy={cy} r={r} colours={colours} seed={cx + cy} />
      ))}
    </g>
  );
}

function Tsuyu() {
  return (
    <>
      <Layer className="season-far">
        <defs>
          <linearGradient id="ts-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c9d0dc" />
            <stop offset="1" stopColor="#e6e4ec" />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#ts-sky)" />
        <path d="M0 520 Q240 400 520 470 T1080 440 T1600 460 V900 H0Z" fill="#b2bccb" />
        {/* A temple roof in the mist. */}
        <g fill="#8d97a8" transform="translate(1060 470)">
          <path d="M-120 0 Q-60 -22 0 -50 Q60 -22 120 0 L100 4 L-100 4Z" />
          <rect x="-80" y="4" width="160" height="46" />
        </g>
        <path d="M0 600 Q320 530 660 580 T1300 560 T1600 575 V900 H0Z" fill="#9fb0a6" />
      </Layer>
      <Layer className="season-near">
        <path d="M0 770 Q400 735 800 760 T1600 745 V900 H0Z" fill="#7f9a86" />
        {/* Puddles on the path, with rings from the rain. */}
        <ellipse cx="820" cy="850" rx="170" ry="22" fill="#a9b8c9" opacity="0.7" />
        <ellipse cx="560" cy="815" rx="90" ry="12" fill="#a9b8c9" opacity="0.6" />
        <ellipse cx="1080" cy="830" rx="110" ry="14" fill="#a9b8c9" opacity="0.6" />
        {[[760, 850, 0], [880, 846, 1.1], [560, 815, 2], [1060, 830, 0.6], [1110, 832, 2.4], [820, 856, 1.7]].map(([x, y, d], i) => (
          <ellipse key={i} className="season-ripple" style={{ animationDelay: `${d}s` }} cx={x} cy={y} rx="34" ry="6" fill="none" stroke="#f4f7fb" strokeWidth="2" />
        ))}
        {/* Kept low: the page's small grey text sits around y 620–640 here,
            and a flower head behind it costs contrast in the dark theme. */}
        <HydrangeaBush heads={[
            [60, 740, 70, HYD_BLUE], [210, 724, 72, HYD_VIOLET], [370, 750, 68, HYD_BLUE],
            [130, 842, 66, HYD_PINK], [290, 836, 74, HYD_BLUE], [460, 850, 60, HYD_VIOLET],
          ]}
        />
        <HydrangeaBush heads={[
            [1210, 760, 66, HYD_PINK], [1350, 700, 80, HYD_BLUE], [1500, 730, 76, HYD_VIOLET],
            [1150, 850, 60, HYD_VIOLET], [1300, 836, 72, HYD_PINK], [1460, 840, 70, HYD_BLUE], [1590, 820, 58, HYD_PINK],
          ]}
        />
        {/* Two small heads by the path, for a phone's narrow view. */}
        <HydrangeaBush heads={[[660, 870, 44, HYD_VIOLET], [950, 875, 46, HYD_BLUE]]} />
      </Layer>
    </>
  );
}

/** Fuji's outline, from the far shore at y 640: wide, with concave slopes. */
const FUJI = "M-40 640 Q620 560 744 222 Q760 212 776 210 L830 210 Q846 212 860 222 Q986 560 1640 640Z";
/** Summit at x 640, left of the day card on a wide screen and still in the
 *  middle strip a phone shows. */
const FUJI_SHIFT = -160;
const FUJI_SNOW = "M744 222 Q760 212 776 210 L830 210 Q846 212 860 222 Q880 280 900 322 L880 316 L866 350 L846 320 L826 356 L806 322 L784 352 L764 318 L744 346 L728 314 L706 322 Q726 280 744 222Z";

function Fuji() {
  return (
    <>
      <Layer className="season-far">
        <defs>
          <linearGradient id="fj-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8496cc" />
            <stop offset="0.42" stopColor="#eba5aa" />
            <stop offset="0.66" stopColor="#ffc68e" />
          </linearGradient>
          <linearGradient id="fj-lake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f3b39c" />
            <stop offset="1" stopColor="#7387bd" />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#fj-sky)" />
        <circle cx="1250" cy="560" r="170" fill="#ffd29a" opacity="0.7" />
        <circle cx="1250" cy="572" r="62" fill="#fff3dc" />
        <rect y="640" width="1600" height="260" fill="url(#fj-lake)" />
        {/* The reflection, upside down in the still water, softened by the
            blur; the mountain itself is drawn crisp in the near layer. */}
        <g transform={`translate(${FUJI_SHIFT} 1280) scale(1 -1)`} opacity="0.45">
          <path d={FUJI} fill="#4f5891" />
          <path d={FUJI_SNOW} fill="#ffffff" />
        </g>
        <rect x="1210" y="640" width="80" height="200" fill="#fff3dc" opacity="0.45" />
      </Layer>
      <Layer className="season-near">
        <g transform={`translate(${FUJI_SHIFT} 0)`}>
          <path d={FUJI} fill="#4f5891" />
          {/* The shadowed east face. */}
          <path d="M803 210 L830 210 Q846 212 860 222 Q986 560 1640 640 L1100 640 Q900 420 803 210Z" fill="#454d84" />
          <path d={FUJI_SNOW} fill="#fbf6f8" />
        </g>
        <path d="M0 636 Q200 626 420 634 T900 636 T1600 632 V646 H0Z" fill="#3c4476" />
        {/* Light on the water, under the sun. */}
        {[[1250, 662, 70, 0], [1220, 690, 50, 0.9], [1276, 716, 64, 1.8], [1238, 748, 40, 0.5], [1260, 782, 56, 2.4], [900, 700, 40, 1.3], [720, 750, 52, 2.9], [840, 800, 46, 0.3]].map(([x, y, w, d], i) => (
          <rect key={i} className="season-glint" style={{ animationDelay: `${d}s` }} x={x - w / 2} y={y} width={w} height="3" rx="1.5" fill="#fff6e6" />
        ))}
        {/* The near shore, low, with reeds. */}
        <path d="M0 860 Q200 830 420 850 Q500 858 560 900 H0Z" fill="#5d6886" />
        <path d="M1600 850 Q1400 830 1200 852 Q1120 862 1060 900 H1600Z" fill="#5d6886" />
        {[[40, 0], [90, 0.6], [150, 1.2], [210, 0.3], [270, 1.8], [1360, 0.9], [1420, 0.2], [1480, 1.5], [1540, 0.7]].map(([x, d], i) => (
          <g key={i} className="season-canopy" style={{ transformOrigin: `${x}px 880px`, animationDelay: `${d}s` }}>
            <path d={`M${x} 880 Q${x + 6} 800 ${x + 18} ${720 + (i % 3) * 25}`} stroke="#4c5672" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d={`M${x + 10} 880 Q${x + 2} 820 ${x - 14} ${760 + (i % 2) * 30}`} stroke="#56607e" strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        ))}
      </Layer>
    </>
  );
}

/** A five-storey pagoda, base at (x, y). */
function Pagoda({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return (
    <g fill={fill} transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-3" y="-260" width="6" height="70" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(0 ${-190 + i * 38})`}>
          <path d={`M${-40 - i * 8} 4 Q0 -4 ${40 + i * 8} 4 L${26 + i * 6} -10 L${-26 - i * 6} -10Z`} />
          <rect x={-16 - i * 3} y="2" width={32 + i * 6} height="36" />
        </g>
      ))}
    </g>
  );
}

/** A round paper lantern hanging from (x, y). Plain: no writing on it. */
/** `delay` null: hangs still. Moving SVG repaints every frame, so a scene
 *  swings only some of its lanterns. */
function Lantern({ x, y, s, body, glow, delay }: { x: number; y: number; s: number; body: string; glow: string; delay: number | null }) {
  const cy = y + 34 * s;
  const swing = delay === null ? {} : { className: "season-lantern", style: { transformOrigin: `${x}px ${y}px`, animationDelay: `${delay}s` } };
  return (
    <g {...swing}>
      <circle cx={x} cy={cy} r={32 * s} fill={glow} opacity="0.16" />
      <line x1={x} y1={y} x2={x} y2={y + 9 * s} stroke="#1e1418" strokeWidth={2 * s} />
      <rect x={x - 9 * s} y={y + 7 * s} width={18 * s} height={6 * s} fill="#1e1418" />
      <ellipse cx={x} cy={cy} rx={20 * s} ry={23 * s} fill={body} />
      <ellipse cx={x} cy={cy} rx={11 * s} ry={19 * s} fill={glow} opacity="0.6" />
      {[-12, 0, 12].map((dy) => (
        <path key={dy} d={`M${x - 19 * s} ${cy + dy * s} Q${x} ${cy + dy * s + 4 * s} ${x + 19 * s} ${cy + dy * s}`} stroke="#000000" strokeOpacity="0.18" strokeWidth={1.2 * s} fill="none" />
      ))}
      <rect x={x - 9 * s} y={cy + 21 * s} width={18 * s} height={6 * s} fill="#1e1418" />
    </g>
  );
}

const RED_LANTERN = { body: "#d4483a", glow: "#ffb47a" };
const WHITE_LANTERN = { body: "#f3e3c6", glow: "#fff4d8" };

/** One side of a street of wooden townhouses, in perspective toward the
 *  middle. `side` -1 is the left, 1 the right. */
function Machiya({ side }: { side: -1 | 1 }) {
  // Along the street, t = 0 at the screen edge, 1 at the far end.
  const xAt = (t: number) => (side < 0 ? t * 620 : 1600 - t * 620);
  const top = (t: number) => 320 + 230 * t;
  const bottom = (t: number) => 900 - 160 * t;
  const pt = (t: number, f: number) => `${r1(xAt(t))} ${r1(top(t) + (bottom(t) - top(t)) * f)}`;
  const quad = (t1: number, t2: number, f1: number, f2: number) => `M${pt(t1, f1)} L${pt(t2, f1)} L${pt(t2, f2)} L${pt(t1, f2)}Z`;
  return (
    <g>
      <path d={quad(0, 1, 0, 1)} fill="#3e2b31" />
      {/* Lit doorways and windows, each with a plain noren curtain. */}
      {[[0.04, 0.2], [0.28, 0.42], [0.52, 0.62], [0.72, 0.8], [0.86, 0.92]].map(([a, b], i) => (
        <g key={i}>
          <path d={quad(a, b, 0.3, 0.92)} fill="#f2ad6a" />
          <path d={quad(a, b, 0.3, 0.52)} fill={i % 2 ? "#3c4f7a" : "#8a3a35"} />
        </g>
      ))}
      {/* Wooden lattice. */}
      {Array.from({ length: 26 }, (_, i) => {
        const t = i / 26;
        return <path key={i} d={`M${pt(t, 0.12)} L${pt(t, 0.95)}`} stroke="#4a3238" strokeWidth={r1(4 - 2.8 * t)} />;
      })}
      {/* Eaves: a dark tiled roof line above, and a second one lower down. */}
      <path d={`M${pt(0, -0.06)} L${pt(1, -0.06)} L${pt(1, 0.06)} L${pt(0, 0.06)}Z`} fill="#231a20" />
      <path d={`M${pt(0, 0.22)} L${pt(1, 0.22)} L${pt(1, 0.28)} L${pt(0, 0.28)}Z`} fill="#2b2027" />
      {[0.08, 0.28, 0.48, 0.68, 0.88].map((t, i) => {
        const lantern = i % 3 === 2 ? WHITE_LANTERN : RED_LANTERN;
        return <Lantern key={t} x={xAt(t)} y={top(t) + (bottom(t) - top(t)) * 0.28} s={1.5 - 1.05 * t} {...lantern} delay={i % 2 ? null : i * 0.7} />;
      })}
    </g>
  );
}

function NightCity() {
  return (
    <>
      <Layer className="season-far">
        <defs>
          <linearGradient id="ni-sky" x1="0" y1="0" x2="0" y2="1">
            {/* Dusk, not night: a darker sky would hide the logo's dark
                mark in the dark theme. */}
            <stop offset="0" stopColor="#8a80c0" />
            <stop offset="0.4" stopColor="#b2729c" />
            <stop offset="0.62" stopColor="#e48e72" />
            <stop offset="0.8" stopColor="#f6b880" />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#ni-sky)" />
        <circle cx="1260" cy="150" r="24" fill="#fbe9c8" />
        <path d="M0 560 Q300 470 600 520 T1200 500 T1600 520 V900 H0Z" fill="#3b3150" />
        <Pagoda x={800} y={600} s={1.2} fill="#2a2238" />
        {/* Far rooftops with a few lights. */}
        <path d="M0 600 L80 580 L160 600 L240 585 L330 600 L420 582 L520 600 L640 590 L960 590 L1080 600 L1180 582 L1270 600 L1360 586 L1450 600 L1530 584 L1600 600 V900 H0Z" fill="#2f2740" />
        {Array.from({ length: 22 }, (_, i) => (
          <rect key={i} x={r1(20 + noise(i, 1) * 1560)} y={r1(605 + noise(i, 2) * 50)} width="10" height="7" fill="#ffcf8a" opacity={r1(0.5 + noise(i, 3) * 0.5)} />
        ))}
      </Layer>
      <Layer className="season-near">
        <defs>
          <linearGradient id="ni-street" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6e4a4e" />
            <stop offset="1" stopColor="#2f2330" />
          </linearGradient>
        </defs>
        <path d="M0 900 L620 740 L980 740 L1600 900Z" fill="url(#ni-street)" />
        {/* Warm light pooled on the stone. */}
        <path d="M700 900 L780 740 L820 740 L900 900Z" fill="#ffb87a" opacity="0.18" />
        <Machiya side={-1} />
        <Machiya side={1} />
        {/* A string of lanterns across the street, low (y 600 and down), so
            it passes under the page's buttons rather than behind them. */}
        <path d="M560 600 Q800 670 1040 600" stroke="#1e1418" strokeWidth="2.5" fill="none" />
        {[690, 800, 910].map((x, i) => {
          const f = (x - 560) / 480;
          const y = 600 + 4 * 35 * f * (1 - f);
          const lantern = i % 2 ? WHITE_LANTERN : RED_LANTERN;
          return <Lantern key={x} x={x} y={r1(y)} s={0.85} {...lantern} delay={i * 0.55} />;
        })}
      </Layer>
    </>
  );
}

/** A firework: rays and sparks round a centre. */
function Burst({ cx, cy, r, colour, tip, rays, delay, duration }: { cx: number; cy: number; r: number; colour: string; tip: string; rays: number; delay: number; duration: number }) {
  return (
    <g className="season-burst" style={{ animationDelay: `${delay}s`, animationDuration: `${duration}s` }}>
      {Array.from({ length: rays }, (_, i) => {
        const a = (i / rays) * Math.PI * 2 + noise(i, cx) * 0.12;
        const len = r * (0.82 + noise(i, cy) * 0.18);
        const x1 = r1(cx + Math.cos(a) * r * 0.2);
        const y1 = r1(cy + Math.sin(a) * r * 0.2);
        const x2 = r1(cx + Math.cos(a) * len);
        const y2 = r1(cy + Math.sin(a) * len);
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colour} strokeWidth="3" strokeLinecap="round" opacity="0.85" />
            <circle cx={x2} cy={y2} r="4.5" fill={tip} />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={r * 0.12} fill={tip} opacity="0.7" />
    </g>
  );
}

/** A festival stall: striped awning, lit counter. No signs. */
function Stall({ x, stripe }: { x: number; stripe: string }) {
  // Cloth is a muted cream, not white: the stalls sit behind the page's
  // small grey text, and a bright band there would cost it contrast.
  const cloth = "#e2d2bf";
  const y = 716; // the awning's top edge
  return (
    <g>
      <rect x={x + 10} y={y + 36} width="8" height="100" fill="#1c1622" />
      <rect x={x + 222} y={y + 36} width="8" height="100" fill="#1c1622" />
      <rect x={x + 18} y={y + 52} width="204" height="44" fill="#f0b26c" opacity="0.75" />
      <rect x={x + 18} y={y + 96} width="204" height="40" fill="#3a2a34" />
      <path d={`M${x} ${y + 36} L${x + 20} ${y} L${x + 220} ${y} L${x + 240} ${y + 36}Z`} fill={cloth} />
      {[0, 2, 4].map((i) => (
        <path key={i} d={`M${x + 20 + i * 40} ${y} L${x + 60 + i * 40} ${y} L${x + 60 + i * 40 + (i - 2) * 4} ${y + 36} L${x + 20 + i * 40 + (i - 2) * 4} ${y + 36}Z`} fill={stripe} />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <circle key={i} cx={x + 15 + i * 30} cy={y + 38} r="15" fill={i % 2 ? stripe : cloth} />
      ))}
    </g>
  );
}

/** Wire height for the festival's lantern strings: poles every 400, at
 *  y 640, below the page's buttons, sagging between them. */
const WIRE_Y = 640;
const festivalWire = (x: number) => {
  const f = (((x % 400) + 400) % 400) / 400;
  return WIRE_Y + 4 * 36 * f * (1 - f);
};

function Matsuri() {
  return (
    <>
      <Layer className="season-far">
        <defs>
          <linearGradient id="ma-sky" x1="0" y1="0" x2="0" y2="1">
            {/* Late dusk, light enough at the top for the logo's dark mark. */}
            <stop offset="0" stopColor="#7c74b6" />
            <stop offset="0.55" stopColor="#5a4580" />
            <stop offset="1" stopColor="#8a5272" />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#ma-sky)" />
        <path d="M0 600 Q260 520 560 570 T1160 540 T1600 560 V900 H0Z" fill="#2a2342" />
      </Layer>
      <Layer className="season-near">
        {/* Fireworks keep to the edges, or high in the middle, so none sits
            behind the page's text. */}
        <Burst cx={800} cy={100} r={75} colour="#ffd36e" tip="#fff2c4" rays={18} delay={0} duration={5.2} />
        <Burst cx={250} cy={210} r={100} colour="#c8a0ff" tip="#efe2ff" rays={20} delay={-2.4} duration={6.1} />
        <Burst cx={110} cy={420} r={70} colour="#8fd6ff" tip="#e2f5ff" rays={16} delay={-3.6} duration={5.0} />
        <Burst cx={1490} cy={240} r={90} colour="#ff9cc8" tip="#ffe0ee" rays={20} delay={-4.2} duration={5.4} />
        <Burst cx={1530} cy={470} r={55} colour="#ffd36e" tip="#fff2c4" rays={14} delay={-0.9} duration={4.9} />
        <path d="M0 830 Q400 815 800 825 T1600 820 V900 H0Z" fill="#2b2136" />
        {[-60, 220, 500, 780, 1060, 1340].map((x, i) => (
          <Stall key={x} x={x} stripe={i % 2 ? "#3d5f9e" : "#d14a3e"} />
        ))}
        {/* Lantern strings between poles, three lanterns a span. */}
        {[0, 400, 800, 1200, 1600].map((x) => (
          <rect key={x} x={x - 4} y={WIRE_Y - 20} width="8" height="210" fill="#1c1622" />
        ))}
        <path d={`M0 ${WIRE_Y} ${Array.from({ length: 4 }, (_, k) => `Q${k * 400 + 200} ${WIRE_Y + 72} ${k * 400 + 400} ${WIRE_Y}`).join(" ")}`} stroke="#1c1622" strokeWidth="2.5" fill="none" />
        {Array.from({ length: 12 }, (_, i) => {
          const x = Math.floor(i / 3) * 400 + 100 * ((i % 3) + 1);
          const lantern = i % 2 ? WHITE_LANTERN : RED_LANTERN;
          return <Lantern key={x} x={x} y={r1(festivalWire(x))} s={0.8} {...lantern} delay={i % 2 ? null : i * 0.45} />;
        })}
      </Layer>
    </>
  );
}

/** A torii, base of the pillars at (cx, base), scaled by s. */
function Torii({ cx, base, s }: { cx: number; base: number; s: number }) {
  const v = (n: number) => r1(n * s);
  const top = base - v(700);
  return (
    <g>
      <rect x={r1(cx - v(320) - v(20))} y={r1(top + v(70))} width={v(40)} height={v(630)} fill="#d9442a" />
      <rect x={r1(cx + v(320) - v(20))} y={r1(top + v(70))} width={v(40)} height={v(630)} fill="#d9442a" />
      <rect x={r1(cx - v(320) - v(26))} y={r1(base - v(46))} width={v(52)} height={v(46)} fill="#2b2224" />
      <rect x={r1(cx + v(320) - v(26))} y={r1(base - v(46))} width={v(52)} height={v(46)} fill="#2b2224" />
      {/* Nuki, the lower crossbar, and the plaque post above it. */}
      <rect x={r1(cx - v(390))} y={r1(top + v(150))} width={v(780)} height={v(30)} fill="#d9442a" />
      <rect x={r1(cx - v(14))} y={r1(top + v(70))} width={v(28)} height={v(80)} fill="#d9442a" />
      {/* Kasagi, the upturned top beam: vermilion under, black on top. */}
      <path d={`M${r1(cx - v(440))} ${r1(top + v(64))} Q${cx} ${r1(top + v(82))} ${r1(cx + v(440))} ${r1(top + v(64))} L${r1(cx + v(440))} ${r1(top + v(84))} Q${cx} ${r1(top + v(100))} ${r1(cx - v(440))} ${r1(top + v(84))}Z`} fill="#d9442a" />
      <path d={`M${r1(cx - v(470))} ${r1(top + v(24))} Q${cx} ${r1(top + v(52))} ${r1(cx + v(470))} ${r1(top + v(24))} L${r1(cx + v(450))} ${r1(top + v(62))} Q${cx} ${r1(top + v(78))} ${r1(cx - v(450))} ${r1(top + v(62))}Z`} fill="#2b2224" />
    </g>
  );
}

/** A stone lantern (tōrō), base at (x, y). */
function Toro({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g fill="#9a958c" transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-34" y="-20" width="68" height="20" />
      <rect x="-12" y="-110" width="24" height="90" />
      <rect x="-30" y="-130" width="60" height="20" />
      <rect x="-22" y="-180" width="44" height="50" fill="#b6b0a6" />
      <rect x="-10" y="-168" width="20" height="26" fill="#ffd98e" />
      <path d="M-46 -180 L0 -214 L46 -180Z" />
      <circle cx="0" cy="-220" r="8" />
    </g>
  );
}

/** A tall cedar at x, foot at y. */
function Cedar({ x, y, h, delay }: { x: number; y: number; h: number; delay: number }) {
  return (
    <g className="season-canopy" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${delay}s` }}>
      <rect x={x - 10} y={y - h * 0.5} width="20" height={h * 0.5} fill="#5a4136" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${x} ${y - h + i * h * 0.17} L${x + 70 + i * 16} ${y - h * 0.6 + i * h * 0.17} L${x - 70 - i * 16} ${y - h * 0.6 + i * h * 0.17}Z`} fill={i % 2 ? "#3f6650" : "#4a7359"} />
      ))}
    </g>
  );
}

function Shrine() {
  // Torii receding up the path to the hall, seen from a little above, so
  // every top beam stays low (y 620 and down), under the page's text; the
  // nearest gates run off the bottom edge. Farthest first: nearest on top.
  const gates = [0.1, 0.125, 0.155, 0.19, 0.235, 0.29, 0.36, 0.45, 0.56];
  return (
    <>
      <Layer className="season-far">
        <defs>
          <linearGradient id="sh-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f2e9dc" />
            <stop offset="1" stopColor="#f8e1c8" />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#sh-sky)" />
        <path d="M0 520 Q260 380 560 450 T1100 410 T1600 440 V900 H0Z" fill="#9fb293" />
        <path d="M0 600 Q300 520 640 560 T1300 540 T1600 560 V900 H0Z" fill="#7d9878" />
        {Array.from({ length: 16 }, (_, i) => {
          const x = r1(40 + i * 100 + noise(i, 1) * 40);
          const h = r1(160 + noise(i, 2) * 90);
          return <path key={i} d={`M${x} ${r1(580 - h)} L${x + 46} 590 L${x - 46} 590Z`} fill={i % 2 ? "#4f6e58" : "#5b7c62"} />;
        })}
        {/* The main hall, up the steps: a steep cypress roof with crossed
            finials, vermilion posts, white walls. */}
        <g transform="translate(800 615) scale(0.5)">
          <rect x="-200" y="-20" width="400" height="20" fill="#cfc4b4" />
          <rect x="-160" y="-120" width="320" height="100" fill="#f4ede2" />
          {[-150, -90, -30, 30, 90, 150].map((x) => (
            <rect key={x} x={x - 6} y="-120" width="12" height="100" fill="#d9442a" />
          ))}
          <path d="M-220 -116 Q-120 -150 -40 -220 L40 -220 Q120 -150 220 -116 L200 -110 L-200 -110Z" fill="#5d4a40" />
          <path d="M-40 -220 L-70 -262 M-40 -220 L-14 -258 M40 -220 L70 -262 M40 -220 L14 -258" stroke="#5d4a40" strokeWidth="9" strokeLinecap="round" />
        </g>
      </Layer>
      <Layer className="season-near">
        {/* The stone path, narrowing to the hall. */}
        <path d="M560 900 L790 615 L810 615 L1040 900Z" fill="#d9ccb8" />
        <path d="M0 900 L0 700 Q300 660 790 615 L560 900Z M1600 900 L1600 700 Q1300 660 810 615 L1040 900Z" fill="#8aa07e" />
        <Cedar x={70} y={900} h={760} delay={0} />
        <Cedar x={230} y={880} h={600} delay={1.6} />
        <Cedar x={1530} y={900} h={760} delay={0.8} />
        <Cedar x={1370} y={880} h={600} delay={2.2} />
        {gates.map((s) => (
          <Torii key={s} cx={800} base={r1(612 + 755 * s)} s={s} />
        ))}
        <Toro x={420} y={890} s={0.95} />
        <Toro x={1180} y={890} s={0.95} />
        <Toro x={600} y={760} s={0.5} />
        <Toro x={1000} y={760} s={0.5} />
      </Layer>
    </>
  );
}

export function Scene({ season }: { season: Background }) {
  if (season === "autumn") return <Autumn />;
  if (season === "winter") return <Winter />;
  if (season === "spring") return <Spring />;
  if (season === "tsuyu") return <Tsuyu />;
  if (season === "fuji") return <Fuji />;
  if (season === "night") return <NightCity />;
  if (season === "matsuri") return <Matsuri />;
  if (season === "shrine") return <Shrine />;
  return <Summer />;
}
