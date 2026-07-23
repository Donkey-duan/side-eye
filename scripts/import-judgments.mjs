/**
 * 從司法院官方的裁判書月包匯入歷史資料。
 *
 * 司法院在資料開放平台提供 1996 年起每月一包的裁判書全文（RAR），
 * 這是取得歷史資料的正式管道；每晚的 API 只給單日異動清單，無法回溯。
 *
 * 用法：
 *   node scripts/import-judgments.mjs <路徑> [更多路徑...]
 *
 * 路徑可以是壓縮檔、放著一堆壓縮檔的資料夾，或已經解壓好的資料夾。
 * 瀏覽器下載那些連結時會忽略 download 屬性（跨網域），檔案會叫 file、
 * file (1)…，因此壓縮檔是靠檔頭的 RAR 簽章辨識，不看副檔名。
 *
 * 例：
 *   node scripts/import-judgments.mjs "C:/Users/me/Downloads"
 *
 * 抽取結果存進 cache/judgments.jsonl（不進版控），再由 analyse-judgments.mjs
 * 算出 public/data/judicial.json。解壓很慢而判準會反覆調整，分成兩段才不必
 * 為了改一條規則重跑二十五分鐘。
 *
 * 解壓出來的暫存內容用完即刪，來源壓縮檔一律保留。
 */

import { spawn } from "node:child_process";
import { copyFile, link, open, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toRecord } from "./judgment-rules.mjs";
import { CACHE, readCache, writeJudicial } from "./analyse-judgments.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORK = join(ROOT, ".judgments-work");

/** UnRAR 是免費軟體，多半跟著 WinRAR 或 7-Zip 一起在機器上。 */
const EXTRACTORS = [
  { path: "C:/Program Files/WinRAR/UnRAR.exe", args: (rar, dir) => ["x", "-y", "-idq", rar, `${dir}/`] },
  { path: "C:/Program Files (x86)/WinRAR/UnRAR.exe", args: (rar, dir) => ["x", "-y", "-idq", rar, `${dir}/`] },
  { path: "C:/Program Files/7-Zip/7z.exe", args: (rar, dir) => ["x", "-y", `-o${dir}`, rar] },
  { path: "C:/Program Files/NanaZip/7z.exe", args: (rar, dir) => ["x", "-y", `-o${dir}`, rar] },
  { path: "unrar", args: (rar, dir) => ["x", "-y", "-idq", rar, `${dir}/`] },
];

