import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cloudflare:email"],
};

export default nextConfig;
