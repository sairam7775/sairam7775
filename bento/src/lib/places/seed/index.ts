/** Every city's drafted places, in export order. A new city is a new file
 *  in this folder, registered here: the exporter and the seed tests read
 *  this list, so a file left out of it is never exported and never
 *  tested. (The eval's MemoryStore loads the corridor files on its own, on
 *  purpose.) */
import type { PlaceSeed } from "./types";
import { hakone } from "./hakone";
import { himeji } from "./himeji";
import { hiroshima } from "./hiroshima";
import { kamakura } from "./kamakura";
import { kyoto } from "./kyoto";
import { miyajima } from "./miyajima";
import { nara } from "./nara";
import { nikko } from "./nikko";
import { osaka } from "./osaka";
import { tokyo } from "./tokyo";
import { yokohama } from "./yokohama";

export const placeSeeds: { file: string; places: PlaceSeed[] }[] = [
  { file: "kyoto.ts", places: kyoto },
  { file: "osaka.ts", places: osaka },
  { file: "nara.ts", places: nara },
  { file: "hiroshima.ts", places: hiroshima },
  { file: "miyajima.ts", places: miyajima },
  { file: "himeji.ts", places: himeji },
  { file: "tokyo.ts", places: tokyo },
  { file: "yokohama.ts", places: yokohama },
  { file: "kamakura.ts", places: kamakura },
  { file: "hakone.ts", places: hakone },
  { file: "nikko.ts", places: nikko },
];

export const allPlaces: PlaceSeed[] = placeSeeds.flatMap((s) => s.places);
