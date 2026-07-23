/**
 * 資料管線：在 GitHub Actions 的機器上執行，把外部資料抓下來、整理成靜態 JSON，
 * 之後由網站直接讀檔，不需要伺服器也不需要資料庫。
 *
 * 用法：
 *   node scripts/build-data.mjs news       只更新新聞索引
 *   node scripts/build-data.mjs judicial   只更新裁判統計（限臺灣時間 00:00–06:00）
 *   node scripts/build-data.mjs all        兩者都做
 *
 * 累積機制：每次執行會先去已發布的網站抓上一版 JSON（環境變數 SITE_URL），
 * 與這次的新資料合併後再輸出，所以索引會隨時間長大，而不是每晚砍掉重來。
 * 抓不到上一版時（例如第一次部署）就從 scripts/seed/ 的種子資料開始。
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toRecord } from "./judgment-rules.mjs";
import { writeJudicial } from "./analyse-judgments.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "data");
const SITE_URL = process.env.SITE_URL?.replace(/\/$/, "") ?? "";

const PTS_SEARCH = "https://news.pts.org.tw/search/";

/**
 * 監測詞。公視提供關鍵字搜尋，因此改成逐詞查詢，而不是抓分類列表再過濾。
 * 好處是可以往回翻頁補歷史，不必從架站當天才開始累積。
 */
const MONITOR_TERMS = [
  "性平", "性騷擾", "性侵害", "性霸凌", "性別平等", "妨害性自主",
  "不適任教師", "權勢性騷", "強制猥褻", "偷拍", "跟蹤騷擾", "性剝削",
];

/**
 * 「偷拍」也指拍攝機場管制區、海關、軍事機密等，與性隱私無關。若一則報導同時帶有
 * 「偷拍」與這些明顯非性的脈絡詞，就視為誤收。這些詞幾乎不會出現在性隱私偷拍的
 * 報導裡，因此不影響醫美偷拍、女廁針孔等真正的案件。刻意不放太籠統的詞（如安檢），
 * 以免誤殺。
 */
const OFFTOPIC_MARKERS = [
  "管制區", "海關", "護照查驗", "國安", "營業秘密", "軍事", "邊境", "要塞",
];

/** 明顯非性脈絡的偷拍報導。 */
function isOfftopicToupai(article) {
  const text = `${article?.title ?? ""}${article?.summary ?? ""}`;
  return text.includes("偷拍") && OFFTOPIC_MARKERS.some((marker) => text.includes(marker));
}

/**
 * 新抓到的報導是否屬於性別事件。「偷拍」以外的監測詞命中即收錄；「偷拍」則排除
 * 明顯非性的脈絡。既有索引不走這個完整判準（見下方），以免把用詞不同的真案子清掉。
 */
function isRelevant(article) {
  const text = `${article?.title ?? ""}${article?.summary ?? ""}`;
  if (MONITOR_TERMS.some((term) => term !== "偷拍" && text.includes(term))) return true;
  return text.includes("偷拍") && !isOfftopicToupai(article);
}

/**
 * 每個監測詞往回翻幾頁。每頁 20 則，平時抓前兩頁足以接住新報導；
 * 要重建歷史索引時在本機把 NEWS_PAGES 調大跑一次即可。
 */
const NEWS_PAGES = Number(process.env.NEWS_PAGES ?? 2);

const JUDICIAL_API = "https://data.judicial.gov.tw/jdg/api";

/**
 * CI 上遇到資料異常要讓工作流程真的失敗，GitHub 才會寄信通知。
 * 若只是記錄後照常發布，網站會在沒有人察覺的情況下停止更新——
 * 這是這種每晚排程最容易發生、也最難發現的失敗方式。
 * 本機執行時只警告，不中斷。
 */
const STRICT = process.env.CI === "true";

function log(...args) {
  console.log("[build-data]", ...args);
}

function unhealthy(message, hint) {
  const text = `${message}\n  可能原因與處理：${hint}`;
  if (STRICT) throw new Error(text);
  log(`警告（本機執行不中斷）：${text}`);
}

async function readPrevious(name) {
  if (!SITE_URL) return null;
  try {
    const response = await fetch(`${SITE_URL}/data/${name}`);
    if (response.ok) {
      const data = await response.json();
      log(`沿用已發布的 ${name}`);
      return data;
    }
  } catch {
    // 網站還沒發布或暫時取不到
  }
  return null;
}

