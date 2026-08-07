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

/**
 * deploy.yml 的「更新裁判書統計」步驟設了 continue-on-error，因為司法院 API
 * 只接受國內來源、GitHub Actions 的機器連不進去（JudicialUnreachable）是已知且
 * 持續的限制，不該擋下整個部署。但同一個 continue-on-error 也會把真正的異常
 * （例如憑證被刪、司法院回應格式改變）一起吞掉，讓人以為只是常見的地域限制。
 * 因此非地域限制的異常會在這裡留下標記檔，deploy.yml 讀到就讓 job 真的失敗；
 * cache/ 不進版控（見 .gitignore），不會誤觸發部署或被提交進儲存庫。
 */
const JUDICIAL_FAILURE_FLAG = join(ROOT, "cache", "judicial-failure.flag");

/**
 * 2026 年 8 月公視新聞網改版後，站內搜尋整個失效：https://news.pts.org.tw/search/任何詞
 * 一律回自家 404，連站上真人手動搜尋也一樣，不是我們的 User-Agent 被擋，是這個路徑本身
 * 已經壞掉。因此改抓兩個不需要瀏覽器、沒有 WAF 挑戰的來源，純 fetch 就通：
 *   1. PTS_FEED_URL：Atom feed，約數十則最新報導，有摘要但沒有分類。
 *   2. PTS_DAILYNEWS_URL：每日新聞列表頁，可翻頁，有分類但沒有摘要。
 * 兩者以網址合併欄位（見 mergeArticle()），再丟給 isRelevant() 篩出性別事件。
 * 這兩個來源都只看得到「最近」的報導，不像舊的逐詞搜尋還能不斷往回翻頁補歷史——
 * 舊版這裡曾經寫「逐詞查詢可以往回翻頁補歷史」，現在已經不成立。歷史只能靠
 * scripts/seed/ 的種子（本機逐頁回溯建立）與已發布索引（readPrevious）逐日累積，
 * 這次抓到的新資料一律併入既有索引，無法、也不需要整批重建。
 */
const PTS_FEED_URL = "https://news.pts.org.tw/xml/newsfeed.xml";
const PTS_DAILYNEWS_URL = "https://news.pts.org.tw/dailynews";

/**
 * 監測詞。改版後不再能拿去查詢（見上方新聞段開頭的說明），只用來從 feed 與
 * dailynews 抓回的候選報導裡篩出性別事件，判準見 isRelevant()。
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
 * dailynews 列表頁抓第 1 到第幾頁。第 1 頁是當下最新的報導，平時抓前兩頁
 * 足以接住新報導；dailynews 不像舊的搜尋結果那樣可以無限翻頁補歷史
 * （見上方新聞段開頭的說明），調大這個數字只是多看幾頁「最近」的新聞，
 * 不是用來重建歷史索引。
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

/** 留下標記檔供 deploy.yml 判讀，見 JUDICIAL_FAILURE_FLAG 的說明。 */
async function writeJudicialFailureFlag(error) {
  await mkdir(dirname(JUDICIAL_FAILURE_FLAG), { recursive: true });
  await writeFile(JUDICIAL_FAILURE_FLAG, `${error.message}\n`);
}

/**
 * 404 代表站台還沒發布過這個檔案（例如第一次部署），是正常狀態，靜默回傳 null 即可。
 * 其他任何狀況——fetch 本身拋例外（網路錯誤、DNS 失敗等）、回應非 2xx 也非 404、
 * 或回應內容不是合法 JSON——都代表網站明明存在卻讀不到這份檔案，不是「尚未發布」，
 * 必須被當成異常處理：STRICT 模式直接讓工作流程失敗，本機執行則印醒目警告後回 null，
 * 讓呼叫端照舊往下走（種子或既有資料仍可接手）。
 */
