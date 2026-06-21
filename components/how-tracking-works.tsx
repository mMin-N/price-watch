export function HowTrackingWorks() {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
      <p>
        Prices refresh automatically every 6 hours (12 hours for eBay and Meesho).
      </p>
      <p>Tracking pauses after 72 hours of account inactivity.</p>
      <p>
        Auto-refresh may pause on a product after repeated fetch failures. You can
        still view the last known price.
      </p>
      <p>
        Supported sites: Amazon, Flipkart, Meesho, eBay, plus a generic HTML
        fallback for other stores.
      </p>
    </div>
  );
}
