import type { SiteView, VictimView } from "./routes";

// 資料來源總覽。每一列對應站上實際接得到的來源，各自標明現況。
// 本站目前沒有跨來源的個別事件索引。
export type SourceState = "live" | "pending" | "external";

export const dataSources: { target: SiteView; name: string; authority: string; coverage: string; cadence: string; state: SourceState; note: string }[] = [
  {
    target: "committee",
    name: "校園性別事件通報與調查統計",
    authority: "教育部統計處、臺北市政府主計處",
    coverage: "全國通報件數 2006–2024（曆年）；臺北市另含屬實件數 109–113 學年",
    cadence: "年度更新",
    state: "live",
    note: "全國層級的調查屬實只公布人數（非件數），無法計算全國屬實率；屬實件數僅臺北市有公布",
  },
  {
    target: "victim",
    name: "全國性平調查專業人才名冊",
    authority: "教育部",
    coverage: "全國名冊 1150701 版，可站內搜尋姓名、單位與職稱",
    cadence: "依教育部公告改版",
    state: "live",
    note: "未轉錄電話、電子郵件與證號等私人聯絡欄位",
  },
  {
    target: "news",
    name: "公視性平新聞索引",
    authority: "公視新聞網",
    coverage: "以 12 個監測詞查詢公視新聞搜尋，並逐頁往回收錄歷史報導",
    cadence: "每晚累積",
    state: "live",
    note: "只保存標題、短摘要與原始連結，不重製內文與影音",
  },
  {
    target: "judges",
    name: "性平刑事裁判統計",
    authority: "司法院裁判書開放資料",
    coverage: "歷史來自每月裁判書全文包，新資料以裁判書 API 每晚累積",
    cadence: "每晚累積，API 開放時段為每日 00:00 至 06:00",
    state: "live",
    note: "定罪率、刑期分布等為本站從主文判讀彙整，判準與限制列於本頁下方",
  },
  {
    target: "coaches",
    name: "運動部不適任教練資訊",
    authority: "運動部",
    coverage: "持特定體育團體教練證且涉刑事裁判者",
    cadence: "依運動部公告",
    state: "external",
    note: "官方頁面有防自動存取機制，本站僅提供入口連結，不繞過保護措施",
  },
];

export const sourceStateLabel: Record<SourceState, string> = { live: "已接上", pending: "待首次同步", external: "官方入口" };

export type CommitteeType = { label: string; reported: number; founded: number };
export type CommitteeYear = { year: string; reported: number; founded: number; types: CommitteeType[] };

// 來源把校園性別事件分成四類，各類的量與屬實率差很多——性騷擾佔了通報的九成，
// 性霸凌則從 109 到 113 學年翻了四倍。合計會把這些都藏起來，因此保留分類。
// 合計仍保留，供趨勢圖使用；分類明細在選取學年時逐項顯示。
export const committeeStats: CommitteeYear[] = [
  { year: "109", reported: 1316, founded: 195, types: [
    { label: "性侵害", reported: 167, founded: 29 },
    { label: "性騷擾", reported: 1135, founded: 163 },
    { label: "性霸凌", reported: 14, founded: 3 },
    { label: "教師違反專業倫理", reported: 0, founded: 0 },
  ] },
  { year: "110", reported: 1027, founded: 174, types: [
    { label: "性侵害", reported: 155, founded: 22 },
    { label: "性騷擾", reported: 860, founded: 149 },
    { label: "性霸凌", reported: 12, founded: 3 },
    { label: "教師違反專業倫理", reported: 0, founded: 0 },
  ] },
  { year: "111", reported: 1514, founded: 232, types: [
    { label: "性侵害", reported: 210, founded: 27 },
    { label: "性騷擾", reported: 1281, founded: 201 },
    { label: "性霸凌", reported: 23, founded: 4 },
    { label: "教師違反專業倫理", reported: 0, founded: 0 },
  ] },
  { year: "112", reported: 1838, founded: 315, types: [
    { label: "性侵害", reported: 193, founded: 26 },
    { label: "性騷擾", reported: 1594, founded: 267 },
    { label: "性霸凌", reported: 26, founded: 8 },
    { label: "教師違反專業倫理", reported: 25, founded: 14 },
  ] },
  { year: "113", reported: 2361, founded: 351, types: [
    { label: "性侵害", reported: 181, founded: 29 },
    { label: "性騷擾", reported: 2087, founded: 305 },
    { label: "性霸凌", reported: 59, founded: 8 },
    { label: "教師違反專業倫理", reported: 34, founded: 9 },
  ] },
];

