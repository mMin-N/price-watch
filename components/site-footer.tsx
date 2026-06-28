import Link from "next/link";

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@example.com";

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`border-t border-border px-4 py-6 text-center text-xs text-muted ${className}`}
    >
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link href="/privacy" className="hover:underline">
          Privacy
        </Link>
        <Link href="/terms" className="hover:underline">
          Terms
        </Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline">
          Contact
        </a>
      </nav>
    </footer>
  );
}
