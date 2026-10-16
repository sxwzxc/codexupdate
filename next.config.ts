import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  assetPrefix: process.env.EDGEONE_PREVIEW_ASSET_PREFIX,
  poweredByHeader: false,
};

export default nextConfig;
