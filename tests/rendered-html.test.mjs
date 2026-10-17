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

test("首頁含跳到主要內容的 skip link，且 header／footer 與 main 是平行的 landmark", async () => {
  const html = await page("/");
  // skip link 必須是可聚焦的連結，指向 main 的 id
  assert.match(html, /<a[^>]*href="#main-content"[^>]*>跳到主要內容<\/a>/, "缺少跳到主要內容的 skip link");

  // header 與 footer 不應巢狀在 main 裡，否則 landmark 會失效
  const headerClose = html.indexOf("</header>");
  const mainOpen = html.indexOf("<main");
  const mainClose = html.indexOf("</main>");
  const footerOpen = html.indexOf("<footer");
  assert.ok(headerClose > -1 && mainOpen > -1 && mainClose > -1 && footerOpen > -1,
    "缺少 header／main／footer 標籤");
  assert.ok(headerClose < mainOpen, "header 應在 main 開始前結束，不應巢狀在 main 內");
  assert.ok(mainClose < footerOpen, "footer 應在 main 結束後才開始，不應巢狀在 main 內");
});

test("全站有回到現在按鈕，對話框可用鍵盤關閉並鎖住焦點", async () => {
  // 被內容勾起情緒的人需要隨時打斷：按鈕在每個頁面的靜態輸出裡就要存在，不能等 JS 載入
  const home = await page("/");
  assert.match(home, /aria-haspopup="dialog"/, "首頁缺少回到現在的懸浮按鈕");
  assert.match(home, /回到現在/, "首頁缺少「回到現在」文字");

  // 對話框要自己處理 Esc、焦點鎖定與關閉後焦點返回，缺一項鍵盤使用者就會迷失；
  // 離開動作只能放在事件處理函式裡碰 window，靜態預先渲染時不可存取。
  const code = await source("app/components/safe-exit.tsx");
  assert.match(code, /event\.key === "Escape"/, "缺少 Esc 關閉");
  assert.match(code, /aria-modal="true"/, "對話框缺少 aria-modal");
  assert.match(code, /opener\?\.focus\(\)/, "關閉後焦點未回到觸發按鈕");
  assert.match(code, /window\.location\.replace/, "離開動作應用 replace，避免上一頁又回到這裡");
  assert.match(code, /現在，我很安全/, "缺少回到現在的引導語");
  // 使用者明令：110／113 一律純文字，不做 tel: 連結
  assert.doesNotMatch(code, /href="tel:/, "110／113 不應做成 tel: 連結");

  // 「我是受害者」的安全提示要讓人知道有這個按鈕
  const victim = await page("/victim");
  assert.match(victim, /點右下角的「回到現在」/, "受害者專區未提示回到現在按鈕");
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

test("首頁的站內導覽是真正的 <a href>，搜尋引擎才能從首頁爬到內頁", async () => {
  // 正式站有 basePath（/side-eye）前綴，本機建置沒有；用 [^"]* 兩種都容許，
  // 只要求是指向這些站內路徑的真連結，而不是 <button onClick> 的死連結。
  const home = await page("/");
  assert.match(home, /href="[^"]*\/victim\/"/, "首頁缺少可被爬到的 /victim/ 連結");
  assert.match(home, /href="[^"]*\/judges\/"/, "首頁缺少可被爬到的 /judges/ 連結");
  assert.match(home, /href="[^"]*\/sources\/"/, "首頁缺少可被爬到的 /sources/ 連結");
});

test("司法現況四個分區的視覺主標題是語意標題 <h3>，不是純 <span>", async () => {
  // 圖表區要等瀏覽器抓回 judicial.json 才渲染，預渲染的 HTML 只有載入提示，
  // 所以這裡對元件原始碼斷言，而不是對 out/ 的產出。
  const source = await readFile(new URL("../app/components/judicial-report.tsx", import.meta.url), "utf8");
  for (const heading of ["你的情況歷來怎麼判", "判了多重", "上訴之後會怎樣", "各法官的判決結果"]) {
    assert.match(source, new RegExp(`<h3>${heading}</h3>`), `judicial-report.tsx 缺少 <h3>${heading}</h3>`);
  }
});

test("sitemap.xml 已產生，並列出站內頁面供搜尋引擎索引", async () => {
  const xml = await source("out/sitemap.xml");
  assert.match(xml, /<loc>[^<]*\/victim\/<\/loc>/, "sitemap 缺少 /victim/ 的網址");
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
  // 心理支持頁介紹暖暖 Sunshine（經其同意引用），並要有陪伴者段落
  assert.match(code, /程序之外，也有人可以同行/);
  assert.match(code, /nuannuansunshine\.org/);
  assert.match(code, /如果你是陪伴者/);

  assert.match(await source("app/site-view.tsx"), /受害者專區前後導覽/);
});

test("心理支持頁介紹暖暖 Sunshine 的匿名同儕支持並附來源連結", async () => {
  const html = await page("/victim/mental");
  assert.match(html, /暖暖 Sunshine/);
  assert.match(html, /href="https:\/\/nuannuansunshine\.org\//, "缺少暖暖官方網站的來源連結");
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

  // readPrevious()：只有 404（站台尚未發布過）能靜默；fetch 拋例外或非 2xx 非 404
  // 的回應都代表網站明明存在卻讀不到，必須走健康檢查，否則索引會悄悄停止累積
  assert.match(pipeline, /response\.status === 404\) return null/, "404 未被當成『尚未發布』的靜默狀態");
  assert.match(pipeline, /網站本身存在但這個檔案讀不到/, "非 404 的失敗回應未觸發健康檢查");
  assert.match(pipeline, /可能是網路暫時性問題，也可能是回應內容已經不是合法 JSON/, "fetch 拋例外未觸發健康檢查");

  // preserve()：records 為空代表種子與已發布的前一版同時失敗，是真異常，
  // 不能無聲讓三個裁判資料檔從部署產物裡消失
  assert.match(pipeline, /但既有裁判資料是空的，三個裁判資料檔本次將不會被寫入/, "既有資料為空時未示警");
  assert.match(pipeline, /CI 上一定會設定 JUDICIAL_SOURCE_URL 種子/, "未說明為何空資料視為異常而非正常狀態");

  // 區分「還沒設定來源」與「設定了但取不到」：只有後者該讓 CI 失敗
  const talent = await source("scripts/fetch-talent.mjs");
  assert.match(talent, /SOURCE_URL && process\.env\.CI === "true"/, "設定的名冊來源失效時 CI 應失敗");
});

test("同步腳本上傳裁判種子前會比對新舊筆數，裁判資料只增不減", async () => {
  // --clobber 會直接覆蓋 Release 上的權威種子，筆數變少多半代表這次同步有問題
  // （例如本機環境或憑證異常），而不是司法院真的整批下架，因此上傳前要先擋下來，
  // 並提供人工確認後可跳過的方式，而不是讓錯誤的本機執行悄悄毀掉既有累積。
  const sync = await source("scripts/sync-judicial.mjs");
  assert.match(sync, /count < previousCount/, "缺少新舊筆數的比較");
  assert.match(sync, /少於目前種子的/, "缺少筆數變少時的中止訊息");
  assert.match(sync, /process\.env\.SYNC_FORCE/, "缺少可跳過檢查的環境變數");
  assert.match(sync, /process\.exit\(1\)/, "筆數變少且未強制跳過時應中止，不能照常上傳");
  assert.match(sync, /gh release upload .* --clobber/, "檢查通過後仍應照常覆蓋種子");
});

test("新聞列表抓取頁數足以涵蓋整天，且同步腳本會先啟用被 GitHub 停用的工作流程", async () => {
  // 公視 2026 年 8 月改版後搜尋已死，只能靠 dailynews 列表。每頁 15 則、每天約發 60 則，
  // 預設只抓 2 頁時，三個備援時段看到的是同一批最新 30 則，前一天上午的報導會被推到
  // 第 3 頁以後而永遠漏掉。這裡鎖住預設頁數，避免之後有人為了「快一點」又調回去。
  const pipeline = await source("scripts/build-data.mjs");
  // 留空字串要退回預設，所以用 || 不用 ??。
  const pages = pipeline.match(/NEWS_PAGES = Math\.max\(1, Math\.floor\(Number\(process\.env\.NEWS_PAGES\) \|\| (\d+)\)\)/);
  assert.ok(pages, "找不到 NEWS_PAGES 的預設值");
  assert.ok(Number(pages[1]) >= 8,
    `NEWS_PAGES 預設 ${pages[1]} 頁太少：每頁 15 則、公視每天約發 60 則，2 頁會漏掉前一天上午的報導`);

  // GitHub 對 60 天沒有 commit 的公開 repo 會停用工作流程，停用後 workflow_dispatch 回 HTTP 422。
  // 本機同步腳本是唯一的觸發者，所以必須在觸發前先 enable（冪等，已啟用時不報錯），
  // 順序顛倒就等於沒擋。比對的是實際指令（含 ${WORKFLOW}），不是註解裡的說明文字。
  const sync = await source("scripts/sync-judicial.mjs");
  const enableAt = sync.indexOf("gh workflow enable ${WORKFLOW}");
  const runAt = sync.indexOf("gh workflow run ${WORKFLOW}");
  assert.ok(enableAt >= 0, "同步腳本缺少 gh workflow enable");
  assert.ok(runAt >= 0, "同步腳本缺少 gh workflow run");
  assert.ok(enableAt < runAt, "gh workflow enable 必須出現在 gh workflow run 之前");

  // 搜尋已死，站上不能再宣稱以監測詞查詢公視搜尋並往回收錄歷史；
  // 早期索引來自先前的逐頁回溯，文案要如實分開講。
  for (const file of ["app/data.ts", "app/routes.ts", "app/site-view.tsx"]) {
    assert.doesNotMatch(await source(file), /往回收錄歷史|歷史回溯|查詢公視新聞搜尋/,
      `${file} 仍保留已不成立的新聞抓取描述`);
  }
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

  // judicial-report.tsx 直接讀 profile.outcomes[key]、profile.acquittal.rate 與
  // profile.outcomes.upheld，完全沒有防護。缺 outcomes 或 acquittal 任一個
  // 都要讓 isProfile 判定為沒有資料，而不是留著半殘的統計讓畫面去讀。
  const missingOutcomes = normalizeJudicial({
    overall: {
      total: 2,
      counts: profile.counts,
      conviction: profile.conviction,
      acquittal: profile.acquittal,
      closedBeforeMerits: profile.closedBeforeMerits,
      probation: profile.probation,
      prisonMonths: null,
      lifeOrDeath: 0,
    },
  });
  assert.equal(missingOutcomes.overall, null, "缺 outcomes 的統計應被視為沒有資料");

  const missingAcquittal = normalizeJudicial({
    overall: {
      total: 2,
      outcomes: profile.outcomes,
      counts: profile.counts,
      conviction: profile.conviction,
      closedBeforeMerits: profile.closedBeforeMerits,
      probation: profile.probation,
      prisonMonths: null,
      lifeOrDeath: 0,
    },
  });
  assert.equal(missingAcquittal.overall, null, "缺 acquittal 的統計應被視為沒有資料");
});

test("talent.json 執行期驗證：缺 name／unit／title 的紀錄濾除，結構不符退回空名冊", async () => {
  // site-view.tsx 過去是 load<TalentData>(...) 直接 setTalentData，沒有任何檢查。
  // 名冊也是分開部署的靜態檔，比照 normalizeJudicial 補上輕量驗證。
  const { normalizeTalent } = await import("../app/data.ts");

  const partial = normalizeTalent({
    updatedAt: "1150701",
    records: [
      { name: "王小明", unit: "臺灣大學", title: "副教授" },
      { name: "李小華", unit: "", title: 123 },
      { unit: "成功大學", title: "教授" },
    ],
  });
  assert.equal(partial.records.length, 1, "缺 name/unit/title 任一字串欄位的紀錄應被濾除");
  assert.equal(partial.records[0].name, "王小明");
  assert.equal(partial.records[0].gender, "", "缺的欄位應給預設值而不是 undefined");
  assert.equal(partial.updatedAt, "1150701");

  for (const broken of [null, undefined, {}, { records: "not-an-array" }, { records: [1, "x", null] }]) {
    const result = normalizeTalent(broken);
    assert.ok(Array.isArray(result.records), "records 必須恆為陣列");
    assert.equal(result.records.length, 0);
    assert.equal(result.updatedAt, "");
  }
});

test("法官明細檔缺陣列欄位時退回空陣列，而不是讓法官清單整段炸掉", async () => {
  // judicial-judges.json 過去只做型別斷言，detail.charges.length、acquittedCases、
  // guiltyCases 卻是直接存取，缺欄位會在展開法官清單時整段丟例外。
  const code = await source("app/components/judicial-report.tsx");
  assert.match(code, /function normalizeJudgeDetails/, "缺少法官明細的執行期驗證");
  assert.match(code, /setDetails\(normalizeJudgeDetails\(payload\.judges\)\)/, "loadDetails 未套用明細驗證");
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