async function readSeed(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(name, value) {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, name), JSON.stringify(value) + "\n");
  log(`已寫入 public/data/${name}`);
}

/* ============================================================
   新聞索引
   ============================================================ */

function text(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, "\"").replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 公視在網站搬遷時把一批舊報導的發布時間全部寫成這一刻，站上的
 * article:published_time 也是同一個值，實際日期已不可考。逐則核對過
 * 內容確實是舊報導（例如 2011 年的性平教育課綱爭議），因此保留報導本身，
 * 但不假裝知道它是哪一天發的。
 */
const MIGRATION_STAMP = "2011-08-02 14:30:37";

/**
 * 解析公視搜尋結果。每一則是一個 li.row，標題在 h2 的連結裡，
 * 發布時間在 time 的 datetime 屬性，分類與摘要各自在後面。
 */
function extractArticles(html) {
  const articles = [];
  for (const block of html.split(/<li class="row">/).slice(1)) {
    const link = /href="(https:\/\/news\.pts\.org\.tw\/article\/\d+)"/.exec(block);
    const title = /<h2><a [^>]*>([\s\S]*?)<\/a><\/h2>/.exec(block);
    if (!link || !title) continue;
    const time = /<time datetime="([^"]+)"/.exec(block);
    const category = /href="https:\/\/news\.pts\.org\.tw\/category\/\d+"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    const summary = /<p class="[^"]*">([\s\S]*?)<\/p>/.exec(block);
    const published = time && time[1] !== MIGRATION_STAMP ? time[1] : "";
    articles.push({
      title: text(title[1]),
      url: link[1],
      publishedAt: published,
      ...(published ? {} : { dateUnknown: true }),
      summary: summary ? text(summary[1]).slice(0, 160) : "",
      category: category ? text(category[1]) : "公視新聞",
    });
  }
  return articles;
}

function articlesOf(source) {
  if (!source) return [];
  return Array.isArray(source) ? source : (source.articles ?? []);
}

async function buildNews() {
  // 種子與已發布的版本要一起併入，不能二選一。種子是在本機逐頁回溯建立的
  // 歷史索引，已發布的則是此後累積的；若只在站上沒有資料時才用種子，
  // 第一次部署之後歷史就永遠回不來了——實際上就發生過，1257 則掉到 118 則。
  const seed = await readSeed(join(ROOT, "scripts", "seed", "news-seed.json"));
  const previous = await readPrevious("news.json");
  const existing = [...articlesOf(seed), ...articlesOf(previous)];
  log(`既有索引：種子 ${articlesOf(seed).length} 則、已發布 ${articlesOf(previous).length} 則`);

  const fetched = [];
  let requested = 0;
  let reachable = 0;
  for (const term of MONITOR_TERMS) {
    for (let page = 1; page <= NEWS_PAGES; page++) {
      const url = `${PTS_SEARCH}${encodeURIComponent(term)}${page > 1 ? `?page=${page}` : ""}`;
      requested++;
      try {
        const response = await fetch(url, {
          headers: { "user-agent": "MingjingGenderWatch/1.0 (+public-interest news index)" },
        });
        // 超過最後一頁會回 404，那是正常的結束訊號，不算失敗
        if (response.status === 404) { reachable++; break; }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        reachable++;
        const found = extractArticles(await response.text());
        fetched.push(...found);
        if (found.length === 0) break;
      } catch (error) {
        log(`搜尋「${term}」第 ${page} 頁失敗：${error.message}`);
      }
    }
  }
  log(`公視搜尋 ${MONITOR_TERMS.length} 個監測詞、${requested} 次請求，取回 ${fetched.length} 則`);

  // 健康檢查。注意「今天沒有性平相關新聞」是正常的，不該失敗；
  // 不正常的是「連一則新聞都解析不出來」，那代表抓取或解析壞了。
  if (reachable === 0) {
    unhealthy(
      "公視搜尋全部無法連線。",
      "可能是對方暫時故障、擋了我們的 User-Agent，或網址已變更。先用瀏覽器開 https://news.pts.org.tw/search/性騷擾 確認。",
    );
  } else if (fetched.length === 0) {
    unhealthy(
      `連得上公視（${reachable}/${requested} 次請求成功）但一則新聞都解析不出來。`,
      "多半是公視改版導致頁面結構改變，需要更新 scripts/build-data.mjs 的 extractArticles()。",
    );
  }

  // 搜尋會命中內文提到關鍵字、但主題與性別事件無關的報導，
  // 因此仍以標題與摘要再篩一次，寧可漏收也不要讓索引失焦。
  const relevant = fetched.filter(isRelevant);

  // 既有索引已經逐步累積、也含用詞不同的真案子（例如寫「性侵」而非「性侵害」），
  // 因此不重跑完整判準，只剔除明顯誤收的非性偷拍，其餘保留。
  const byUrl = new Map();
  let purged = 0;
  for (const article of existing) {
    if (!article?.url) continue;
    if (isOfftopicToupai(article)) { purged++; continue; }
    byUrl.set(article.url, article);
  }
  // 種子與已發布的版本會重疊，去重後才知道原本有幾則
  const before = byUrl.size;
  if (purged > 0) log(`從既有索引清掉 ${purged} 則非性脈絡的偷拍報導`);
  for (const article of relevant) {
    if (article?.url) byUrl.set(article.url, article);
  }
  const articles = [...byUrl.values()].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));

  log(`索引：既有 ${before} 則，本次新增 ${articles.length - before} 則，合計 ${articles.length} 則`);
  await writeJson("news.json", {
    updatedAt: new Date().toISOString(),
    source: "公視新聞網",
    monitorTerms: MONITOR_TERMS,
    total: articles.length,
    articles,
  });
}

