import { PageLoader } from "@/components/loading";

/** Shown while a page in this section loads. The home page has none: its
 *  first screen draws without waiting (route-loaders.test.ts). */
export default function Loading() {
  return <PageLoader />;
}