// 長條圖以資料實際最大值為基準、從零起跳，避免寫死上限與非零基準造成的比例失真
export const statsMax = Math.max(...committeeStats.map((item) => item.reported));
export const chartHeight = 190;
export const committeeTotal = committeeStats.reduce((sum, item) => sum + item.reported, 0);

// 全國疑似校園性別事件通報件數（教育部統計處 404-11），按曆年、三類。
// 與上面的台北市資料兩件事：這是全國、曆年、僅「通報件數」；全國層級的調查屬實
// 只公布「人數」（按性別、年齡切開）而非件數，無法據以計算全國屬實率，因此
// 屬實率仍只在有公布件數的台北市呈現。性霸凌自 102 年（2013）才納入統計。
export type NationalYear = { year: number; assault: number; harass: number; bully: number | null };
export const nationalReports: NationalYear[] = [
  { year: 2006, assault: 214, harass: 145, bully: null },
  { year: 2007, assault: 313, harass: 209, bully: null },
  { year: 2008, assault: 387, harass: 258, bully: null },
  { year: 2009, assault: 269, harass: 267, bully: null },
  { year: 2010, assault: 897, harass: 985, bully: null },
  { year: 2011, assault: 1652, harass: 2018, bully: null },
  { year: 2012, assault: 2491, harass: 2632, bully: null },
  { year: 2013, assault: 1660, harass: 2733, bully: 28 },
  { year: 2014, assault: 1666, harass: 3013, bully: 72 },
  { year: 2015, assault: 1562, harass: 3522, bully: 92 },
  { year: 2016, assault: 1585, harass: 4207, bully: 98 },
  { year: 2017, assault: 1583, harass: 5187, bully: 140 },
  { year: 2018, assault: 1766, harass: 5982, bully: 128 },
  { year: 2019, assault: 2042, harass: 7280, bully: 161 },
  { year: 2020, assault: 2535, harass: 10681, bully: 277 },
  { year: 2021, assault: 2178, harass: 10312, bully: 310 },
  { year: 2022, assault: 2410, harass: 11941, bully: 320 },
  { year: 2023, assault: 2974, harass: 18142, bully: 455 },
  { year: 2024, assault: 2498, harass: 20995, bully: 581 },
];

export const NATIONAL_TYPES = [
  { key: "assault", label: "性侵害" },
  { key: "harass", label: "性騷擾" },
  { key: "bully", label: "性霸凌" },
] as const;

export function nationalTotal(item: NationalYear): number {
  return item.assault + item.harass + (item.bully ?? 0);
}

export const nationalMax = Math.max(...nationalReports.map(nationalTotal));

export type NewsItem = { title: string; url: string; publishedAt: string; summary: string; category: string };
export type NewsIndex = { updatedAt?: string; total?: number; articles?: NewsItem[] };

