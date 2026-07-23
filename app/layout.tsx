import type { Metadata } from "next";
import "./globals.css";
import { pageTitle, sectionMeta } from "./routes";
import SiteView from "./site-view";

export const metadata: Metadata = {
  title: pageTitle(sectionMeta.home),
  description: sectionMeta.home.description,
};

// SiteView 掛在 layout，切換專區時不會 remount，已載入的新聞、裁判統計與
// 人才名冊得以保留。各個 page 只負責提供該網址的 metadata。
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <SiteView />
        {children}
      </body>
    </html>
  );
}
