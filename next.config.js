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
  async rewrites() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
    // Auth (only needs the apikey) and Realtime (a WebSocket upgrade that Route
    // Handlers can't proxy) stay on the plain rewrite — both already worked.
    // Everything else (REST/RPC/Storage) is handled by the explicit proxy at
    // src/app/supabase-api/[...path]/route.ts, which forwards the Authorization
    // header the rewrite was silently dropping (→ authenticated reads no longer
    // hit PostgREST as anon). beforeFiles so these win over the [...path] route.
    return {
      beforeFiles: [
        { source: "/supabase-api/auth/:path*", destination: `${supabaseUrl}/auth/:path*` },
        { source: "/supabase-api/realtime/:path*", destination: `${supabaseUrl}/realtime/:path*` },
      ],
    };
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
