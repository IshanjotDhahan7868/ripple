import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // old share links pointed at the home page; the tool now lives at /app
  async redirects() {
    return ["example", "live", "q", "force"].map((key) => ({
      source: "/",
      has: [{ type: "query" as const, key }],
      destination: "/app",
      permanent: false,
    }));
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
