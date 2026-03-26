import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /** App Router request body parser cap (multipart uploads, server actions). */
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