// 站台可能掛在子目錄（GitHub Pages 專案頁），資料檔的路徑要帶上 basePath，
// 否則從 /victim/appeal/ 這種網址發出的請求會找錯位置。
export const DATA_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data`;
export type CaseBrief = { jid: string; title: string; caseNumber: string; decisionDate: string; summary?: boolean };

/** 司法院裁判書的檢視網址。明細檔只存 jid，網址在這裡組出來以節省傳輸量。 */
export const JUDGMENT_BASE = "https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=";

export function judgmentUrl(jid: string): string {
  return JUDGMENT_BASE + encodeURIComponent(jid);
}

/** 刑期分布用中位數與四分位數呈現，平均值會被極少數重刑拉走。 */
export type Quantiles = { count: number; min: number; p25: number; median: number; p75: number; max: number };

/**
 * 每個比率都帶著自己的分子與分母。三個比率的分母互不相同，並排顯示時
 * 只給百分比一定會被誤讀，因此畫面上一律連同絕對數字一起呈現。
 */
export type Rate = { part: number; whole: number; rate: number | null };

/**
 * 一組案件的結果輪廓。定罪率的分母是「進入實體審理」的件數，
 * 也就是有罪、部分有罪與無罪三者的合計；不受理與免訴沒有經過事實認定，
 * 放進分母會把數字稀釋成看不出意義的東西，因此另外以佔全部件數的比例呈現。
 */
export type OutcomeProfile = {
  total: number;
  outcomes: Record<string, number>;
  counts: {
    substantive: number;
    convicted: number;
    acquitted: number;
    partial: number;
    dismissed: number;
    exempted: number;
    closedBeforeMerits: number;
    probation: number;
  };
  conviction: Rate;
  acquittal: Rate;
  closedBeforeMerits: Rate;
  probation: Rate;
  prisonMonths: Quantiles | null;
  lifeOrDeath: number;
};

/** 依案由分組的結果統計。案由在起訴時就決定，不受判決結果影響。 */
export type ChargeProfile = OutcomeProfile & { label: string; note?: string };

/**
 * 依主文論罪分組的量刑統計，只涵蓋定罪的案件。
 * 無罪判決的主文不寫罪名，所以這一組不能拿來比較定罪率。
 */
export type SentenceProfile = {
  label: string;
  convicted: number;
  prisonMonths: Quantiles | null;
  probation: Rate;
  fine: number;
  detention: number;
  lifeOrDeath: number;
};

/**
 * 各法官的承審紀錄。判讀只用「通常程序、第一審、進入實體審理」的子集（contested）——
 * 那才是有罪無罪由法官裁量的部分；簡易程序（幾乎必然定罪）與上訴審另計，不混入。
 * 摘要每頁都要載入，因此只放聚合件數；逐案明細與案由組成放在按需載入的明細檔。
 */
export type JudgeSummary = {
  name: string;
  contested: number;   // 通常程序第一審實體案件數
  convicted: number;   // 其中定罪
  acquitted: number;   // 其中無罪
  summary: number;     // 簡易程序件數
  appellate: number;   // 上訴審件數
  latestDate: string;
};

/** 某案由在該法官通常程序案件中的件數與無罪數，用來對照「無罪率高」是否來自案件組成。 */
export type JudgeCharge = { key: string; total: number; acquitted: number };

export type JudgeDetail = JudgeSummary & {
  contestedOther: number;
  charges: JudgeCharge[];
  guiltyTotal: number;
  guiltyCases: CaseBrief[];
  acquittedCases: CaseBrief[];
};

/** 通常程序實體案件的無罪率；樣本過小時回 null，畫面不呈現看似可靠的比率。 */
export const JUDGE_MIN_SAMPLE = 20;
export function judgeAcquittalRate(judge: { contested: number; acquitted: number }): number | null {
  return judge.contested >= JUDGE_MIN_SAMPLE ? judge.acquitted / judge.contested : null;
}

export type JudicialData = {
  updatedAt?: string;
  months: string[];
  coverage: { from: string; to: string; judgments: number };
  labels: { outcome: Record<string, string>; offence: Record<string, string>; charge: Record<string, string> };
  totals: { judgments: number; byOutcome: Record<string, number>; byLevel: Record<string, number> };
  overall: OutcomeProfile | null;
  byCharge: Record<string, ChargeProfile>;
  bySentence: Record<string, SentenceProfile>;
  byLevel: Record<string, OutcomeProfile>;
  byYear: Record<string, OutcomeProfile>;
  judges: JudgeSummary[];
};

export const emptyJudicial: JudicialData = {
  months: [],
  coverage: { from: "", to: "", judgments: 0 },
  labels: { outcome: {}, offence: {}, charge: {} },
  totals: { judgments: 0, byOutcome: {}, byLevel: {} },
  overall: null,
  byCharge: {},
  bySentence: {},
  byLevel: {},
  byYear: {},
  judges: [],
};

/** 月份代碼 202405 轉成可讀的 2024 年 5 月。 */
export function monthLabel(month: string): string {
  return /^\d{6}$/.test(month) ? `${month.slice(0, 4)} 年 ${Number(month.slice(4))} 月` : month;
}

/** 刑期以月為單位存放，顯示時換成年月，免得看到「38 個月」還要自己換算。 */
export function monthsLabel(months: number): string {
  if (months < 12) return `${months} 個月`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} 年 ${rest} 個月` : `${years} 年`;
}

/** 涵蓋範圍的月份數換算成「X 年 X 個月」，例如 125 → 10 年 5 個月。 */
export function spanLabel(count: number): string {
  const years = Math.floor(count / 12);
  const rest = count % 12;
  if (years === 0) return `${rest} 個月`;
  return rest ? `${years} 年 ${rest} 個月` : `${years} 年`;
}

