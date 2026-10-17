import Link from "next/link";
import { StatusPage, primaryButton, secondaryButton } from "@/components/status-page";
import { copy } from "@/copy";

export default function NotFound() {
  return (
    <StatusPage kicker={copy.status.notFound.kicker} title={copy.status.notFound.title}>
      <p>{copy.status.notFound.body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/trips" className={primaryButton}>{copy.common.yourTrips}</Link>
        <Link href="/" className={secondaryButton}>{copy.common.home}</Link>
      </div>
    </StatusPage>
  );
}
