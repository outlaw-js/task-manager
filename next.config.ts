import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker image builds a self-contained server (see Dockerfile); local `next start` stays unchanged.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
};

export default nextConfig;
