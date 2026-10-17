import { PageLoader } from "@/components/loading";
import { copy } from "@/copy";

export default function Loading() {
  return <PageLoader caption={copy.loading.vault} />;
}
