"use client";

import type { AnimationItem } from "lottie-web";
import { useEffect, useRef, useState } from "react";
import { CANVAS, figureOf } from "./moods";
import { fileFor, segmentsOf, shouldAnimate } from "./playback";
import { MascotStill } from "./still";
import type { FigureKey } from "./types";

/** Bento Man. The still pose renders first (on the server too), in a box of
 *  fixed size, so nothing moves when he starts. Once he scrolls into view,
 *  and only if motion is allowed, the Lottie light player and his file load
 *  and the animation takes the still's place: the intro once, then the idle
 *  loop. Off-screen he pauses. If anything fails to load, the still stays.
 *  He is decoration: hidden from screen readers. */
export function BentoManFigure({ figure, size, className = "" }: { figure: FigureKey; size: number; className?: string }) {
  const host = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(false);
  const f = figureOf(figure);
  const c = CANVAS[f.form];
  const width = f.form === "head" ? size : Math.round((size * c.w) / c.h);

  useEffect(() => {
    const el = host.current;
    const file = fileFor(figure);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || !file || !shouldAnimate({ reducedMotion, file })) return;

    let anim: AnimationItem | null = null;
    let cancelled = false;
    let started = false;
    let visible = false;

    const start = async () => {
      started = true;
      try {
        const [{ default: lottie }, data] = await Promise.all([
          import("lottie-web/build/player/lottie_light"),
          fetch(file).then((r) => {
            if (!r.ok) throw new Error(`${file}: ${r.status}`);
            return r.json();
          }),
        ]);
        if (cancelled) return;
        const { intro, idle } = segmentsOf(data.markers);
        const a = lottie.loadAnimation({ container: el, renderer: "svg", loop: false, autoplay: false, animationData: data });
        anim = a;
        a.addEventListener("DOMLoaded", () => {
          if (cancelled) return;
          setPlaying(true);
          const loopIdle = () => {
            a.loop = true;
            a.playSegments(idle, true);
          };
          if (intro) {
            const done = () => {
              a.removeEventListener("complete", done);
              loopIdle();
            };
            a.addEventListener("complete", done);
            a.playSegments(intro, true);
          } else loopIdle();
          if (!visible) a.pause();
        });
      } catch {
        // The still stays; nothing else depends on the animation.
      }
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !started) void start();
      else if (anim) {
        if (visible) anim.play();
        else anim.pause();
      }
    });
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      anim?.destroy();
      setPlaying(false);
    };
  }, [figure]);

  return (
    <span aria-hidden="true" className={`mascot relative inline-block shrink-0 align-middle ${className}`} style={{ width, height: size }}>
      <span className="absolute inset-0" style={playing ? { visibility: "hidden" } : undefined}>
        <MascotStill figure={figure} size={size} />
      </span>
      <span ref={host} className="absolute inset-0" />
    </span>
  );
}
