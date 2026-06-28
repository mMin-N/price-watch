const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@example.com";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-zinc-800 dark:text-zinc-200">
      <h1 className="mb-6 text-3xl font-semibold">Terms of Service</h1>
      <p className="mb-4 text-sm text-zinc-500">Last updated: June 17, 2026</p>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-medium">Beta service</h2>
        <p>
          Dropt is offered as a public beta &quot;as is&quot; without warranties. Features,
          pricing, and availability may change without notice.
        </p>
      </section>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-medium">Your responsibilities</h2>
        <p>
          You are responsible for URLs you submit. Only track products you have a legitimate interest
          in monitoring. Do not use the service to abuse third-party websites or circumvent their
          terms.
        </p>
      </section>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-medium">Price accuracy</h2>
        <p>
          Displayed prices are fetched from third-party pages and may be delayed or incorrect. We do
          not guarantee accuracy, availability, or that alerts will fire before a promotion ends.
        </p>
      </section>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-medium">Acceptable use</h2>
        <p>
          Do not attempt to bypass rate limits, scrape through our API at scale, or interfere with
          other users. We may suspend accounts that abuse the service.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-medium">Contact</h2>
        <p>
          Questions about these terms:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </main>
  );
}