function log(...args) {
  console.log("[import]", new Date().toISOString().slice(11, 19), ...args);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${basename(command)} 離開碼 ${code}${stderr ? `：${stderr.trim()}` : ""}`));
    });
  });
}

let extractor = null;

/** 第一次成功的工具會被記住，後續不再逐一嘗試。 */
async function extract(rar, dir) {
  if (extractor) return run(extractor.path, extractor.args(rar, dir));
  const failures = [];
  for (const candidate of EXTRACTORS) {
    try {
      await run(candidate.path, candidate.args(rar, dir));
      extractor = candidate;
      log(`解壓工具：${candidate.path}`);
      return;
    } catch (error) {
      failures.push(`${candidate.path}：${error.message}`);
    }
  }
  // 只回報最後一個候選會把真正的原因蓋掉，全部列出來才看得見
  throw new Error(`沒有可用的解壓工具\n  ${failures.join("\n  ")}`);
}

/**
 * UnRAR 會自動替沒有副檔名的路徑補上 .rar，因而找不到檔案。改名可以解決，
 * 但那會動到來源；同一顆磁碟上建硬連結是瞬間的，也不佔額外空間。
 */
async function asRarPath(source, index) {
  if (source.toLowerCase().endsWith(".rar")) return { path: source, temporary: false };
  const alias = join(WORK, `${index}.rar`);
  await rm(alias, { force: true });
  try {
    await link(source, alias);
  } catch {
    await copyFile(source, alias); // 跨磁碟或不支援硬連結時退而求其次
  }
  return { path: alias, temporary: true };
}

/** 只讀前四個位元組判斷 RAR 簽章；月包有兩三百 MB，不能整個讀進記憶體。 */
async function isArchive(path) {
  let handle;
  try {
    handle = await open(path, "r");
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(4), 0, 4, 0);
    return bytesRead === 4 && buffer.toString("latin1") === "Rar!";
  } catch {
    return false;
  } finally {
    await handle?.close();
  }
}

/** 逐層走訪，只回傳刑事的 JSON。檔名開頭即法院代碼＋裁判類別，可先濾掉三分之二。 */
async function* criminalFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* criminalFiles(path);
    else if (/^[A-Z]{3}M,.*\.json$/i.test(entry.name)) yield path;
  }
}

async function collect(dir, known, month) {
  let scanned = 0;
  let failed = 0;
  const before = known.size;
  for await (const file of criminalFiles(dir)) {
    scanned++;
    try {
      const record = toRecord(JSON.parse(await readFile(file, "utf8")));
      if (record) known.set(record.jid, month ? { ...record, month } : record);
    } catch {
      failed++;
    }
  }
  return { scanned, failed, added: known.size - before };
}

/** 月包解開後第一層就是月份資料夾，解壓完才知道這包是哪個月。 */
async function monthsIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && /^\d{6}$/.test(e.name)).map((e) => e.name);
}

/** 每處理完一包就整份寫回，中途斷了不至於前功盡棄。 */
async function saveCache(known) {
  await mkdir(dirname(CACHE), { recursive: true });
  const lines = [...known.values()].map((record) => JSON.stringify(record));
  await writeFile(CACHE, lines.join("\n") + "\n");
}

/** 把輸入路徑攤平成待處理清單：壓縮檔逐一解壓，已解開的資料夾直接掃。 */
async function plan(inputs) {
  const archives = [];
  const folders = [];
  for (const input of inputs) {
    const info = await stat(input);
    if (info.isFile()) {
      if (await isArchive(input)) archives.push(input);
      else log(`略過 ${basename(input)}：不是 RAR`);
      continue;
    }
    // 資料夾裡若有月包就當成下載目錄，否則視為已解壓的內容
    const found = [];
    for (const entry of await readdir(input, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const path = join(input, entry.name);
      if ((await stat(path)).size > 1_000_000 && await isArchive(path)) found.push(path);
    }
    if (found.length) archives.push(...found);
    else folders.push(input);
  }
  return { archives, folders };
}

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error("用法：node scripts/import-judgments.mjs <路徑> [更多路徑...]");
  process.exit(1);
}

const known = new Map();
const months = new Set();
try {
  const { records, months: cached } = await readCache();
  for (const record of records) known.set(record.jid, record);
  for (const month of cached) months.add(month);
  log(`沿用既有快取 ${known.size} 筆、${months.size} 個月`);
} catch {
  log("沒有既有快取，從零開始");
}

const { archives, folders } = await plan(inputs);
log(`待處理：壓縮檔 ${archives.length} 個、已解壓資料夾 ${folders.length} 個`);

let scanned = 0;
let failed = 0;

for (const [index, rar] of archives.entries()) {
  const dir = join(WORK, String(index));
  let alias = null;
  try {
    await mkdir(dir, { recursive: true });
    alias = await asRarPath(rar, index);
    await extract(alias.path, dir);
    const found = await monthsIn(dir);
    const result = await collect(dir, known, found[0]);
    scanned += result.scanned;
    failed += result.failed;
    for (const month of found) months.add(month);
    await saveCache(known);
    log(`[${index + 1}/${archives.length}] ${found.join("、") || basename(rar)}：` +
      `刑事 ${result.scanned} 筆，新增 ${result.added} 筆，累計 ${known.size} 筆`);
  } catch (error) {
    log(`[${index + 1}/${archives.length}] ${basename(rar)} 失敗：${error.message}`);
  } finally {
    // 只刪自己解出來的暫存與連結，來源壓縮檔不動
    await rm(dir, { recursive: true, force: true });
    if (alias?.temporary) await rm(alias.path, { force: true });
  }
}

for (const folder of folders) {
  const found = await monthsIn(folder);
  const result = await collect(folder, known, found[0]);
  scanned += result.scanned;
  failed += result.failed;
  for (const month of found) months.add(month);
  await saveCache(known);
  log(`${folder}：刑事 ${result.scanned} 筆，新增 ${result.added} 筆`);
}

await rm(WORK, { recursive: true, force: true });
const stats = await writeJudicial([...known.values()], [...months].sort());

log(`掃描 ${scanned} 筆刑事裁判，解析失敗 ${failed} 筆，涵蓋 ${months.size} 個月`);
log(`收錄 ${known.size} 筆判決、${stats.judges.length} 位具名法官`);
log(`第一審 ${stats.overall.total} 件，定罪率 ` +
  `${stats.overall.conviction.rate === null ? "—" : (stats.overall.conviction.rate * 100).toFixed(1) + "%"}`);
