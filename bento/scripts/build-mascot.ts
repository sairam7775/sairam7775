/**
 * Writes Bento Man's Lottie files from the art source.
 *
 *   npm run mascot        (from bento/)
 *
 * The art lives in src/components/mascot/parts.ts and moods.ts. Run this
 * after changing either; lottie.test.ts fails while a file is stale.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildLottie, FILES } from "../src/components/mascot/lottie";

const dir = join(process.cwd(), "public", "mascot");
mkdirSync(dir, { recursive: true });
for (const key of FILES) {
  const json = JSON.stringify(buildLottie(key));
  writeFileSync(join(dir, `${key}.json`), json);
  console.log(`${key}.json  ${(json.length / 1024).toFixed(1)} KB`);
}
