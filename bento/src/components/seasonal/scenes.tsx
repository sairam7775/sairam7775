/** The four seasonal scenes, drawn as SVG so there are no image downloads.
 *  Each has a far layer (sky, mountains — blurred heavily) and a near layer
 *  (the tree, the onsen — blurred lightly), so depth reads through the blur.
 *  Classes beginning `season-` are animated in globals.css. */
import type { ReactNode } from "react";
import type { Season } from "./season";

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

export function Scene({ season }: { season: Season }) {
  if (season === "autumn") return <Autumn />;
  if (season === "winter") return <Winter />;
  if (season === "spring") return <Spring />;
  return <Summer />;
}
