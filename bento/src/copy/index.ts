import { en, type Copy } from "./en";

/** The app's words. Import this, never a language file:
 *  `import { copy } from "@/copy"`, then `copy.settings.title`.
 *
 *  English is the only language today. Adding one means a file like
 *  `ja.ts` exporting `const ja: Copy` (the type makes it complete), and
 *  choosing one per request (a cookie, say) instead of this constant.
 *  The words themselves stay where they are. */
export const copy: Copy = en;
export type { Copy };
