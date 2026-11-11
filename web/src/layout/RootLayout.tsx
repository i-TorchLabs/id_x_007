import type { Metadata } from "next";
import "@/assets/styles/globals.css";
import Providers from "./Providers";

export const metadata: Metadata = {
  title: "SME UGO Appointment",
  description: "SME UGO 咨询预约",
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
