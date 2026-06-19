export function captureException(
  error: unknown,
  context?: Record<string, string | number | boolean | undefined>
): void {
  console.error(
    JSON.stringify({
      step: "captured_exception",
      message: error instanceof Error ? error.message : String(error),
      sentryConfigured: Boolean(process.env.SENTRY_DSN),
      ...context,
    })
  );
}
