const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

// Sentry's webpack instrumentation adds real overhead to every dev compile
// and isn't useful outside production error tracking, so skip it locally.
module.exports = process.env.NODE_ENV === "production"
  ? withSentryConfig(nextConfig, {
      // Sentry build-time options
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,

      // Disable source map upload unless SENTRY_AUTH_TOKEN is set
      sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN,
      },

      // Tree-shake Sentry debug code in production
      disableLogger: true,

      // Don't auto-instrument routes we handle manually
      autoInstrumentServerFunctions: true,
      autoInstrumentMiddleware: true,
    })
  : nextConfig;
