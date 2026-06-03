import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/vacation", destination: "/vacation.html" },
    ];
  },
};

export default nextConfig;
