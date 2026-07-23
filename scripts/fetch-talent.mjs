/**
 * 取得全國性平調查專業人才名冊。
 *
 * 這份名冊有 2000 多筆真實姓名與服務單位，刻意不放進 repo：git 歷史是永久的，
 * 教育部日後若修訂或移除某個人，舊版本仍會留在歷史裡。改由建置時取得，
 * 網站照常有資料，但原始碼裡沒有這份名單的任何版本。
 *
 * 取得順序：
 *   1. TALENT_SOURCE_URL 指定的網址（未公開列出的 gist 或 Release 附件，可隨時替換）
 *   2. 已發布網站上的前一版（第一次部署之後就會自給自足）
 *   3. 都取不到時寫出空名冊，網站顯示「名冊暫時無法載入」而不是壞掉
 *
 * 名冊本身由 scripts/extract-talent.py 從教育部 PDF 解析產生。那支解析器是針對
 * 特定版本手工調校過的，所以刻意不放進每晚的排程自動重跑——教育部改版時
 * 請在本機重跑並人工核對筆數後，再更新 Release 附件。
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "data", "talent.json");
const SITE_URL = process.env.SITE_URL?.replace(/\/$/, "") ?? "";
const SOURCE_URL = process.env.TALENT_SOURCE_URL ?? "";

/** 名冊規模的合理範圍。落在範圍外代表來源檔可能損壞，寧可不用也不要發布壞資料。 */
const MIN_RECORDS = 500;

function log(...args) {
  console.log("[fetch-talent]", ...args);
}

async function tryFetch(label, url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      log(`${label} 回應 ${response.status}，改用下一個來源`);
      return null;
    }
    const data = await response.json();
    const count = data?.records?.length ?? 0;
    if (count < MIN_RECORDS) {
      log(`${label} 只有 ${count} 筆，低於合理下限 ${MIN_RECORDS}，判定為損壞並略過`);
      return null;
    }
    log(`${label} 取得 ${count} 筆`);
    return data;
  } catch (error) {
    log(`${label} 取得失敗：${error.message}`);
    return null;
  }
}

const roster =
  (await tryFetch("指定來源", SOURCE_URL)) ??
  (await tryFetch("已發布網站", SITE_URL ? `${SITE_URL}/data/talent.json` : "")) ?? {
    updatedAt: "",
    sourceUrl: "https://www.gender.edu.tw/web/index.php/m7/m7_05_01_files_01?sid=210",
    notice: "名冊暫時無法載入，請改至教育部原始名冊查詢。",
    records: [],
  };

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(roster) + "\n");
log(`已寫入 public/data/talent.json（${roster.records.length} 筆）`);

// 區分「還沒設定」與「設定了但取不到」：前者是尚未完成的建置步驟，
// 網站會顯示名冊無法載入但其餘功能正常；後者代表來源壞了，必須讓 CI 失敗。
if (roster.records.length === 0) {
  if (SOURCE_URL && process.env.CI === "true") {
    throw new Error(
      `已設定 TALENT_SOURCE_URL 卻取不到有效名冊（${SOURCE_URL}）。\n` +
      "  來源可能失效，或檔案筆數低於下限而被判定為損壞。",
    );
  }
  log(
    "名冊為空，全國性平委員專區將顯示無法載入。若尚未設定來源：\n" +
    "  1. 本機執行 python scripts/extract-talent.py <名冊 PDF>\n" +
    "  2. 把產生的 talent.json 放到可直接下載的位置，核對筆數無誤\n" +
    "  3. 將該網址設成儲存庫 secret TALENT_SOURCE_URL",
  );
}