/* ============================================================
   裁判書統計
   ============================================================ */

function taipeiHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei", hour: "2-digit", hourCycle: "h23",
  }).format(now));
}

/** 連不到司法院主機時丟出，與「連得上但回應有問題」區分開來。 */
class JudicialUnreachable extends Error {}

async function postJudicial(path, body) {
  let response;
  try {
    response = await fetch(`${JUDICIAL_API}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "MingjingGenderWatch/1.0" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new JudicialUnreachable(error?.cause?.code ?? error.message);
  }
  if (!response.ok) throw new Error(`司法院 ${path} 回應 ${response.status}`);
  return response.json();
}

async function buildJudicial() {
  // 司法院只提供單日異動清單，資料靠每日累積，因此任何「這次不同步」的路徑
  // 都必須把既有資料原封寫回；漏寫等於把先前累積的成果從網站上抹掉。
  //
  // 累加的依據是逐筆紀錄（judgments.json）而不是統計摘要——摘要算完就沒有
  // 原始資料可以再加東西進去。歷史資料由官方月包在本機匯入後產生，
  // JUDICIAL_SOURCE_URL 可指向那份紀錄檔，與名冊同一套機制。
  const seed = process.env.JUDICIAL_SOURCE_URL;
  let previous = null;
  if (seed) {
    try {
      const response = await fetch(seed);
      if (response.ok) {
        previous = await response.json();
        log(`沿用 JUDICIAL_SOURCE_URL 提供的 ${previous?.records?.length ?? 0} 筆`);
      }
    } catch (error) {
      log(`JUDICIAL_SOURCE_URL 取得失敗：${error.message}`);
    }
  }
  previous ??= await readPrevious("judgments.json");

  const records = new Map((previous?.records ?? []).map((item) => [item.jid, item]));
  const months = new Set(previous?.months ?? []);

  const preserve = async (reason) => {
    log(reason);
    if (records.size > 0) {
      await writeJudicial([...records.values()], [...months].sort(), previous?.sourceDate ?? "");
      log(`保留既有的 ${records.size} 筆判決`);
    }
  };

  // 完整同步要逐筆抓數千份裁判書，耗時二十分鐘以上，不適合每次推送都跑
  if (process.env.JUDICIAL_SKIP === "true") {
    await preserve("JUDICIAL_SKIP 已設定，本次不同步裁判資料");
    return;
  }
  if (taipeiHour() >= 6) {
    await preserve("司法院 API 僅於臺灣時間 00:00–06:00 開放，略過裁判書更新");
    return;
  }
  // 一律去除前後空白：從網頁貼進 secret 時很容易夾帶空格，
  // 而司法院只會回「驗證失敗」，看不出是憑證錯還是格式錯。
  const user = process.env.JUDICIAL_API_USER?.trim();
  const password = process.env.JUDICIAL_API_PASSWORD?.trim();
  if (!user || !password) {
    // 先保住既有資料再示警：網站不該因為 secret 掉了就少掉一整區，
    // 但憑證消失必須讓人知道，否則資料會在無人察覺的情況下停止更新。
    await preserve("缺少司法院 API 憑證，保留既有資料");
    unhealthy(
      "已進入司法院 API 開放時段，卻沒有 JUDICIAL_API_USER／JUDICIAL_API_PASSWORD。",
      "到儲存庫 Settings → Secrets and variables → Actions 確認兩個 secret 都存在且名稱正確。",
    );
    return;
  }

  log(`既有裁判 ${records.size} 筆`);

  try {
    const result = await syncJudicial(user, password, records, previous?.sourceDate);
    if (result?.alreadyDone) {
      await preserve(`異動日期 ${result.sourceDate} 已處理過，略過重複抓取`);
      return;
    }
    await writeJudicial([...records.values()], [...months].sort(), result.sourceDate);
  } catch (error) {
    // 司法院的服務只接受國內來源，從 GitHub 的機器（境外）連不進去。
    // 這是已知且持續的限制，不是當次故障，因此不讓整個部署失敗；
    // 需要更新裁判資料時，在臺灣的網路環境執行 npm run data:judicial。
    if (error instanceof JudicialUnreachable) {
      log(`無法連線司法院（${error.message}）。`);
      // 必須把既有資料原封寫回，否則這次建置的產物裡不會有裁判資料，
      // 等於每跑一次 CI 就把先前累積的統計清空。
      await preserve("改為保留既有資料，請確認來源是否暫時故障或網址已變更。");
      return;
    }
    throw error;
  }
}

async function syncJudicial(user, password, known, previousSourceDate) {
  const auth = await postJudicial("Auth", { user, password });
  if (!auth.Token) {
    // 憑證錯誤與「內容夾帶空白」在司法院眼中都只是「驗證失敗」，訊息裡一併提示
    throw new Error(`${auth.error || "司法院驗證失敗"}——請確認帳號密碼正確，且 secret 內容前後沒有多餘的空白或換行。`);
  }

  const changes = await postJudicial("JList", { token: auth.Token });
  if (!Array.isArray(changes)) throw new Error(changes.error || "異動清單格式不正確");
  const sourceDate = changes.map((item) => item.date).filter(Boolean).sort().at(-1) ?? "";
  const ids = [...new Set(changes.flatMap((item) => (Array.isArray(item.list) ? item.list : [])))];
  log(`異動日期 ${sourceDate}，清單 ${ids.length} 筆`);

  // 同一份異動清單抓過就不必再抓。排程刻意設了多個備援時段以防 GitHub 延遲，
  // 沒有這道判斷的話，每個時段都會重跑數千次請求。
  if (sourceDate && sourceDate === previousSourceDate && known.size > 0) {
    return { alreadyDone: true, sourceDate };
  }

  let saved = 0, removed = 0, skipped = 0;
  for (const [index, jid] of ids.entries()) {
    if (index > 0 && index % 200 === 0) log(`  處理進度 ${index}/${ids.length}`);
    let document;
    try {
      document = await postJudicial("JDoc", { token: auth.Token, j: jid });
    } catch (error) {
      // 單筆取不到就略過，但整台主機連不上就沒必要再試剩下的上千筆
      if (error instanceof JudicialUnreachable) throw error;
      log(`  ${jid} 取得失敗：${error.message}`);
      continue;
    }
    if (document.error) {
      // 規格：回「查無資料」代表已下架，先前取得過的應一併刪除
      if (document.error.includes("查無資料")) {
        if (known.delete(jid)) removed++;
        continue;
      }
      log(`  ${jid} 回應錯誤：${document.error}`);
      continue;
    }
    if (!document.JID || !document.JFULLX) { skipped++; continue; }
    // 篩選與解析的規則與月包匯入共用 toRecord，兩邊的收錄標準才會一致；
    // 回 null 代表不相關或不該計入（非刑事、裁定、附帶民訴等），
    // 若先前收錄過就要一併移除。
    const record = toRecord(document);
    if (!record) {
      if (known.delete(document.JID)) removed++;
      skipped++;
      continue;
    }
    known.set(record.jid, record);
    saved++;
  }

  log(`本次收錄 ${saved} 筆、移除 ${removed} 筆、略過 ${skipped} 筆；合計 ${known.size} 筆判決`);
  return { sourceDate };
}

/* ============================================================ */

const mode = process.argv[2] ?? "all";
if (mode === "news" || mode === "all") await buildNews();
if (mode === "judicial" || mode === "all") await buildJudicial();
log("完成");
