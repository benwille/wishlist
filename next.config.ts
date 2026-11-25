import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cloudflare:email"],
  async headers() {
    return [...["/share/:path*", "/api/share/:path*"].map((source) => ({ source, headers: [
      { key: "Cache-Control", value: "private, no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ] })), {
      source: "/share/access/:key",
      headers: [{ key: "Referrer-Policy", value: "origin" }],
    }];
  },
};

export default nextConfig;