async function readPrevious(name) {
  if (!SITE_URL) return null;
  const url = `${SITE_URL}/data/${name}`;
  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      log(`沿用已發布的 ${name}`);
      return data;
    }
    if (response.status === 404) return null; // 站台尚未發布過，維持靜默
    unhealthy(
      `抓取已發布的 ${name} 時回應 ${response.status}。`,
      "網站本身存在但這個檔案讀不到，可能是部署失敗或路徑跑掉，確認 GitHub Pages 的部署狀態與網址是否正確。",
    );
  } catch (error) {
    unhealthy(
      `抓取已發布的 ${name} 時發生例外（${error.message}）。`,
      "可能是網路暫時性問題，也可能是回應內容已經不是合法 JSON；若持續發生，資料會停止累積但沒有任何警訊。",
    );
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
 * 把可能帶時區位移的 ISO 字串（例如 feed 的 updated：2026-08-07T08:20:12+08:00）
 * 換算成臺北時間、既有索引在用的 "YYYY-MM-DD HH:mm:ss" 格式。索引靠這個格式做
 * 字串排序（見 buildNews() 尾端），混進 ISO 格式會把排序弄壞，因此兩個來源的
 * 時間都要先經過這裡正規化。轉換失敗（缺值或不是合法日期）回傳空字串。
 */
function toTaipeiTimestamp(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * 解析 newsfeed.xml（Atom）。每個 entry 是一則報導，標題與摘要都包在 CDATA
 * 裡，摘要含 HTML 要先去標籤再截斷；updated 是帶 +08:00 位移的 ISO 字串，
 * 要換算成臺北時間才能跟既有索引的格式一致。這個來源沒有分類。
 * 依 export 才測得到的慣例（見 tests/news-parsers.test.mjs）具名匯出。
 */
export function extractFeedArticles(xml) {
  const articles = [];
  for (const block of xml.split(/<entry>/).slice(1)) {
    const link = /<link rel="alternate" href="(https:\/\/news\.pts\.org\.tw\/article\/\d+)"/.exec(block);
    const title = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(block);
    const summary = /<summary[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/summary>/.exec(block);
    const updated = /<updated>([^<]+)<\/updated>/.exec(block);
    if (!link || !title) continue;
    const publishedAt = toTaipeiTimestamp(updated?.[1]);
    const known = publishedAt && publishedAt !== MIGRATION_STAMP;
    articles.push({
      title: text(title[1]),
      url: link[1],
      publishedAt: known ? publishedAt : "",
      ...(known ? {} : { dateUnknown: true }),
      summary: summary ? text(summary[1]).slice(0, 160) : "",
    });
  }
  return articles;
}

/**
 * 解析每日新聞列表頁。同一版型共用的閒置彈窗（id="idleModal"）裡也有
 * /article/ 連結，若整頁掃連結會把彈窗裡的報導也收進來；因此先框定在
 * <article>…</article>——這是頁面真正列出當日新聞的區塊，idleModal 在它
 * 外面——再以每則新聞縮圖前的 useImgHover 連結切成一則一則來解析，
 * 不會誤收彈窗內容。這個來源沒有摘要。
 */
export function extractDailynewsArticles(html) {
  const region = /<article[^>]*>[\s\S]*?<\/article>/.exec(html)?.[0] ?? "";
  const articles = [];
  for (const block of region.split(/<a href="https:\/\/news\.pts\.org\.tw\/article\/\d+" class="useImgHover">/).slice(1)) {
    const titleLink = /<a\s+href="(https:\/\/news\.pts\.org\.tw\/article\/\d+)">([\s\S]*?)<\/a>\s*<\/h[12]>/.exec(block);
    if (!titleLink) continue;
    const time = /<time[^>]*datetime="([^"]+)"/.exec(block);
    const category = /<a href="https:\/\/news\.pts\.org\.tw\/category\/\d+">([^<]+)<\/a>/.exec(block);
    const raw = time?.[1] ?? "";
    const known = raw && raw !== MIGRATION_STAMP;
    articles.push({
      title: text(titleLink[2]),
      url: titleLink[1],
      publishedAt: known ? raw : "",
      ...(known ? {} : { dateUnknown: true }),
      category: category ? text(category[1]) : "",
    });
  }
  return articles;
}

/**
 * 以網址合併 feed 與列表頁的同一則報導。摘要只有 feed 有，直接採用；
 * 分類是列表頁獨有欄位，發布時間列表頁也精確到秒且較貼近既有索引的格式，
 * 因此兩者優先取列表頁的，該篇只在 feed 出現時才退回 feed 的值；
 * 標題兩邊都有，缺一邊時取有的那邊。
 */
export function mergeArticle(feedItem, dailyItem) {
  const publishedAt = dailyItem?.publishedAt || feedItem?.publishedAt || "";
  return {
    title: dailyItem?.title || feedItem?.title || "",
    url: dailyItem?.url ?? feedItem?.url,
    publishedAt,
    ...(publishedAt ? {} : { dateUnknown: true }),
    summary: feedItem?.summary ?? "",
    category: dailyItem?.category || feedItem?.category || "公視新聞",
  };
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

  // 兩個來源都用同一個 User-Agent；不需要瀏覽器、沒有 WAF 挑戰，純 fetch 就通
  // （見新聞段開頭的說明）。requested／reachable 橫跨兩個來源合計，健康檢查
  // 也是看兩者合計的結果，見下方。
  const fetchHeaders = { headers: { "user-agent": "MingjingGenderWatch/1.0 (+public-interest news index)" } };
  let requested = 0;
  let reachable = 0;

  let feedArticles = [];
  requested++;
  try {
    const response = await fetch(PTS_FEED_URL, fetchHeaders);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    reachable++;
    feedArticles = extractFeedArticles(await response.text());
  } catch (error) {
    log(`抓取 ${PTS_FEED_URL} 失敗：${error.message}`);
  }
  log(`newsfeed.xml 取回 ${feedArticles.length} 則`);

  const dailyArticles = [];
  for (let page = 1; page <= NEWS_PAGES; page++) {
    const url = `${PTS_DAILYNEWS_URL}${page > 1 ? `?page=${page}` : ""}`;
    requested++;
    try {
      const response = await fetch(url, fetchHeaders);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      reachable++;
      dailyArticles.push(...extractDailynewsArticles(await response.text()));
    } catch (error) {
      log(`抓取 ${url} 失敗：${error.message}`);
    }
  }
  log(`dailynews 第 1 至 ${NEWS_PAGES} 頁取回 ${dailyArticles.length} 則`);

  // 以網址合併兩個來源（見 mergeArticle() 的欄位優先序），再交給下面的
  // isRelevant() 篩選；候選本身沒有先用關鍵字查詢過，全部都要篩。
  const candidatesByUrl = new Map();
  for (const item of feedArticles) {
    if (item.url) candidatesByUrl.set(item.url, { feed: item });
  }
  for (const item of dailyArticles) {
    if (!item.url) continue;
    const entry = candidatesByUrl.get(item.url) ?? {};
    entry.daily = item;
    candidatesByUrl.set(item.url, entry);
  }
  const fetched = [...candidatesByUrl.values()].map(({ feed, daily }) => mergeArticle(feed, daily));
  log(`兩個來源合併去重後共 ${fetched.length} 則候選`);

  // 健康檢查。注意「今天沒有性平相關新聞」是正常的，不該失敗；
  // 不正常的是「兩個來源合計連一則新聞都解析不出來」，那代表抓取或解析壞了。
  // dailynews 隨時都有新聞，連得上卻解析出 0 則，必然是頁面結構改了。
  if (reachable === 0) {
    unhealthy(
      "公視新聞（newsfeed.xml 與 dailynews）全部無法連線。",
      "可能是對方暫時故障、擋了我們的 User-Agent，或網址已變更。先用瀏覽器開 https://news.pts.org.tw/xml/newsfeed.xml 與 https://news.pts.org.tw/dailynews 確認。",
    );
  } else if (fetched.length === 0) {
    unhealthy(
      `連得上公視（${reachable}/${requested} 次請求成功）但一則新聞都解析不出來。`,
      "dailynews 隨時都有新聞，解析出 0 則必然是公視改版導致頁面結構改變，需要更新 scripts/build-data.mjs 的 extractFeedArticles() 或 extractDailynewsArticles()。",
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
      // dataAsOf 沿用前一版真正取得新資料的時間，不是這次執行的時間——
      // 這次只是原封寫回既有紀錄，並沒有真的同步到新資料
      await writeJudicial(
        [...records.values()], [...months].sort(),
        previous?.sourceDate ?? "", previous?.updatedAt ?? "",
      );
      log(`保留既有的 ${records.size} 筆判決`);
      return;
    }
    // CI 上一定會設定 JUDICIAL_SOURCE_URL 種子（見 sync-judicial.mjs），種子與已發布的
    // 前一版若同時是空的，代表兩邊都出了問題，不是單純「還沒有資料」；若在此無聲跳過，
    // 三個裁判資料檔會直接從這次部署的產物裡消失，卻沒有任何警訊。
    unhealthy(
      `${reason}，但既有裁判資料是空的，三個裁判資料檔本次將不會被寫入。`,
      "確認 JUDICIAL_SOURCE_URL 種子是否可正常下載且內容完整，以及已發布網站的 judgments.json 是否正常。",
    );
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
    // 這次真的取得了新的異動清單並同步完成，dataAsOf 就是現在
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

// tests/news-parsers.test.mjs 會 import 本檔的具名匯出（extractFeedArticles 等）
// 來測試解析邏輯，而 ES module 的 import 一定會執行到頂層程式碼；若沒有這道
// 判斷，跑測試就會連帶觸發真的抓取與寫檔。只有直接被 node 執行（而不是被
// import）時才進入這個入口。
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const mode = process.argv[2] ?? "all";
  if (mode === "news" || mode === "all") await buildNews();
  if (mode === "judicial" || mode === "all") {
    try {
      await buildJudicial();
    } catch (error) {
      // JudicialUnreachable 與各種正常保留（preserve）都在 buildJudicial() 內部
      // 處理完畢、正常 return，不會流到這裡；能被外層接住的都是非地域限制的
      // 真異常，才需要留下標記檔給 deploy.yml 判讀。
      await writeJudicialFailureFlag(error);
      throw error;
    }
  }
  log("完成");
}
