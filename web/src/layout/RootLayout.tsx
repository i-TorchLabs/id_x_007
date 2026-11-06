import type { Metadata } from "next";
import "@/assets/styles/globals.css";
import Providers from "./Providers";

export const metadata: Metadata = {
  title: "UGO Peer Advisor Appointment",
  description: "UGO 朋辈顾问咨询预约系统（顾问浏览 / 预约 / 反馈）",
  icons: { icon: "/CUHKSZ-ICON.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
