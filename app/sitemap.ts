import type { MetadataRoute } from "next";
import { ALL_SECTIONS, JUDGE_TOPICS, VICTIM_TOPICS, viewPath } from "./routes";

// output: export 模式要求 metadata 路由明確宣告為靜態，否則 next build 會直接失敗
export const dynamic = "force-static";

/**
 * 正式站網址。CI 目前只在資料同步腳本（news／judicial／talent）注入 SITE_URL，
 * 建置網站那一步（.github/workflows/deploy.yml 的「建置靜態網站」）並未帶入這個
 * 環境變數，所以實際部署時幾乎都會落到下面的 fallback——這裡填的就是該檔案為
 * 本專案（Donkey-duan/side-eye 專案頁）算出的正式站網址，與 OPERATIONS.md 記載一致。
 * SITE_URL 依專案慣例已包含 GitHub Pages 的子路徑，不再另外疊加 basePath。
 */
const SITE_URL = (process.env.SITE_URL ?? "https://Donkey-duan.github.io/side-eye").replace(/\/$/, "");

// next.config.ts 設定 trailingSlash: true，靜態輸出是 /victim/appeal/index.html，
// 網址要以斜線結尾才對得到實際檔案；首頁本身就是「/」，不重複再補一個。
function absoluteUrl(pathname: string) {
  return pathname === "/" ? `${SITE_URL}/` : `${SITE_URL}${pathname}/`;
}

/** 全站頁面清單直接沿用 routes.ts 的路由定義；新增專區只要登記在那裡，這裡就會自動涵蓋。 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths: string[] = [
    viewPath("home"),
    viewPath("victim", "home"),
    ...VICTIM_TOPICS.map((topic) => viewPath("victim", topic)),
    ...ALL_SECTIONS.map((section) => viewPath(section)),
    ...JUDGE_TOPICS.map((topic) => viewPath("judges", "home", topic)),
  ];

  return paths.map((pathname) => ({
    url: absoluteUrl(pathname),
    lastModified: new Date(),
  }));
}
