"use client";

/** The seasonal backdrop: a blurred Japanese scene behind every page, with
 *  something falling in front of it — maple leaves in autumn, snow over the
 *  Jigokudani monkeys in winter, cherry petals in spring, fireflies in
 *  summer. Five more scenes (rain over hydrangeas, Fuji at dawn, a lantern-lit
 *  street, a summer festival, a shrine's torii path) show only when chosen.
 *
 *  The season follows today's date, unless a page says otherwise: a trip
 *  page sets its trip's season with <UseSeason>, so a November trip looks
 *  like November whenever you plan it. A season or scene picked in
 *  Settings → Background (`chosen`, from a cookie) wins over both,
 *  everywhere. `?season=winter` (or `?season=fuji`) previews any of them.
 *
 *  It is decoration only: fixed behind the content, aria-hidden, never
 *  interactive, and still under prefers-reduced-motion (globals.css). */
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { Scene } from "./scenes";
import { noise, previewOf, seasonOf, type Background, type Season } from "./season";

const SetSeason = createContext<(s: Season | null) => void>(() => {});

// Browser-only. Today's season is worked out in the traveller's own time
// zone, and the particles' positions are floats the server and the browser
// print differently — rendering them on the server is a hydration mismatch.
// So on the server (and during hydration) there is no backdrop; it renders
// after hydration and fades in, even when the season is already `chosen`.
const noSubscribe = () => () => {};
function browserSeason(): Background {
  return previewOf(window.location.search) ?? seasonOf(new Date());
}
function hasPreview(): boolean {
  return previewOf(window.location.search) !== null;
}

export function SeasonalBackground({ chosen = null, children }: { chosen?: Background | null; children: ReactNode }) {
  const [override, setOverride] = useState<Season | null>(null);
  const today = useSyncExternalStore(noSubscribe, browserSeason, () => null);
  const preview = useSyncExternalStore(noSubscribe, hasPreview, () => false);

  const season = today && (preview ? today : (chosen ?? override ?? today));

  return (
    <SetSeason.Provider value={setOverride}>
      {season && <Backdrop key={season} season={season} />}
      {children}
    </SetSeason.Provider>
  );
}

/** Put on a page to show that page's season instead of today's. */
export function UseSeason({ season }: { season: Season }) {
  const set = useContext(SetSeason);
  useEffect(() => {
    set(season);
    return () => set(null);
  }, [season, set]);
  return null;
}

// While the tab is hidden, every animation in the backdrop is paused
// (`data-paused`, globals.css), so nothing loops for a page nobody sees.
function onVisibility(change: () => void) {
  document.addEventListener("visibilitychange", change);
  return () => document.removeEventListener("visibilitychange", change);
}
const tabHidden = () => document.visibilityState === "hidden";

function Backdrop({ season }: { season: Background }) {
  const hidden = useSyncExternalStore(onVisibility, tabHidden, () => false);
  return (
    <div aria-hidden className="season-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden" data-season={season} data-paused={hidden ? "" : undefined}>
      <Scene season={season} />
      {/* The veil keeps text readable over the scene: densest in the middle,
          where content sits, lighter at the edges where the tree, the onsen
          and the bamboo are. */}
      <div className="season-veil absolute inset-0" />
      <Particles season={season} />
    </div>
  );
}

const COUNT: Record<Background, number> = {
  autumn: 18, winter: 50, spring: 24, summer: 18,
  tsuyu: 44, fuji: 14, night: 14, matsuri: 16, shrine: 14,
};
/** Each drifting-light scene places its motes from its own seed, so they
 *  don't all land in the same spots. */
const MOTE_SEED: Partial<Record<Background, number>> = { fuji: 101, night: 211, matsuri: 307, shrine: 401 };
/** A mote's left edge, in %: never in 2.5–50%, the column the home page's
 *  headline and body text fill on a wide screen (with room for its drift). */
function moteLeft(u: number): number {
  return u < 0.06 ? (u / 0.06) * 2.5 : 50 + ((u - 0.06) / 0.94) * 50;
}
const LEAF = ["#d8452a", "#e8673a", "#f08c45", "#c7362a", "#f2a24e"];
const PETAL = ["#f6b6c8", "#f9cbd7", "#f4a9bf"];
/** Drifting light: dawn haze over Fuji, lantern glow in town, festival
 *  sparks, sun motes in the shrine's cedars. [core, glow]. */
