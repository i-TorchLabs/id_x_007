import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*"],
  async redirects() {
    return [
      // 根路径与模块根路径均直达管理端登录页（旧 /login 另有页面级兼容重定向）
      {
        source: "/",
        destination: "/f/007/admin-login",
        permanent: false,
      },
      {
        source: "/f/007",
        destination: "/f/007/admin-login",
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
