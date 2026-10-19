/** Bento Man's art, as data. One description feeds two renderers: the
 *  still drawing (inline SVG, server-rendered) and the Lottie files the
 *  player animates. Colours are roles, not hex, so the figure follows the
 *  theme; see `docs/superpowers/specs/2026-10-19-bento-man-character-design.md`. */

/** Roles whose colour changes with the theme (CSS variables `--color-mascot-<role>`). */
export type ThemedRole = "line" | "rim" | "sheen" | "coat" | "belt" | "pants" | "muted";
/** Roles that look the same in both themes. */
export type FixedRole = "tile" | "face" | "ume" | "white" | "skin" | "paper" | "spark";
export type Role = ThemedRole | FixedRole;

/** Light-theme colour of each role: the still's attributes and the Lottie
 *  defaults. Themed roles are overridden by CSS in both themes. */
export const ROLE_COLOR: Record<Role, string> = {
  line: "#221C1E",
  rim: "#221C1E",
  sheen: "#5A5256",
  coat: "#2E4A7D",
  belt: "#1C2E52",
  pants: "#5A5256",
  muted: "#6F666B",
  tile: "#FFFFFF",
  face: "#221C1E",
  ume: "#FF7757",
  white: "#FFFFFF",
  skin: "#F6CFB3",
  paper: "#F4E9D6",
  spark: "#FFC94A",
};

export const THEMED_ROLES: ThemedRole[] = ["line", "rim", "sheen", "coat", "belt", "pants", "muted"];

export type Paint = {
  fill?: Role;
  stroke?: Role;
  width?: number;
  cap?: "round" | "butt";
  join?: "round" | "miter";
  dash?: [number, number];
  /** Fill or stroke opacity, 0–100. */
  opacity?: number;
};

export type Shape = Paint &
  (
    | { kind: "rect"; x: number; y: number; w: number; h: number; r: number }
    | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
    | { kind: "path"; d: string }
  );

/** A drawn piece that moves as one. `at` and `scale` place it in its
 *  parent's coordinates; `pivot` (its own coordinates) is what it turns
 *  and scales around. `opacity` and `restScale` are its values at rest. */
export interface Part {
  id: string;
  parent?: string;
  at?: [number, number];
  scale?: number;
  pivot?: [number, number];
  opacity?: number;
  restScale?: number;
  shapes: Shape[];
}

export type Prop = "position" | "rotation" | "scale" | "opacity";
export type Value = number | [number, number];

/** Keyframes for one property of one part. Frames are absolute (30 fps);
 *  position is an offset from rest, scale and opacity are percentages.
 *  `hold` jumps between keys instead of easing. */
export interface Track {
  part: string;
  prop: Prop;
  keys: [frame: number, value: Value][];
  hold?: boolean;
}

export type FigureKey = "head-rest" | "head-think" | "head-happy" | "head-hello" | "full-hello" | "full-lost";

/** One figure: its parts in paint order (first is drawn at the bottom), a
 *  one-time `intro` and a looping `idle`, both in frames. */
export interface Figure {
  key: FigureKey;
  form: "head" | "full";
  parts: Part[];
  intro: number;
  idle: number;
  tracks: Track[];
}