const MOTE: Partial<Record<Background, [string, string]>> = {
  fuji: ["#fff4e6", "rgba(255, 214, 170, 0.7)"],
  night: ["#ffe2a8", "rgba(255, 170, 80, 0.75)"],
  matsuri: ["#fff0c0", "rgba(255, 150, 90, 0.8)"],
  shrine: ["#fff3c4", "rgba(255, 210, 120, 0.7)"],
};

function Particles({ season }: { season: Background }) {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: COUNT[season] }, (_, i) => {
        const x = noise(i, 1) * 100;
        const delay = -noise(i, 2) * 20;
        const style = {
          left: `${x}%`,
          "--drift": `${(noise(i, 3) - 0.5) * 30}vw`,
          "--spin": `${(noise(i, 4) > 0.5 ? 1 : -1) * (360 + noise(i, 5) * 540)}deg`,
          animationDelay: `${delay}s`,
        } as CSSProperties;

        if (season === "winter") {
          const size = 3 + noise(i, 6) * 6;
          return (
            <span
              key={i}
              className="season-snow"
              style={{ ...style, width: size, height: size, animationDuration: `${9 + noise(i, 7) * 10}s`, opacity: 0.6 + noise(i, 8) * 0.4 }}
            />
          );
        }
        if (season === "tsuyu") {
          // Fine rain, slanting a little, quick and steady.
          return (
            <span
              key={i}
              className="season-rain"
              style={{ left: `${x}%`, height: `${40 + noise(i, 6) * 50}px`, animationDelay: `${-noise(i, 2) * 3}s`, animationDuration: `${1.1 + noise(i, 7) * 0.9}s`, opacity: 0.35 + noise(i, 8) * 0.4 }}
            />
          );
        }
        const mote = MOTE[season];
        if (mote) {
          const j = i + (MOTE_SEED[season] ?? 0);
          const size = 4 + noise(j, 6) * 6;
          return (
            <span
              key={i}
              className="season-mote"
              style={{
                left: `${moteLeft(noise(j, 1))}%`,
                top: `${(season === "matsuri" ? 20 : 30) + noise(j, 9) * 60}%`,
                width: size,
                height: size,
                background: mote[0],
                boxShadow: `0 0 ${size * 2}px ${size * 0.6}px ${mote[1]}`,
                animationDelay: `${delay}s, ${-noise(i, 10) * 4}s`,
                animationDuration: `${14 + noise(i, 11) * 10}s, ${3 + noise(i, 12) * 3}s`,
              }}
            />
          );
        }
        if (season === "summer") {
          return (
            <span
              key={i}
              className="season-firefly"
              style={{ left: `${x}%`, top: `${35 + noise(i, 9) * 60}%`, animationDelay: `${delay}s, ${-noise(i, 10) * 3}s`, animationDuration: `${7 + noise(i, 11) * 6}s, ${2 + noise(i, 12) * 2}s` }}
            />
          );
        }
        const size = season === "autumn" ? 18 + noise(i, 6) * 16 : 12 + noise(i, 6) * 8;
        const color = season === "autumn" ? LEAF[i % LEAF.length] : PETAL[i % PETAL.length];
        return (
          <span key={i} className="season-fall" style={{ ...style, animationDuration: `${12 + noise(i, 7) * 12}s` }}>
            <span className="season-sway" style={{ animationDuration: `${3 + noise(i, 8) * 3}s` }}>
              <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
                {season === "autumn" ? (
                  <path d="M12 2l1.6 4.2 3-2.1-.6 3.9 4-1-2.4 3.3 3.4 1.7-4 1.2 1.8 3.4-3.9-1.3L12 22l-1.9-6.7-3.9 1.3 1.8-3.4-4-1.2 3.4-1.7L5 6.1l4 1-.6-3.9 3 2.1z" />
                ) : (
                  <path d="M12 3c4 3 5 9 0 18C7 12 8 6 12 3z" />
                )}
              </svg>
            </span>
          </span>
        );
      })}
    </div>
  );
}
