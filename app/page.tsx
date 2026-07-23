import type { Metadata } from "next";
import { pageTitle, sectionMeta } from "./routes";

export const metadata: Metadata = {
  title: pageTitle(sectionMeta.home),
  description: sectionMeta.home.description,
  alternates: { canonical: "/" },
};

// 畫面由 layout 的 SiteView 依網址渲染，這裡只提供首頁的 metadata。
export default function HomePage() {
  return null;
}
