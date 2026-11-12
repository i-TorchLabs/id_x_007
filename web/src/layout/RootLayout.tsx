import type { Metadata } from "next";
import "@/assets/styles/globals.css";
import Providers from "./Providers";

export const metadata: Metadata = {
  title: "SME UGO Appointment",
  description: "SME UGO Peer Advisor Appointment",
  icons: { icon: "/CUHKSZ-ICON.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