export function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${(value * 100).toFixed(1)}%`;
}

/** 「823 ÷ 876」這種寫法，讓人一眼看見分母是誰。 */
export function fraction(value: Rate | undefined): string {
  if (!value) return "—";
  return `${value.part.toLocaleString()} ÷ ${value.whole.toLocaleString()}`;
}
export type TalentItem = { name: string; gender: string; unit: string; title: string; page: number };
export type TalentData = { updatedAt: string; sourceUrl: string; notice: string; records: TalentItem[] };
export const victimSequence: { id: Exclude<VictimView, "home">; label: string }[] = [
  { id: "safety", label: "安全計畫" },
  { id: "evidence", label: "證據保存" },
  { id: "police", label: "報警程序" },
  { id: "campus", label: "校園性平" },
  { id: "appeal", label: "申復與救濟" },
  { id: "preparation", label: "行動準備" },
  { id: "rights", label: "時限與權利" },
  { id: "mental", label: "心理支持" },
  { id: "talent", label: "全國性平委員" },
];

// 索引檔載入前先顯示的內容，取自實際索引的最新幾則。
export const newsFallback: NewsItem[] = [
  { title: "涉隱匿通報校園性平案件 南聰學校2前主任遭監院彈劾", url: "https://news.pts.org.tw/article/818099", publishedAt: "2026-07-17 14:32:00", summary: "國立台南大學附屬啟聰學校2名教職員知悉校內發生性別事件後涉及隱匿、滅證，遭監察院提出彈劾。", category: "文教科技" },
  { title: "廁所裝針孔偷拍16人如廁 嘉義民雄樂器行負責人遭起訴", url: "https://news.pts.org.tw/article/818629", publishedAt: "2026-07-21 14:33:22", summary: "劉姓負責人涉嫌於店內廁所裝設針孔攝影機偷拍16人，其中10名為未成年人，嘉義地檢署提起公訴。", category: "社會" },
  { title: "嘉義樂器行負責人涉裝針孔 拍學生如廁16人受害", url: "https://news.pts.org.tw/article/818722", publishedAt: "2026-07-21 19:39:46", summary: "檢警調查發現該店廁所自2025年7月起裝設針孔攝影機，受害者包含多名學生。", category: "社會" },
];

/**
 * 資料檔是與程式碼分開部署的，可能來自舊版本或內容殘缺，
 * 直接信任它會讓整個站在執行時崩潰。這裡把不符結構的資料一律視為沒有資料，
 * 讓畫面退回空狀態，而不是丟出例外。
 */
/**
 * 只檢查 total 是不夠的。統計的結構改過一次：舊版把比率放成 convictionRate
 * 這樣的純數字，新版改成帶分子分母的物件並多了 counts。資料檔與程式碼分開部署，
 * 舊檔可能還留在 CDN 或使用者的快取裡，讀到 counts.substantive 就會整頁炸掉。
 * 因此逐一確認這一版真正會用到的欄位都在，缺一個就當作沒有資料。
 */
function isRate(value: unknown): boolean {
  return !!value && typeof (value as Rate).part === "number" && typeof (value as Rate).whole === "number";
}

function isProfile(value: unknown): value is OutcomeProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as OutcomeProfile;
  return typeof profile.total === "number"
    && !!profile.counts && typeof profile.counts.substantive === "number"
    && typeof profile.counts.convicted === "number"
    && typeof profile.counts.closedBeforeMerits === "number"
    && typeof profile.counts.probation === "number"
    && isRate(profile.conviction)
    && isRate(profile.closedBeforeMerits)
    && isRate(profile.probation);
}

function profileMap<T extends OutcomeProfile>(input: unknown): Record<string, T> {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(([, value]) => isProfile(value)),
  ) as Record<string, T>;
}

export function normalizeJudicial(input: unknown): JudicialData {
  const raw = (input ?? {}) as Partial<JudicialData>;
  const judges = Array.isArray(raw.judges)
    ? raw.judges.filter((judge): judge is JudgeSummary =>
        typeof judge?.name === "string" && typeof judge?.contested === "number")
    : [];
  return {
    updatedAt: raw.updatedAt,
    months: Array.isArray(raw.months) ? raw.months : [],
    coverage: raw.coverage && typeof raw.coverage.judgments === "number"
      ? raw.coverage
      : emptyJudicial.coverage,
    labels: {
      outcome: raw.labels?.outcome ?? {},
      offence: raw.labels?.offence ?? {},
      charge: raw.labels?.charge ?? {},
    },
    totals: raw.totals && typeof raw.totals.judgments === "number"
      ? { judgments: raw.totals.judgments, byOutcome: raw.totals.byOutcome ?? {}, byLevel: raw.totals.byLevel ?? {} }
      : emptyJudicial.totals,
    overall: isProfile(raw.overall) ? raw.overall : null,
    byCharge: profileMap<ChargeProfile>(raw.byCharge),
    bySentence: sentenceMap(raw.bySentence),
    byLevel: profileMap(raw.byLevel),
    byYear: profileMap(raw.byYear),
    judges,
  };
}

function sentenceMap(input: unknown): Record<string, SentenceProfile> {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(([, value]) => {
      const item = value as SentenceProfile;
      return !!item && typeof item.convicted === "number" && isRate(item.probation);
    }),
  ) as Record<string, SentenceProfile>;
}
