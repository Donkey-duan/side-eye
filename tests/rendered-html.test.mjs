import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/** 讀取 next build（output: "export"）產生的靜態頁面。 */
async function page(path) {
  const file = path === "/" ? "index.html" : `${path.replace(/^\//, "")}/index.html`;
  return readFile(new URL(`../out/${file}`, import.meta.url), "utf8");
}

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("首頁靜態產出包含站台主要內容", async () => {
  const html = await page("/");
  assert.match(html, /<title>[^<]*｜明鏡性平<\/title>/);
  assert.match(html, /全台性別事件公共資訊平台/);
  assert.match(html, /公視性平新聞索引/);
  assert.match(html, /運動部不適任教練專區/);
  assert.match(html, /先做安全計畫/);
  // 首頁改成兩道門：求助 / 搞懂
  assert.match(html, /想知道下一步該怎麼做/);
  assert.match(html, /搞懂性平事件的數據/);
});

test("每個專區都有可分享的網址與各自的 metadata", async () => {
  const cases = [
    ["/", "台灣性別事件公共資訊平台", /class="hero /],
    ["/explore", "搞懂性平事件的真實情況", /class="explore /],
    ["/victim", "我是受害者", /class="campus-hub /],
    ["/victim/appeal", "申復與後續救濟", /有應調查之證據而未調查/],
    ["/victim/evidence", "證據保存與送件", /LINE 對話不要只留匯出的文字檔/],
    ["/victim/mental", "心理準備與支持", /認定會受委員主觀判斷影響/],
    ["/sources", "資料來源與涵蓋範圍", /本站沒有個別事件的跨來源索引/],
    ["/judges", "司法現況與裁判觀測", /class="insights /],
    ["/judges/results", "性平案件歷來怎麼判", /class="insights /],
    ["/judges/sentencing", "性平案件的量刑", /class="insights /],
    ["/judges/panel", "法官承審紀錄", /class="insights /],
    ["/committee", "性平委員調查案例統計", /class="committee /],
    ["/news", "公視性平新聞索引", /class="news /],
    ["/coaches", "運動部不適任教練專區", /class="coach-watch /],
    ["/faq", "常見問題", /為什麼只有「我是受害者」/],
    ["/privacy", "隱私政策", /本站不收集個人資料/],
    ["/corrections", "資料更正與下架", /可以要求更正的範圍/],
    ["/licence", "資料授權", /司法院裁判書/],
  ];

  for (const [path, title, marker] of cases) {
    const html = await page(path);
    assert.match(html, new RegExp(`<title>${title}｜明鏡性平</title>`), `${path} 的 title 不正確`);
    assert.match(html, marker, `${path} 未於建置時渲染對應內容`);
    assert.match(html, /<meta name="description"/, `${path} 缺少 description`);
  }

  // 頁尾三個連結原本都指向 #top，點了沒反應
  const home = await page("/");
  assert.doesNotMatch(home, /href="#top"/, "頁尾仍有指向 #top 的死連結");
  for (const label of ["隱私政策", "資料更正與下架", "資料授權"]) {
    assert.match(home, new RegExp(`class="footer-link"[^>]*>${label}<`), `頁尾缺少${label}連結`);
  }

  // 回報表單設定後，更正頁要顯示可點的表單按鈕，不再是「建置中」
  const corrections = await page("/corrections");
  assert.match(corrections, /href="https:\/\/forms\.gle\/[^"]+"[^>]*>開啟資料更正與回報表單/,
    "更正頁缺少回報表單按鈕");
  assert.doesNotMatch(corrections, /回報管道建置中/, "表單已設定，不應再顯示建置中");
});

test("受害者專區涵蓋安全、證據、程序、申復與復原", async () => {
  const code = await source("app/components/victim-guide.tsx");
  // 數位安全提醒給求助者，不能只藏在隱私政策
  assert.match(code, /本站不會記錄你看了什麼，但你的裝置與瀏覽器會留下紀錄/);
  assert.match(code, /用無痕／私密視窗瀏覽/);
  // 給不知從何開始的人一個有先後的起手式，前幾件有時效
  assert.match(code, /如果不知道從哪開始，先做這幾件/);
  assert.match(code, /採證有時效/);
  assert.match(code, /不要只蒐集證據，也要確保它真的被收到與看見/);
  assert.match(code, /等候正式筆錄可能達數小時/);
  assert.match(code, /調查期：法定二個月，可延長兩次/);
  assert.match(code, /你不需要有完美記憶、完美反應/);
  // 保密切結書無拘束力，但要同時講清個資／誹謗的界線，才不會誤導當事人任意公開
  assert.match(code, /學校要你簽「保密切結書」，沒有法律拘束力/);
  assert.match(code, /1020164059/);
  assert.match(code, /可能涉及個人資料保護法/);
  // 申復門檻與六款法定重大瑕疵是專區最難在別處找到的內容
  assert.match(code, /有應調查之證據而未調查/);
  assert.match(code, /有證據取捨瑕疵而影響事實認定/);
  assert.match(code, /不成立，不等於事情沒有發生/);

  assert.match(await source("app/site-view.tsx"), /受害者專區前後導覽/);
});

test("資料方法彈窗可用鍵盤關閉並鎖住焦點", async () => {
  const code = await source("app/components/method-dialog.tsx");
  assert.match(code, /event\.key === "Escape"/);
  assert.match(code, /event\.key !== "Tab"/);
  assert.match(code, /opener\?\.focus\(\)/, "關閉後焦點應回到觸發按鈕");
  assert.match(code, /aria-modal="true"/);
  assert.doesNotMatch(code, /每筆保留原始連結與擷取日期/);
});

test("資料管線遵守司法院 API 的規格與時段限制", async () => {
  const code = await source("scripts/build-data.mjs");
  // 規格：僅每日 00:00–06:00 開放
  assert.match(code, /taipeiHour\(\) >= 6/);
  // 規格：回「查無資料」代表已下架，應一併刪除先前取得的內容
  assert.match(code, /查無資料/);
  assert.match(code, /known\.delete/);
  // 只保留統計欄位，不保存判決全文
  assert.doesNotMatch(code, /content:\s*content/);
  // 憑證不得被記錄或寫入輸出。大小寫敏感：訊息裡提到變數名稱 JUDICIAL_API_PASSWORD
  // 是可以的，不能出現的是小寫的 password 變數本身。
  assert.doesNotMatch(code, /log\([^)]*\bpassword\b/);
  assert.doesNotMatch(code, /\$\{\s*password\s*\}/);
  assert.doesNotMatch(code, /writeJson\([^)]*\bpassword\b/);
});

test("資料異常時工作流程會失敗而不是安靜地繼續發布", async () => {
  // 每晚排程最容易發生也最難察覺的失敗，是「照常發布但資料沒更新」。
  // CI 上必須真的丟出錯誤，GitHub 才會寄信通知。
  const pipeline = await source("scripts/build-data.mjs");
  assert.match(pipeline, /process\.env\.CI === "true"/);
  assert.match(pipeline, /if \(STRICT\) throw new Error/);
  assert.match(pipeline, /全部無法連線/, "缺少來源無法連線的檢查");
  assert.match(pipeline, /一則新聞都解析不出來/, "缺少解析失效的檢查");
  assert.match(pipeline, /卻沒有 JUDICIAL_API_USER/, "缺少開放時段內憑證缺失的檢查");

  // 區分「還沒設定來源」與「設定了但取不到」：只有後者該讓 CI 失敗
  const talent = await source("scripts/fetch-talent.mjs");
  assert.match(talent, /SOURCE_URL && process\.env\.CI === "true"/, "設定的名冊來源失效時 CI 應失敗");
});

test("執行時抓來的資料結構不符時要退回空狀態，而不是讓整站崩潰", async () => {
  // 資料檔與程式碼分開部署，可能來自舊版本。SiteView 掛在 layout，
  // 一旦在此丟出例外，每一頁都會變成空白。
  const { normalizeJudicial } = await import("../app/data.ts");

  // 上一版的法官欄位是案件陣列，這一版改成件數。舊檔留在快取或 CDN 上時，
  // 必須被視為沒有資料，而不是讓畫面拿陣列去做算術。
  const legacy = { judgmentCount: 55, judges: [{ name: "某", guilty: [{ title: "x" }], acquitted: [] }] };
  const fromLegacy = normalizeJudicial(legacy);
  assert.deepEqual(fromLegacy.judges, [], "舊格式的法官資料應被濾除");
  assert.equal(fromLegacy.overall, null, "缺少統計時不應偽造數字");
  assert.equal(fromLegacy.coverage.judgments, 0);

  // 上一版的統計把比率放成純數字（convictionRate），這一版改成帶分子分母的物件
  // 並多了 counts。只檢查 total 會讓舊檔通過，接著在讀 counts.substantive 時整頁炸掉。
  const oldStats = {
    coverage: { from: "20260101", to: "20260131", judgments: 2 },
    overall: { total: 2, outcomes: { guilty: 1 }, substantive: 2, convictionRate: 0.5 },
    byCharge: { sexualAutonomy: { label: "妨害性自主", total: 2, convictionRate: 1 } },
  };
  const fromOldStats = normalizeJudicial(oldStats);
  assert.equal(fromOldStats.overall, null, "舊版統計結構應被視為沒有資料");
  assert.deepEqual(fromOldStats.byCharge, {});

  for (const broken of [null, undefined, {}, { judges: "not-an-array" }, { byCharge: "x", byLevel: 3 }]) {
    const result = normalizeJudicial(broken);
    assert.ok(Array.isArray(result.judges), "judges 必須恆為陣列");
    assert.equal(result.judges.length, 0);
    assert.deepEqual(result.byCharge, {});
    assert.deepEqual(result.byLevel, {});
    assert.equal(result.overall, null);
  }

  const profile = {
    total: 2,
    outcomes: { guilty: 1, acquitted: 1 },
    counts: { substantive: 2, convicted: 1, acquitted: 1, partial: 0, dismissed: 0, exempted: 0, closedBeforeMerits: 0, probation: 0 },
    conviction: { part: 1, whole: 2, rate: 0.5 },
    acquittal: { part: 1, whole: 2, rate: 0.5 },
    closedBeforeMerits: { part: 0, whole: 2, rate: 0 },
    probation: { part: 0, whole: 1, rate: 0 },
    prisonMonths: null,
    lifeOrDeath: 0,
  };
  const valid = normalizeJudicial({
    months: ["202601"],
    coverage: { from: "20260101", to: "20260131", judgments: 2 },
    labels: { outcome: { guilty: "有罪" }, offence: {} },
    totals: { judgments: 2, byOutcome: { guilty: 1, acquitted: 1 }, byLevel: { first: 2 } },
    overall: profile,
    byCharge: { sexualAutonomy: { label: "妨害性自主", ...profile } },
    judges: [{ name: "某", contested: 25, convicted: 20, acquitted: 5, summary: 3, appellate: 2, latestDate: "20260131" }],
  });
  assert.equal(valid.judges.length, 1);
  assert.equal(valid.overall?.conviction.rate, 0.5);
  assert.equal(valid.overall?.counts.substantive, 2);
  assert.equal(valid.byCharge.sexualAutonomy.label, "妨害性自主");
  assert.equal(valid.coverage.judgments, 2);
});

test("司法統計的方法與限制寫在站上，而不是只存在於程式碼裡", async () => {
  // 這一區的數字是本站判讀出來的，不是機關發布的。判準、分母與已知限制
  // 必須攤開，讀者才有辦法判斷該不該相信，也才有辦法指出哪裡算錯。
  const method = await source("app/components/judicial-method.tsx");
  assert.match(method, /政府資料開放授權條款第一版/, "缺少授權說明");
  assert.match(method, /只讀主文，不讀理由/, "缺少判定方式");
  assert.match(method, /定罪率＝（有罪＋部分有罪）÷（有罪＋部分有罪＋無罪）/, "缺少分母定義");
  // 三個比率的分母不同，只給百分比一定會被誤讀成同一個分母
  assert.match(method, /未進入實體審理的比例＝（不受理＋免訴）÷ 全部件數/, "缺少不受理的分母定義");
  assert.match(method, /緩刑比例＝獲緩刑的定罪件數 ÷ 定罪件數/, "缺少緩刑的分母定義");
  assert.match(method, /並不矛盾/, "未正面說明兩個比率為何看似衝突");
  assert.match(method, /只算第一審/, "未說明為何限定審級");
  assert.match(method, /應執行刑/, "未說明刑期取法");
  assert.match(method, /中位數與四分位距/, "未說明為何不用平均值");
  assert.match(method, /維持的是哪一種結果，本站不推測/, "未交代上訴審的限制");
  // 一二審是事實審、三審是法律審；上訴駁回可能是程序駁回——法律系讀者指正過的精確度
  assert.match(method, /第一審與第二審都是事實審/, "未區分事實審與法律審");
  assert.match(method, /程序駁回/, "未點出上訴駁回可能是程序性的");
  // 無罪推定與證明門檻：無罪不等於沒發生，對受害者是關鍵訊息
  assert.match(method, /無罪推定/, "未說明無罪推定");
  assert.match(method, /「無罪」，和「事實上沒有發生」是兩回事/, "未澄清無罪不等於沒發生");
  assert.match(method, /會有錯/, "未承認分類可能出錯");
  // 結果統計依案由分組是為了避免定罪率虛高，這個理由必須寫給讀者看
  assert.match(method, /為什麼有兩張表/, "未說明兩張表的分組為何不同");
  assert.match(method, /無罪判決的主文只寫「被告無罪」/, "未說明依主文分組會造成的偏誤");

  const sources = await source("app/site-view.tsx");
  assert.doesNotMatch(sources, /以上皆為官方公開來源，未經本站加工或推論/,
    "裁判統計由本站計算，不能再宣稱未經加工");

  // 法官統計最易被誤讀：定罪率高低大半是案件組成，不是法官傾向。無罪率只計
  // 通常程序實體案件、標樣本數、樣本不足不給比率——這些防誤讀的設計要守住。
  const report = await source("app/components/judicial-report.tsx");
  assert.match(report, /大半由「他分到哪種案子」決定/, "未說明案件組成才是定罪率高低的主因");
  assert.match(report, /樣本少於 \{JUDGE_MIN_SAMPLE\} 件不顯示比率/, "未說明小樣本不給比率");
  assert.match(report, /judgeAcquittalRate/, "無罪率未經樣本門檻把關");
});

test("委員統計含全國通報趨勢，並誠實說明全國無屬實率", async () => {
  const committee = await page("/committee");
  // 全國通報 19 年三類趨勢，補上原本只有台北市的缺口
  assert.match(committee, /全國校園性別事件通報趨勢/);
  assert.match(committee, /class="nat-bar[ "]/);
  // 手機沒有 hover，必須能點選看到每年數字
  assert.match(committee, /選取年度/);
  // 全國屬實只公布人數，不能算屬實率——這正是本站一貫的誠實揭露
  assert.match(committee, /屬實率無法在全國尺度計算/);
  assert.match(committee, /臺北市：通報與調查屬實/);
});

test("排程有備援時段，且不會重複抓取同一份異動清單", async () => {
  const workflow = await source(".github/workflows/deploy.yml");
  const crons = [...workflow.matchAll(/- cron: "(\d+) (\d+) \* \* \*"/g)].map((m) => Number(m[2]));
  assert.ok(crons.length >= 2, "只有單一時段，GitHub 排程延遲時會錯過司法院的開放時段");
  for (const utcHour of crons) {
    assert.ok((utcHour + 8) % 24 < 6, `UTC ${utcHour} 時換算臺北為 ${(utcHour + 8) % 24} 時，超出開放時段`);
  }

  // 多個時段的前提是重複執行要夠便宜，否則每晚會抓好幾次數千份裁判書
  const pipeline = await source("scripts/build-data.mjs");
  assert.match(pipeline, /sourceDate === previousSourceDate/, "缺少重複抓取的防護");
  assert.match(pipeline, /alreadyDone/);
});

test("累積式索引不會每晚砍掉重來", async () => {
  const code = await source("scripts/build-data.mjs");
  assert.match(code, /readPrevious/, "缺少沿用前一版的機制");
  assert.match(code, /SITE_URL/, "未從已發布網站取回前一版");
  assert.match(code, /byUrl\.set/, "新聞未以網址去重合併");

  // 種子與已發布的版本必須一起併入，不能二選一。只在站上沒有資料時才用種子的話，
  // 第一次部署之後，本機逐頁回溯建立的歷史索引就再也回不來——實際發生過，
  // 1257 則掉到 118 則。
  assert.match(code, /const existing = \[\.\.\.articlesOf\(seed\), \.\.\.articlesOf\(previous\)\]/,
    "種子與已發布版本未合併");
  assert.doesNotMatch(code, /readPrevious\("news\.json",/, "種子不應只是取不到時的備援");

  // 「偷拍」也指拍攝機場管制區、軍事機密等非性事件，須排除；既有索引只剔除
  // 這類明顯誤收，不重跑完整判準，以免把「性侵」等用詞不同的真案子清掉。
  assert.match(code, /isOfftopicToupai/, "缺少非性脈絡偷拍的排除");
  assert.match(code, /管制區/, "排除詞未涵蓋機場管制區");
});

test("名冊不進版控，且排除私人聯絡欄位", async () => {
  const ignore = await source(".gitignore");
  assert.match(ignore, /public\/data\/talent\.json/, "名冊必須排除在版控之外");

  const fetcher = await source("scripts/fetch-talent.mjs");
  assert.match(fetcher, /MIN_RECORDS/, "缺少筆數健全性檢查，可能發布損壞的名冊");

  const extractor = await source("scripts/extract-talent.py");
  for (const field of ["phone", "email", "certificate", "電話", "信箱"]) {
    assert.doesNotMatch(extractor, new RegExp(`OUTPUT_FIELD.*${field}`, "i"));
  }
});

test("建置產物不含任何憑證", async () => {
  const home = await page("/");
  for (const secret of ["JUDICIAL_API_PASSWORD", "JUDICIAL_API_USER", "TALENT_SOURCE_URL"]) {
    assert.doesNotMatch(home, new RegExp(secret), `${secret} 不應出現在建置產物中`);
  }
  // NEXT_PUBLIC_ 前綴的變數會被寫進瀏覽器程式碼，只允許 basePath
  const config = await source("next.config.ts");
  const publicVars = [...config.matchAll(/process\.env\.(NEXT_PUBLIC_\w+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(publicVars)], ["NEXT_PUBLIC_BASE_PATH"]);
});
