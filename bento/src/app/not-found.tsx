import Link from "next/link";
import { StatusPage, primaryButton, secondaryButton } from "@/components/status-page";

export default function NotFound() {
  return (
    <StatusPage kicker="404" title="Nothing in this box.">
      <p>That page doesn&rsquo;t exist, or the trip isn&rsquo;t yours to open. Check the link, or go back to your trips.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/trips" className={primaryButton}>Your trips</Link>
        <Link href="/" className={secondaryButton}>Home</Link>
      </div>
    </StatusPage>
  );
}
