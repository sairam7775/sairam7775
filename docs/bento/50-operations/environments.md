---
type: overview
status: accepted
last_reviewed: 2026-11-13
---

# Environments

| Environment | App | Database | Notes |
|---|---|---|---|
| **Production** | Vercel, `https://bento-zeta-six.vercel.app`, functions in Tokyo (`hnd1`), deployed from `main` | Supabase project `bento-tokyo` (`pwlxwncjzgrzvmhhrrap`, `ap-northeast-1`) | Since 12 November 2026 |
| **Preview** | A Vercel deployment per PR | The same Tokyo project (Preview variables) | Previews share production data, so test with care |
| **Local** | `npm run dev` | Whatever `bento/.env.local` points at | See [local setup](local-setup.md) |
| **Old** | — | Supabase project `bento` in Mumbai (`xjlrnhwmvlcidtnobrsg`), **paused** | Kept as a fallback after the move; to be deleted around 27 November 2026 |

How to deploy: [deploying](deploying.md). How the move was done: [region move](supabase-region-move.md).
