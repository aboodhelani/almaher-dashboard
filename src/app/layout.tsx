import type { Metadata } from "next";
import { Amiri_Quran, IBM_Plex_Sans_Arabic } from "next/font/google";
import Shell from "@/components/Shell";
import "./globals.css";

const quranFont = Amiri_Quran({
  weight: "400",
  subsets: ["arabic"],
  variable: "--font-quran",
});

const uiFont = IBM_Plex_Sans_Arabic({
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "لوحة تحكم الماهر",
  description: "Live matches, history and questions for Al-Maher",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${quranFont.variable} ${uiFont.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
