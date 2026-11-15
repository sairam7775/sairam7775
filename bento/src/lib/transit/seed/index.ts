/** Every hand-seeded transit network, in export order. A new network is a
 *  new file in this folder, registered here: the exporter, the CLI and the
 *  seed tests all read this list, so a file left out of it is never
 *  exported and never tested. */
import type { Edge, Station } from "../types";
import * as kanagawa from "./kanagawa";
import * as kansaiSanyo from "./kansai-sanyo";
import * as tokyo from "./tokyo";

export interface TransitNetwork {
  /** The seed's file name in this folder. */
  file: string;
  /** How the generated SQL's header names it. */
  label: string;
  stations: Station[];
  edges: Edge[];
}

export const networks: TransitNetwork[] = [
  { file: "kansai-sanyo.ts", label: "the Kansai–Sanyo corridor", stations: kansaiSanyo.stations, edges: kansaiSanyo.edges },
  { file: "tokyo.ts", label: "Tokyo", stations: tokyo.stations, edges: tokyo.edges },
  { file: "kanagawa.ts", label: "Yokohama and Kamakura", stations: kanagawa.stations, edges: kanagawa.edges },
];

/** Every station of every network. Edges cross networks (Tokyo's
 *  Shinkansen ends at Kansai stations), so build graphs from all of them. */
export const stations: Station[] = networks.flatMap((n) => n.stations);
export const edges: Edge[] = networks.flatMap((n) => n.edges);
