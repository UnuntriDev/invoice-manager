import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["node-cron", "pdfjs-dist"],
  devIndicators: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
