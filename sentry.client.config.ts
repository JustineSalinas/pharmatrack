import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // Only enable in production to avoid noise in dev
  enabled: process.env.NODE_ENV === "production",

  // Don't send PII (student emails, names)
  sendDefaultPii: false,
});
