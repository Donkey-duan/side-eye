import type { NextConfig } from "next";

/**
 * GitHub Pages 的專案頁網址是 https://<使用者>.github.io/<專案名>/，
 * 網站因此不是掛在網域根目錄。basePath 由 CI 以環境變數帶入：
 *   - 專案頁：NEXT_PUBLIC_BASE_PATH=/<專案名>
 *   - 使用者頁（<使用者>.github.io）或自訂網域：留空
 * 留空時等同掛在根目錄，本機開發也走這條路。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
  // 產生 /victim/appeal/index.html 而不是 /victim/appeal.html，
  // 靜態主機對目錄式網址的處理較一致。
  trailingSlash: true,
};

export default nextConfig;
