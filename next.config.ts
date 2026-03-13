import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
      serverComponentsExternalPackages: ["@react-pdf/renderer"],

    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
