import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Migrations are read from disk at runtime; make sure serverless bundles include them.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" }, // CSV imports
  },
};

export default nextConfig;
