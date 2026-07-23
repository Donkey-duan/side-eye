/**
 * 由本機快取重算統計，產出網站要用的資料檔。
 *
 * 解壓與抽取很慢（29 個月約 25 分鐘），判準卻會反覆調整，所以兩件事分開：
 * import-judgments.mjs 只負責把裁判書抽成 cache/judgments.jsonl，這支則
 * 隨時可以重跑，幾秒鐘就能把新的判準套用到全部資料上。
 *
 * 用法：
 *   node scripts/analyse-judgments.mjs
 */

import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { summarise } from "./judgment-stats.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CACHE = join(ROOT, "cache", "judgments.jsonl");
const OUT_DIR = join(ROOT, "public", "data");

export async function readCache(path = CACHE) {
  const records = new Map();
  const months = new Set();
  const stream = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of stream) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    if (record.month) months.add(record.month);
    records.set(record.jid, record);
  }
  return { records: [...records.values()], months: [...months].sort() };
}

/**
 * 發布的紀錄檔不含主文。
 *
 * 主文裡有未被法院遮蔽的被告姓名——性侵害案件多半會遮成代號，但不是全部。
 * 站上逐案連回司法院原文是一回事，把一萬多筆性犯罪判決的姓名打包成一個
 * 可直接下載的檔案是另一回事。因此改為發布已經算好的分類結果，
 * 每筆保留 jid 可連回原文查證，完整主文只留在本機快取供調整判準使用。
 */
const PRIVATE_FIELDS = ["disposition"];

/**
 * 拆成三個檔案。
 *
 * judicial.json 是摘要，每一頁都會載入，必須小。
 * judicial-judges.json 是各法官的案件清單，只有進到法官頁才需要。
 * judgments.json 是逐筆紀錄，瀏覽器不載入；它的用途一是讓每晚的 API 同步
 * 能讀回前一版繼續累加，二是讓任何人都能拿去自行驗算本站的統計。
 */
export async function writeJudicial(records, months, sourceDate = "") {
  const stats = summarise(records);
  await mkdir(OUT_DIR, { recursive: true });

  // 分類結果隨紀錄一起發布，每晚同步讀回來就不必重新判讀，也不需要主文
  const published = stats.judgments.map((record) => {
    const copy = { ...record };
    for (const field of PRIVATE_FIELDS) delete copy[field];
    return copy;
  });

  await writeFile(join(OUT_DIR, "judgments.json"), JSON.stringify({
    updatedAt: new Date().toISOString(),
    // 每晚的 API 同步用它判斷這份異動清單是否已經處理過
    sourceDate,
    months,
    total: published.length,
    notice: "本檔不含判決主文。主文含未經法院遮蔽的姓名，請以 jid 連回司法院裁判書系統查閱原文。",
    records: published,
  }) + "\n");

  // 摘要索引每頁都載入，只放判讀所需的聚合數：通常程序實體案件的定罪／無罪、
  // 簡易與上訴審件數。各案由組成與逐案明細放在按需載入的 judicial-judges.json。
  const index = stats.judges.map((judge) => ({
    name: judge.name,
    contested: judge.contested,
    convicted: judge.convicted,
    acquitted: judge.acquitted,
    summary: judge.summary,
    appellate: judge.appellate,
    latestDate: judge.latestDate,
  }));

  await writeFile(join(OUT_DIR, "judicial.json"), JSON.stringify({
    updatedAt: new Date().toISOString(),
    source: "司法院裁判書開放資料月包",
    months,
    coverage: stats.coverage,
    labels: stats.labels,
    totals: stats.totals,
    overall: stats.overall,
    byCharge: stats.byCharge,
    bySentence: stats.bySentence,
    byLevel: stats.byLevel,
    byYear: stats.byYear,
    judges: index,
  }) + "\n");

  await writeFile(join(OUT_DIR, "judicial-judges.json"), JSON.stringify({
    updatedAt: new Date().toISOString(),
    judges: stats.judges,
  }) + "\n");

  return stats;
}

// 路徑含中文，直接比字串會因為百分比編碼而對不上
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { records, months } = await readCache();
  const stats = await writeJudicial(records, months);
  const { overall, coverage } = stats;
  console.log(`[analyse] 讀入 ${records.length} 筆，涵蓋 ${months.length} 個月（${coverage.from}–${coverage.to}）`);
  console.log(`[analyse] 第一審 ${overall.total} 件，實體審理 ${overall.counts.substantive} 件，` +
    `定罪 ${overall.counts.convicted} 件（${overall.conviction.rate === null ? "—" : (overall.conviction.rate * 100).toFixed(1) + "%"}）`);
  console.log(`[analyse] 結果分布：${Object.entries(stats.totals.byOutcome)
    .sort((a, b) => b[1] - a[1]).map(([key, value]) => `${stats.labels.outcome[key] ?? key} ${value}`).join("、")}`);
}
