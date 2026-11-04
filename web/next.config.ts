import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/f/007/login",
        permanent: false,
      },
      {
        source: "/f/007",
        destination: "/f/007/login",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/b/:path*",
        destination: `${process.env.BACKEND_URL ?? "http://localhost"}/b/:path*`,
      },
    ];
  },
};

export default nextConfig;
