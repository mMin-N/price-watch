const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@example.com";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-zinc-800 dark:text-zinc-200">
      <h1 className="mb-6 text-3xl font-semibold">Privacy Policy</h1>
      <p className="mb-4 text-sm text-zinc-500">Last updated: June 17, 2026</p>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-medium">What we collect</h2>
        <p>
          When you register, we store your email address and account identifier via Supabase Auth.
          When you track products, we store URLs you submit, fetched prices, alert settings, and
          notification history.
        </p>
      </section>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-medium">Third-party services</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Supabase — authentication and database hosting</li>
          <li>ZenRows — fetching public product pages to read prices</li>
          <li>Resend — sending price alert emails</li>
          <li>Sentry (if enabled) — error monitoring</li>
        </ul>
        <p>
          These providers process data on our behalf under their own privacy policies. We do not sell
          your personal data.
        </p>
      </section>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-medium">Data retention</h2>
        <p>
          Price history is kept while you track a product. If you delete a tracked product, related
          history is removed. Account data is deleted when you delete your account.
        </p>
      </section>

      <section className="mb-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-medium">International users</h2>
        <p>
          Dropt is operated internationally. By using the service from India or elsewhere, you
          consent to processing in jurisdictions where our infrastructure providers operate.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-medium">Contact</h2>
        <p>
          Questions about this policy:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </main>
  );
}
