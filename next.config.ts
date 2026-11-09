import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* the on-disk webpack cache keeps corrupting on this machine and killing the dev server */
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};

export default nextConfig;
