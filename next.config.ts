import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["node-cron"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
