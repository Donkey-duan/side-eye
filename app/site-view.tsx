"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { JUDGE_TABS, parsePath, scrollTargetFor, viewPath, type JudgeView, type SiteView, type VictimView } from "./routes";
import {
  DATA_BASE, chartHeight, committeeStats, committeeTotal, dataSources, emptyJudicial,
  nationalMax, nationalReports, nationalTotal, newsFallback,
  normalizeJudicial, sourceStateLabel, spanLabel, statsMax, victimSequence,
  type JudicialData, type NewsIndex, type NewsItem, type TalentData,
} from "./data";
import JudicialMethod from "./components/judicial-method";
import JudicialReport from "./components/judicial-report";
import MethodDialog from "./components/method-dialog";
import PolicyPages from "./components/policy-pages";
import VictimGuide from "./components/victim-guide";

// 這個元件掛在 layout 而不是各個 page 底下，切換專區時才不會整個 remount
// 而重新抓一次新聞、裁判統計與兩千多筆人才名冊。view 一律由網址推導。
export default function SiteView() {
  const router = useRouter();
  const pathname = usePathname();
  const { siteView, victimView, judgeView } = parsePath(pathname ?? "/");
  const [methodOpen, setMethodOpen] = useState(false);
  // 穩定的參考，否則 MethodDialog 的 effect 每次 render 都會重跑並把焦點搶走
  const closeMethod = useCallback(() => setMethodOpen(false), []);
  const [statsYear, setStatsYear] = useState("113");
  const [natYear, setNatYear] = useState(2024);
  const [allNews, setAllNews] = useState<NewsItem[]>(newsFallback);
  const [newsQuery, setNewsQuery] = useState("");
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsUpdated, setNewsUpdated] = useState("");
  const [newsPage, setNewsPage] = useState(1);
  const [judicialData, setJudicialData] = useState<JudicialData>(emptyJudicial);
  const [talentData, setTalentData] = useState<TalentData>({ updatedAt: "", sourceUrl: "", notice: "", records: [] });
  const [talentQuery, setTalentQuery] = useState("");
  const [talentPage, setTalentPage] = useState(1);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  const selectedStats = committeeStats.find((item) => item.year === statsYear) ?? committeeStats[4];

  // <details> 原生不會因為點擊外部而關閉，手機上尤其惱人
  useEffect(() => {
    const close = (event: MouseEvent) => {
      for (const menu of [menuRef.current, mobileMenuRef.current]) {
        if (menu?.open && !menu.contains(event.target as Node)) menu.removeAttribute("open");
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // 三份資料都是每晚由排程產生的靜態 JSON，載入後全部的搜尋與篩選都在瀏覽器內完成，
  // 不再需要伺服器。這也是為什麼多少人同時使用都不會互相排隊。
  useEffect(() => {
    let cancelled = false;
    const load = async <T,>(path: string, apply: (data: T) => void) => {
      try {
        const response = await fetch(path);
        if (!response.ok) return;
        const data = await response.json() as T;
        if (!cancelled) apply(data);
      } catch {
        // 檔案還沒產生或暫時取不到；畫面已有各自的空狀態說明
      }
    };
    void load<NewsIndex>(`${DATA_BASE}/news.json`, (data) => {
      if (data.articles?.length) setAllNews(data.articles);
      if (data.updatedAt) setNewsUpdated(new Date(data.updatedAt).toLocaleString("zh-TW", { hour12: false }));
    }).finally(() => { if (!cancelled) setNewsLoading(false); });
    void load<unknown>(`${DATA_BASE}/judicial.json`, (data) => setJudicialData(normalizeJudicial(data)));
    void load<TalentData>(`${DATA_BASE}/talent.json`, setTalentData);
    return () => { cancelled = true; };
  }, []);

  // 搜尋改在瀏覽器內比對已下載的索引，按下就有結果，不需要等網路
  const newsItems = useMemo(() => {
    const terms = newsQuery.trim().toLowerCase().split(/[\s,，]+/).filter(Boolean);
    if (terms.length === 0) return allNews;
    return allNews.filter((article) => {
      const searchable = `${article.title}${article.summary}${article.category}`.toLowerCase();
      return terms.some((term) => searchable.includes(term));
    });
  }, [allNews, newsQuery]);

  const filteredTalent = useMemo(() => {
    const normalized = talentQuery.trim().toLowerCase();
    return normalized ? talentData.records.filter((item) => `${item.name}${item.unit}${item.title}`.toLowerCase().includes(normalized)) : talentData.records;
  }, [talentData, talentQuery]);
  const talentPageSize = 24;
  const talentPageCount = Math.max(1, Math.ceil(filteredTalent.length / talentPageSize));
  const visibleTalent = filteredTalent.slice((talentPage - 1) * talentPageSize, talentPage * talentPageSize);
  const newsPageSize = 12;
  const newsPageCount = Math.max(1, Math.ceil(newsItems.length / newsPageSize));
  const visibleNews = newsItems.slice((newsPage - 1) * newsPageSize, newsPage * newsPageSize);

  // view 由網址決定，所以捲動掛在 siteView / victimView 上。等 React commit
  // 之後才捲，元素才不會還是 display:none——對隱藏元素呼叫 scrollIntoView 無效。
  // 首次載入不捲，因為瀏覽器本來就會停在頁首，直接跳動反而突兀。
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const node = document.getElementById(scrollTargetFor(siteView, victimView, judgeView));
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [siteView, victimView, judgeView]);

  // 切換司法現況的分頁時，改用網址推導，SiteView 掛在 layout 不會 remount。
  // 也關掉選單——選單裡可直接點到某個子分區，點完要收起來。
  function openJudge(view: JudgeView) {
    menuRef.current?.removeAttribute("open");
    mobileMenuRef.current?.removeAttribute("open");
    router.push(viewPath("judges", "home", view));
  }

  function openSection(view: SiteView) {
    menuRef.current?.removeAttribute("open");
    mobileMenuRef.current?.removeAttribute("open");
    router.push(viewPath(view));
  }

  function openVictim(view: VictimView) {
    menuRef.current?.removeAttribute("open");
    mobileMenuRef.current?.removeAttribute("open");
    router.push(viewPath("victim", view));
  }

  function victimPager() {
    const current = victimSequence.findIndex((item) => item.id === victimView);
    if (current < 0) return null;
    const previous = victimSequence[current - 1];
    const next = victimSequence[current + 1];
    return <nav className="section-pager" aria-label="受害者專區前後導覽">
      <button onClick={() => previous && openVictim(previous.id)} disabled={!previous}><small>上一區</small><strong>{previous ? `← ${previous.label}` : "已是第一區"}</strong></button>
      <button className="pager-home" onClick={() => openVictim("home")}><small>返回</small><strong>專區首頁</strong></button>
      <button onClick={() => next && openVictim(next.id)} disabled={!next}><small>下一區</small><strong>{next ? `${next.label} →` : "已是最後一區"}</strong></button>
    </nav>;
  }

  // 每個資料專區結尾再放一次目錄，方便直接跳到其他資料區，不必回總覽再選
  function exploreNav(current: SiteView) {
    const items: { view: SiteView; label: string }[] = [
      { view: "judges", label: "司法現況" },
      { view: "committee", label: "性平調查統計" },
      { view: "sources", label: "資料來源" },
      { view: "news", label: "新聞專區" },
      { view: "coaches", label: "不適任教練" },
    ];
    return <nav className="explore-nav" aria-label="切換其他資料專區">
      <span>看其他資料</span>
      <div className="explore-nav-grid">
        {items.filter((item) => item.view !== current).map((item) => (
          <button key={item.view} onClick={() => openSection(item.view)}>{item.label} →</button>
        ))}
      </div>
      <button className="explore-nav-home" onClick={() => openSection("explore")}>回資料總覽</button>
    </nav>;
  }

  return (
    <main>
      <header className="topbar">
        <button className="brand brand-button" onClick={() => openSection("home")} aria-label="明鏡性平首頁">
          <span className="brand-mark">平</span>
          <span><strong>明鏡性平</strong><small>TAIWAN GENDER EQUITY WATCH</small></span>
        </button>
        <nav aria-label="主要導覽">
          <details className="campus-menu" ref={menuRef}>
            <summary>我是受害者</summary>
            <div>
              <button onClick={() => openVictim("home")}>專區首頁</button>
              <button onClick={() => openVictim("safety")}>先做安全計畫</button>
              <button onClick={() => openVictim("evidence")}>證據保存與送件</button>
              <button onClick={() => openVictim("police")}>一般報警／刑事程序</button>
              <button onClick={() => openVictim("campus")}>校園性平申請</button>
              <button onClick={() => openVictim("appeal")}>申復與後續救濟</button>
              <button onClick={() => openVictim("preparation")}>行動準備清單</button>
              <button onClick={() => openVictim("rights")}>時限與權利提醒</button>
              <button onClick={() => openVictim("mental")}>心理準備與支持</button>
              <button onClick={() => openVictim("talent")}>全國性平委員</button>
            </div>
          </details>
          <button className="method-link" onClick={() => openSection("sources")}>資料來源</button>
          <button className="method-link" onClick={() => openSection("judges")}>司法現況</button>
          <button className="method-link" onClick={() => openSection("committee")}>性平調查統計</button>
          <button className="method-link" onClick={() => openSection("news")}>新聞專區</button>
          <button className="method-link" onClick={() => setMethodOpen(true)}>資料方法</button>
        </nav>
        <button className="report-button" onClick={() => openSection("corrections")}>資料更正與回報 <span>↗</span></button>

        <details className="mobile-menu" ref={mobileMenuRef}>
          <summary aria-label="開啟選單"><span /><span /><span /></summary>
          {/* 頂層直接列出各專區；只有帶子項的（我是受害者、司法現況、關於本站）
              才是可收合的群組，其餘單一頁面直接一個按鈕 */}
          <div>
            <button className="menu-item" onClick={() => openSection("home")}>首頁</button>
            <button className="menu-item" onClick={() => openSection("sources")}>資料來源與涵蓋範圍</button>
            <details className="menu-group">
              <summary>我是受害者</summary>
              <button onClick={() => openVictim("home")}>專區首頁</button>
              {victimSequence.map((item) => (
                <button key={item.id} onClick={() => openVictim(item.id)}>{item.label}</button>
              ))}
            </details>
            {/* 司法現況與受害者專區同級：四個子分區直接列出，不必先點進去 */}
            <details className="menu-group">
              <summary>司法現況</summary>
              <button onClick={() => openSection("judges")}>司法現況總覽</button>
              {JUDGE_TABS.map((tab) => (
                <button key={tab.view} onClick={() => openJudge(tab.view)}>{tab.label}</button>
              ))}
            </details>
            <button className="menu-item" onClick={() => openSection("committee")}>性平調查統計</button>
            <button className="menu-item" onClick={() => openSection("news")}>新聞專區</button>
            <button className="menu-item" onClick={() => openSection("coaches")}>不適任教練</button>
            <details className="menu-group">
              <summary>關於本站</summary>
              <button onClick={() => openSection("faq")}>常見問題</button>
              <button onClick={() => { mobileMenuRef.current?.removeAttribute("open"); setMethodOpen(true); }}>資料方法與更正原則</button>
              <button onClick={() => openSection("corrections")}>資料更正與回報</button>
              <button onClick={() => openSection("privacy")}>隱私政策</button>
              <button onClick={() => openSection("licence")}>資料授權</button>
            </details>
          </div>
        </details>
      </header>

      <section className={`hero home-hero ${siteView !== "home" ? "site-hidden" : ""}`} id="top">
        <div className="eyebrow"><span /> 全台性別事件公共資訊平台</div>
        <h1>把分散難讀的官方性平資料，<br />整理成一個<strong>看得懂</strong>的地方。</h1>
        <p className="lede">性平事件在司法判決、教育部統計、校園通報的資料多為公開，卻分散在各機關網站、不易讀懂。這裡整理成一個地方，並標明每個數字的來源、範圍與分母。</p>
        <div className="door-grid">
          <button className="door door-help" onClick={() => openVictim("home")}>
            <span className="door-kicker">我遇到性別事件</span>
            <strong>想知道下一步該怎麼做</strong>
            <span className="door-desc">怎麼保全證據、報警、申請校園性平、如何申復，你有哪些期限與權利，也能查你的性平委員是誰。</span>
            <i aria-hidden="true">→</i>
          </button>
          <button className="door door-data" onClick={() => openSection("explore")}>
            <span className="door-kicker">我想了解真實情況</span>
            <strong>搞懂性平事件的數據</strong>
            <span className="door-desc">用標明來源與分母的官方資料，自己看案件歷來怎麼判、校園通報與屬實趨勢，不被標題帶。</span>
            <i aria-hidden="true">→</i>
          </button>
        </div>
      </section>

      <section className={`explore ${siteView !== "explore" ? "site-hidden" : ""}`} id="explore">
        <button className="back-to-hub" onClick={() => openSection("home")}>← 回首頁</button>
        <div className="section-heading"><div><span className="section-kicker">UNDERSTAND</span><h2>搞懂性平事件的數據</h2></div><p>每一項都標明來源、涵蓋範圍與分母，你可以自己查證</p></div>
        <div className="metrics explore-scale" aria-label="資料規模">
          <button className="metric-card" onClick={() => openSection("judges")} aria-label="查看性平刑事判決統計"><strong>{judicialData.coverage.judgments ? judicialData.coverage.judgments.toLocaleString() : "—"}</strong><span>性平刑事判決</span><small>{judicialData.coverage.judgments ? `司法院公開裁判 ${spanLabel(judicialData.months.length)}` : "待首次匯入"} <i>→</i></small></button>
          <button className="metric-card" onClick={() => openSection("committee")} aria-label="查看校園性別事件通報統計"><strong>{committeeTotal.toLocaleString()}</strong><span>校園性別事件通報</span><small>臺北市 109–113 學年 <i>→</i></small></button>
          <button className="metric-card" onClick={() => openSection("news")} aria-label="查看公視性平新聞索引"><strong>{newsLoading ? "—" : newsItems.length.toLocaleString()}</strong><span>公視性平新聞索引</span><small>{newsLoading ? "索引中…" : "監測詞查詢與歷史回溯"} <i>→</i></small></button>
          <button className="metric-card" onClick={() => openVictim("talent")} aria-label="查看全國性平調查人才名冊"><strong>{talentData.records.length ? talentData.records.length.toLocaleString() : "—"}</strong><span>全國性平調查人才</span><small>教育部公開名冊 <i>→</i></small></button>
        </div>
        <div className="portal-grid explore-primary">
          <button onClick={() => openSection("judges")}><b>01</b><strong>司法現況</strong><span>性平案件歷來怎麼判、定罪率、量刑、上訴結果與各法官承審統計</span><i>→</i></button>
          <button onClick={() => openSection("committee")}><b>02</b><strong>性平調查統計</strong><span>校園性別事件的通報與調查屬實趨勢，全國與臺北市</span><i>→</i></button>
        </div>
        <div className="explore-more-head"><span className="section-kicker">更多資料</span></div>
        <div className="explore-more">
          <button onClick={() => openSection("sources")}><strong>資料來源與涵蓋範圍</strong><span>每個來源的權責機關、範圍與現況</span></button>
          <button onClick={() => openSection("news")}><strong>新聞專區</strong><span>可搜尋的公視性平新聞索引</span></button>
          <button onClick={() => openSection("coaches")}><strong>不適任教練</strong><span>運動部公開資訊入口</span></button>
        </div>
      </section>

      <section className={`sources ${siteView !== "sources" ? "site-hidden" : ""}`} id="sources">
        <button className="back-to-hub" onClick={() => openSection("explore")}>← 回資料總覽</button>
        <div className="section-heading">
          <div><span className="section-kicker">DATA COVERAGE</span><h2>資料來源與涵蓋範圍</h2></div>
          <p>{dataSources.length} 個來源的實際狀態 <span className="live-dot" /> {dataSources.filter((source) => source.state === "live").length} 個已接上</p>
        </div>
        <div className="coverage-notice">
          <strong>本站沒有個別事件的跨來源索引。</strong>
          <p>把司法裁判、行政裁罰與教育處分整合成一份可查詢的個案名單，需要各機關以可機讀格式持續開放，而目前沒有這樣的來源。這一頁列出每個來源的權責機關、涵蓋範圍、更新頻率與現況，讓你知道哪些查得到、哪些查不到、以及查不到的原因。</p>
        </div>
        <div className="source-table">
          <div className="source-head"><span>資料來源</span><span>權責機關</span><span>涵蓋範圍與更新</span><span>狀態</span></div>
          {dataSources.map((source) => (
            <article className="source-row" key={source.name}>
              <div><h3>{source.name}</h3><p>{source.note}</p></div>
              <div className="source-authority">{source.authority}</div>
              <div className="source-scope"><span>{source.coverage}</span><small>更新：{source.cadence}</small></div>
              <div>
                <span className={`source-state ${source.state}`}>{sourceStateLabel[source.state]}</span>
                <button className="inline-link" onClick={() => (source.target === "victim" ? openVictim("talent") : openSection(source.target))}>前往查看 →</button>
              </div>
            </article>
          ))}
        </div>
        <p className="demo-note official-note"><span /> 以上皆為官方公開來源。新聞索引與名冊僅重整不改內容；裁判統計則由本站從裁判書全文判讀彙整，方法與限制列於下方。引用時請以原始機關頁面為準。</p>
        <JudicialMethod data={judicialData} />
        {exploreNav("sources")}
      </section>

      <section className={`committee ${siteView !== "committee" ? "site-hidden" : ""}`} id="committee">
        <button className="back-to-hub" onClick={() => openSection("explore")}>← 回資料總覽</button>
        <div className="section-heading committee-heading">
          <div><span className="section-kicker">COMMITTEE REVIEW</span><h2>性平委員調查案例統計</h2></div>
          <p>全國通報趨勢與臺北市屬實明細</p>
        </div>

        <div className="national-panel">
          <div className="panel-title"><div><strong>全國校園性別事件通報趨勢</strong><small>三類合計，全國、按曆年</small></div><span>民國 95—113 年</span></div>
          <div className="national-chart" aria-label="全國歷年校園性別事件通報件數統計圖">
            {nationalReports.map((item) => {
              const total = nationalTotal(item);
              const roc = item.year - 1911;
              return (
                <button className={`nat-bar ${natYear === item.year ? "selected" : ""}`} key={item.year} onClick={() => setNatYear(item.year)} aria-label={`${roc} 年，合計 ${total} 件`}>
                  <span className="nat-stack" style={{ height: `${(total / nationalMax) * chartHeight}px` }}>
                    <i className="seg-harass" style={{ height: `${(item.harass / total) * 100}%` }} />
                    <i className="seg-assault" style={{ height: `${(item.assault / total) * 100}%` }} />
                    {item.bully ? <i className="seg-bully" style={{ height: `${(item.bully / total) * 100}%` }} /> : null}
                  </span>
                  <b>{roc}</b>
                </button>
              );
            })}
          </div>
          {(() => {
            const sel = nationalReports.find((item) => item.year === natYear) ?? nationalReports.at(-1)!;
            const total = nationalTotal(sel);
            return (
              <div className="national-readout">
                <div className="nat-year"><span>選取年度</span><strong>{sel.year - 1911}<small> 年（{sel.year}）</small></strong></div>
                <div className="nat-figures">
                  <span><i className="seg-assault" />性侵害<b>{sel.assault.toLocaleString()}</b></span>
                  <span><i className="seg-harass" />性騷擾<b>{sel.harass.toLocaleString()}</b></span>
                  <span><i className="seg-bully" />性霸凌<b>{sel.bully === null ? "尚未統計" : sel.bully.toLocaleString()}</b></span>
                  <span className="nat-sum">合計<b>{total.toLocaleString()} 件</b></span>
                </div>
              </div>
            );
          })()}
          <div className="national-legend">
            <span>點長條看該年數字</span>
            <a href="https://depart.moe.edu.tw/ED4500/cp.aspx?n=6B614520164A590E" target="_blank" rel="noreferrer">教育部統計處 ↗</a>
          </div>
          <p className="national-note">全國性騷擾通報從 95 年（2006）的 145 件增至 113 年（2024）的 20,995 件。此處只計通報件數——全國層級的調查屬實只公布「人數」（按性別、年齡），沒有可對應的件數，因此<b>屬實率無法在全國尺度計算</b>，只能看下方有公布屬實件數的臺北市。性霸凌自 102 年（2013）才納入統計。年份為曆年，與下方臺北市的「學年度」不同。</p>
        </div>

        <div className="committee-grid">
          <div className="trend-panel">
            <div className="panel-title"><div><strong>臺北市：通報與調查屬實</strong><small>唯一有公布屬實件數的縣市，選取學年看各類明細</small></div><span>109—113 學年</span></div>
            <div className="stack-chart" aria-label="臺北市歷年校園性別事件統計圖">
              {committeeStats.map((item) => (
                <button key={item.year} className={statsYear === item.year ? "selected" : ""} onClick={() => setStatsYear(item.year)} aria-label={`${item.year} 學年，通報 ${item.reported} 件，調查屬實 ${item.founded} 件`}>
                  <span className="stack-total">{item.reported.toLocaleString()}</span>
                  <span className="stack" style={{height: `${(item.reported / statsMax) * chartHeight}px`}}>
                    <i className="reported" style={{height: `${100 - (item.founded / item.reported) * 100}%`}} />
                    <i className="founded" style={{height: `${(item.founded / item.reported) * 100}%`}} />
                  </span>
                  <b>{item.year}</b>
                  <span className="stack-founded"><i />屬實 {item.founded}</span>
                </button>
              ))}
            </div>
            <div className="committee-legend"><span><i className="reported" /> 通報件數</span><span><i className="founded" /> 調查屬實件數</span><a href="https://data.gov.tw/dataset/131208" target="_blank" rel="noreferrer">政府資料原頁 ↗</a></div>
          </div>
          <aside className="year-detail">
            <div className="year-top"><span>選取學年</span><strong>{selectedStats.year}</strong></div>
            <div className="total-case"><span>校園性別事件通報</span><strong>{selectedStats.reported.toLocaleString()}<small> 件</small></strong></div>
            <div className="type-breakdown">
              <div className="type-head"><span>事件類型</span><b>通報</b><b>屬實</b><b>屬實率</b></div>
              {selectedStats.types.map((type) => (
                <div className="type-row" key={type.label}>
                  <span>{type.label}</span>
                  <b>{type.reported}</b>
                  <b>{type.founded}</b>
                  <b>{type.reported ? `${Math.round(type.founded / type.reported * 100)}%` : "—"}</b>
                </div>
              ))}
            </div>
            <p className="type-def"><b>「屬實」＝性平會調查後認定事件成立、確有其事。</b>這是校園行政調查的認定，與刑事有沒有起訴、判不判有罪各自獨立，結論可能不同。</p>
            <p>屬實率＝屬實 ÷ 通報，分母是「全部通報」。所以剩下沒被算成屬實的那塊，並不都是「調查後認定不成立」——裡面還混著不受理、當事人撤回、以及當學年還沒調查完的案件，公開資料沒有把它們分開，也因此不能用「通報減屬實」反推不成立件數。<b>屬實率偏低，不等於多數指控不實。</b>四類的量差很多，看合計會把差異藏起來。</p>
          </aside>
        </div>
        <div className="method-strip"><strong>資料狀態</strong><span>來源：教育部統計處（全國通報）、臺北市政府主計處（屬實件數）</span><span>授權：政府資料開放授權條款第 1 版</span><a href="https://data.gov.tw/suggests/136916" target="_blank" rel="noreferrer">不成立／重審開放進度 ↗</a></div>
        <p className="demo-note official-note"><span /> 官方真實資料快照 · 原始資料更新 2026.04.30 · 平台擷取 2026.07.22</p>
        {exploreNav("committee")}
      </section>

      <section className={`insights ${siteView !== "judges" ? "site-hidden" : ""}`} id="judges">
        <button className="back-to-hub section-wide" onClick={() => openSection("explore")}>← 回資料總覽</button>
        <div className="insight-copy">
          <span className="section-kicker">JUDICIAL OBSERVATORY</span>
          <h2>司法現況與裁判觀測</h2>
          <p>如果你正在考慮提告，最先想知道的多半是：像我這樣的案件，法院歷來怎麼判、多少比例會定罪、判得多重。這一區用司法院公開的裁判書全文回答這些問題，並附上每一筆的原始連結供查證。統計呈現的是歷來的裁判樣態，不是對你的案件的預測，個案差異很大。</p>
          <p className="insight-links">
            <a href="https://judgment.judicial.gov.tw/" target="_blank" rel="noreferrer">查閱司法院原始裁判 <span>↗</span></a>
            <button className="method-inline" onClick={() => openSection("sources")}>資料來源與統計方式</button>
          </p>
        </div>
        <JudicialReport data={judicialData} view={judgeView} onTab={openJudge} />
        {exploreNav("judges")}
      </section>

      <VictimGuide siteView={siteView} victimView={victimView} onOpen={openVictim} pager={victimPager()} />

      <section className={`talent-directory ${siteView !== "victim" || victimView !== "talent" ? "victim-hidden" : ""}`} id="talent">
        <button className="back-to-hub" onClick={() => openVictim("home")}>← 回專區首頁</button>
        <div className="section-heading"><div><span className="section-kicker">NATIONAL GENDER EQUITY PANEL</span><h2>全國性平委員</h2></div><p>教育部公開名冊更新：{talentData.updatedAt || "載入中"}</p></div>
        <div className="talent-summary"><div><strong>{talentData.records.length.toLocaleString()}</strong><span>筆公開人才紀錄</span></div><p>這是具備調查專業資格的人才名冊，不代表曾參與任何特定案件，也不是對個別委員調查品質的排名。</p><a href="https://www.gender.edu.tw/web/index.php/m7/m7_05_01_files_01?sid=210" target="_blank" rel="noreferrer">教育部原始名冊 ↗</a></div>
        <div className="detail-grid talent-context">
          <article>
            <h3>這份名冊上的人實際會做什麼</h3>
            <ul>
              <li>學校受理校園性別事件後，調查小組成員可從這個人才庫遴聘</li>
              <li>你提出申復時，審議小組同樣由人才庫人員組成，通常為三人</li>
              <li>也就是說，決定你的案件怎麼被調查、以及申復有沒有理由的人，可能就在這份名單裡</li>
              <li>名冊會列出服務學校或單位與職稱，可以看出委員的專業背景是法律、社工、心理或性平行政</li>
            </ul>
          </article>
          <article>
            <h3>收到通知時可以核對什麼</h3>
            <ul>
              <li>核對書面通知上的委員姓名是否在名冊中，以及服務單位與職稱</li>
              <li>確認調查小組的人數、性別比例與專業資格是否符合規定</li>
              <li>若委員與任一方有師生、指導、任職或其他足以影響公正的關係，屬於應迴避事由</li>
              <li>組織不適法與應迴避而未迴避，都是防治準則明定的「調查程序重大瑕疵」，可以在申復時主張</li>
            </ul>
            <button className="inline-link" onClick={() => openVictim("appeal")}>查看六款重大瑕疵對照 →</button>
          </article>
        </div>
        <label className="talent-search"><span>搜尋姓名、服務單位或職稱</span><input value={talentQuery} onChange={(event) => { setTalentQuery(event.target.value); setTalentPage(1); }} placeholder="例如：社工師、臺灣大學、姓名" /></label>
        <div className="talent-table"><div className="talent-head"><span>姓名</span><span>服務學校／單位</span><span>職稱</span><span>原始頁碼</span></div>{visibleTalent.map((item, index) => <article key={`${item.page}-${item.name}-${item.unit}-${index}`}><strong>{item.name}</strong><span>{item.unit || "官方未列明"}</span><span>{item.title || "官方未列明"}</span><small>PDF 第 {item.page} 頁</small></article>)}</div>
        {filteredTalent.length === 0 ? <p className="talent-empty">找不到符合「{talentQuery}」的人才紀錄，請嘗試較短的姓名、單位或職稱。</p> : <nav className="talent-pagination" aria-label="人才庫分頁"><span>共 {filteredTalent.length.toLocaleString()} 筆 · 第 {talentPage} / {talentPageCount} 頁</span><div><button onClick={() => setTalentPage(1)} disabled={talentPage === 1}>第一頁</button><button onClick={() => setTalentPage((page) => Math.max(1, page - 1))} disabled={talentPage === 1}>上一頁</button><button onClick={() => setTalentPage((page) => Math.min(talentPageCount, page + 1))} disabled={talentPage === talentPageCount}>下一頁</button><button onClick={() => setTalentPage(talentPageCount)} disabled={talentPage === talentPageCount}>最後一頁</button></div></nav>}
        <p className="talent-note">每頁顯示 24 筆，可在站內瀏覽全部結果；未轉錄電話、電子郵件與證號。</p>
        {victimPager()}
      </section>

      <section className={`news ${siteView !== "news" ? "site-hidden" : ""}`} id="news">
        <button className="back-to-hub" onClick={() => openSection("explore")}>← 回資料總覽</button>
        <div className="section-heading"><div><span className="section-kicker">LIVE NEWS INDEX</span><h2>公視性平新聞索引</h2></div><p>{newsUpdated ? `最近索引：${newsUpdated}` : "只顯示標題、短摘要與公視原始連結"}</p></div>
        <form className="news-search" onSubmit={(event) => { event.preventDefault(); setNewsPage(1); }}>
          <div><span>關鍵字</span><input value={newsQuery} onChange={(event) => { setNewsQuery(event.target.value); setNewsPage(1); }} placeholder="例如：性平、權勢性騷、校園性侵害" aria-label="新聞關鍵字" /></div>
          <button type="submit" disabled={newsLoading}>{newsLoading ? "載入索引中…" : "搜尋"}</button>
          <button type="button" className="reset-news" onClick={() => { setNewsQuery(""); setNewsPage(1); }}>顯示全部</button>
        </form>
        <div className="keyword-row"><span>常用關鍵字</span>{["性平", "性騷擾", "性侵害", "性霸凌", "不適任教師", "權勢性騷"].map((word) => <button key={word} onClick={() => { setNewsQuery(word); setNewsPage(1); }}>{word}</button>)}</div>
        <div className="news-result-meta"><strong>{newsLoading ? "正在載入索引…" : `${newsQuery ? "找到" : "索引共"} ${newsItems.length} 筆`}</strong><span>索引每晚更新，搜尋在你的瀏覽器內完成，不會送出關鍵字</span></div>
        <div className="live-news-grid">
          {visibleNews.map((item) => <a className="live-news-card" href={item.url} target="_blank" rel="noreferrer" key={item.url}><div><b>{item.category || "公視新聞"}</b>{item.publishedAt ? <time>{item.publishedAt.slice(0, 10).replaceAll("-", ".")}</time> : <time title="公視搬遷網站時未保留原始發布日期">日期不詳</time>}</div><h3>{item.title}</h3><p>{item.summary}</p><span>前往公視閱讀原文 ↗</span></a>)}
          {!newsLoading && newsItems.length === 0 && <div className="news-empty">目前索引中沒有符合此關鍵字的公視新聞，請嘗試較短或相關的詞。</div>}
        </div>
        {newsItems.length > newsPageSize && <nav className="news-pagination" aria-label="新聞搜尋結果分頁"><span>第 {newsPage} / {newsPageCount} 頁</span><div><button onClick={() => setNewsPage((page) => Math.max(1, page - 1))} disabled={newsPage === 1}>← 上一頁</button><button onClick={() => setNewsPage((page) => Math.min(newsPageCount, page + 1))} disabled={newsPage === newsPageCount}>下一頁 →</button></div></nav>}
        <p className="news-license">索引每晚更新，以 12 個監測詞查詢公視新聞搜尋並往回收錄歷史報導；只保存必要的標題、短摘要與原始連結。部分早期報導在公視搬遷網站時未保留原始發布日期，站上標為「日期不詳」，不以搬遷時間充當發布日。新聞文字、圖片與影音著作權均屬公視或原權利人。</p>
        {exploreNav("news")}
      </section>

      <section className={`coach-watch ${siteView !== "coaches" ? "site-hidden" : ""}`} id="coaches">
        <button className="back-to-hub" onClick={() => openSection("explore")}>← 回資料總覽</button>
        <div className="section-heading"><div><span className="section-kicker">SPORT SAFEGUARD</span><h2>運動部不適任教練專區</h2></div><p>官方公開資料 · 直接連結裁判書</p></div>
        <div className="coach-grid"><div><strong>運動部<small> 官方名單</small></strong><span>件數以官方頁面為準</span></div><div className="coach-copy"><h3>涉及違法事件不適任教練資訊</h3><p>運動部公開持有特定體育團體教練證，涉及性平、傷害、殺人及家庭暴力事件的刑事訴訟裁判書。本站不轉存這份名單，僅提供入口；實際件數與是否判決確定，以運動部頁面及司法院裁判書系統為準。</p><a href="https://www.sports.gov.tw/News/6295" target="_blank" rel="noreferrer">前往運動部官方專區 →</a></div><aside><b>範圍提醒</b><p>此專區不等於「所有曾有性平事件的不適任教師」；未進入刑事裁判或不具特定教練證者，可能不在其中。</p><small>運動部官方頁面目前有防自動存取機制，本站先採官方入口連結，不繞過保護措施。</small></aside></div>
        {exploreNav("coaches")}
      </section>

      <PolicyPages siteView={siteView} onHome={() => openSection("home")} />

      <footer>
        <div className="brand footer-brand"><span className="brand-mark">平</span><span><strong>明鏡性平</strong><small>公共資訊，促進制度問責</small></span></div>
        <p>本平台不是司法或申訴機關。緊急危險請撥 110；保護專線 113。</p>
        <div>
          <button className="footer-link" onClick={() => openSection("faq")}>常見問題</button>
          <button className="footer-link" onClick={() => openSection("privacy")}>隱私政策</button>
          <button className="footer-link" onClick={() => openSection("corrections")}>資料更正與下架</button>
          <button className="footer-link" onClick={() => openSection("licence")}>資料授權</button>
        </div>
      </footer>

      {methodOpen && <MethodDialog onClose={closeMethod} onOpenCorrections={() => { closeMethod(); openSection("corrections"); }} />}
    </main>
  );
}
