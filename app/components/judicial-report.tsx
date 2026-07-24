"use client";

import { useMemo, useState } from "react";
import {
  JUDGE_MIN_SAMPLE, fraction, judgeAcquittalRate, judgmentUrl, monthLabel, monthsLabel, percent, spanLabel,
  type CaseBrief, type ChargeProfile, type JudicialData, type JudgeDetail, type JudgeSummary, type OutcomeProfile,
} from "../data";
import { JUDGE_TABS, type JudgeView } from "../routes";

/** 一筆案件：案由為說明，可點的是案號——與「以案號查閱」的敘述一致，也看得出可點。 */
function CaseItem({ item }: { item: CaseBrief }) {
  return (
    <li>
      <span className="case-title">{item.title}{item.summary ? "・簡易" : ""}</span>
      <a className="case-link" href={judgmentUrl(item.jid)} target="_blank" rel="noreferrer">
        {item.caseNumber || "查裁判書"} <span aria-hidden="true">↗</span>
      </a>
    </li>
  );
}

const LEVEL_LABELS: Record<string, string> = { first: "第一審", second: "第二審", third: "第三審" };
// 一、二審是事實審，會認定事實與有罪無罪；三審是法律審，原則上只處理法律見解
const LEVEL_KINDS: Record<string, string> = { first: "事實審", second: "事實審", third: "法律審" };

const JUDGE_PAGE_SIZE = 20;

/** 法官清單的排序方式。件數相同時一律以姓名排序，順序才穩定。 */
const JUDGE_SORTS: { key: string; label: string; compare: (a: JudgeSummary, b: JudgeSummary) => number }[] = [
  { key: "caseload", label: "承審最多", compare: (a, b) => b.contested - a.contested },
  { key: "acquittalRate", label: "無罪率高", compare: (a, b) => (judgeAcquittalRate(b) ?? -1) - (judgeAcquittalRate(a) ?? -1) },
  { key: "acquitted", label: "無罪件數最多", compare: (a, b) => b.acquitted - a.acquitted },
  { key: "convicted", label: "定罪件數最多", compare: (a, b) => b.convicted - a.convicted },
];

/** 結果標籤的呈現順序。實體結果在前，程序性結果在後。 */
const OUTCOME_ORDER = [
  "guilty", "partial", "acquitted", "upheld", "reversed",
  "dismissed", "exempted", "transferred", "unclear",
];

function OutcomeBar({ profile, labels }: { profile: OutcomeProfile; labels: Record<string, string> }) {
  // 由多到少排序：最常見的結果排在最前，一眼看得出「多數案件是什麼情況」
  const entries = OUTCOME_ORDER
    .map((key) => [key, profile.outcomes[key] ?? 0] as const)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;

  return (
    <div className="outcome-bar">
      <div className="outcome-track" role="img"
        aria-label={entries.map(([key, count]) => `${labels[key] ?? key} ${count} 件`).join("，")}>
        {entries.map(([key, count]) => (
          <span key={key} className={`outcome-slice outcome-${key}`}
            style={{ flexGrow: count }} title={`${labels[key] ?? key} ${count} 件`} />
        ))}
      </div>
      <ul className="outcome-legend">
        {entries.map(([key, count]) => (
          <li key={key}>
            <i className={`outcome-${key}`} aria-hidden="true" />
            {labels[key] ?? key}
            <b>{count.toLocaleString()}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function JudicialReport({ data, view, onTab }: {
  data: JudicialData; view: JudgeView; onTab: (view: JudgeView) => void;
}) {
  const [details, setDetails] = useState<JudgeDetail[] | null>(null);
  const [judgeQuery, setJudgeQuery] = useState("");
  // 預設就以「樣本足夠、按無罪率高到低」呈現——這是這一區最想回答的問題，
  // 且只看達門檻的法官，避免一進來就是雜訊。使用者仍可自由改排序或取消勾選。
  const [judgeSort, setJudgeSort] = useState("acquittalRate");
  const [judgePage, setJudgePage] = useState(1);
  const [enoughOnly, setEnoughOnly] = useState(true);
  const [offenceKey, setOffenceKey] = useState<string>("");

  const charges = useMemo(
    () => Object.entries(data.byCharge).sort(([, a], [, b]) => b.total - a.total),
    [data.byCharge],
  );

  const sentences = useMemo(
    () => Object.values(data.bySentence).sort((a, b) => b.convicted - a.convicted),
    [data.bySentence],
  );

  // 用實際數字講一次分母，比任何抽象說明都清楚。挑不受理佔比最高的罪名，
  // 因為那正是「定罪率接近百分之百，怎麼還有這麼多不受理」最容易被誤讀的地方。
  const example = useMemo(() => {
    const candidates = Object.values(data.byCharge).filter((item) => item.total >= 50);
    return candidates.sort((a, b) =>
      (b.closedBeforeMerits.rate ?? 0) - (a.closedBeforeMerits.rate ?? 0))[0] ?? null;
  }, [data.byCharge]);

  const sortedJudges = useMemo(() => {
    const query = judgeQuery.trim();
    let list = query ? data.judges.filter((judge) => judge.name.includes(query)) : [...data.judges];
    // 勾選框獨立控制。依無罪率排序時，樣本不足者的比率為 null，本來就會排到最後
    // 並標「樣本不足」，不需強制濾掉——想隱藏雜訊再自行勾選即可。
    if (enoughOnly) {
      list = list.filter((judge) => judge.contested >= JUDGE_MIN_SAMPLE);
    }
    const sort = JUDGE_SORTS.find((item) => item.key === judgeSort) ?? JUDGE_SORTS[0];
    return list.sort((a, b) => sort.compare(a, b) || a.name.localeCompare(b.name, "zh-Hant"));
  }, [data.judges, judgeQuery, judgeSort, enoughOnly]);

  const judgePageCount = Math.max(1, Math.ceil(sortedJudges.length / JUDGE_PAGE_SIZE));
  // 換排序或搜尋後，落在超出範圍的頁碼要拉回來，否則會顯示空白頁
  const page = Math.min(judgePage, judgePageCount);
  const pageJudges = sortedJudges.slice((page - 1) * JUDGE_PAGE_SIZE, page * JUDGE_PAGE_SIZE);

  const detailFor = (name: string) => details?.find((judge) => judge.name === name);

  // 案件明細有數萬筆，只有真的展開法官清單時才載入，不拖慢其他頁
  async function loadDetails() {
    if (details) return;
    try {
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const response = await fetch(`${base}/data/judicial-judges.json`);
      if (!response.ok) return;
      const payload = await response.json() as { judges?: JudgeDetail[] };
      setDetails(payload.judges ?? []);
    } catch {
      // 取不到時仍會顯示件數，只是展不開案件清單
    }
  }

  if (!data.overall || data.coverage.judgments === 0) {
    return (
      <p className="sync-window">
        <b>尚未取得裁判資料</b>
        本區的資料來自司法院裁判書開放資料的每月全文月包，需要先在本機完成一次歷史匯入才會有內容。
        每晚的裁判書 API 只提供單日異動清單，無法回溯歷史。
      </p>
    );
  }

  const selected: ChargeProfile | null = offenceKey ? data.byCharge[offenceKey] ?? null : null;
  const shown: OutcomeProfile = selected ?? data.overall;

  return (
    <div className="judicial-report">
      <div className="judicial-coverage">
        <div>
          <strong>{data.coverage.judgments.toLocaleString()}</strong>
          <span>性平相關刑事判決</span>
          <small>{data.months.length > 0
            ? `涵蓋 ${monthLabel(data.months[0])} 至 ${monthLabel(data.months.at(-1) ?? "")}，共 ${spanLabel(data.months.length)}`
            : "涵蓋範圍待補"}</small>
        </div>
        <div>
          <strong>{percent(data.overall.conviction.rate)}</strong>
          <span>第一審定罪率</span>
          <small>{fraction(data.overall.conviction)}<br />分母是進入實體審理的件數</small>
        </div>
        <div>
          <strong>{percent(data.overall.probation.rate)}</strong>
          <span>定罪者獲緩刑</span>
          <small>{fraction(data.overall.probation)}<br />緩刑代表不必入監執行</small>
        </div>
        <div>
          <strong>{data.overall.prisonMonths ? monthsLabel(data.overall.prisonMonths.median) : "—"}</strong>
          <span>宣告刑中位數</span>
          <small>{data.overall.prisonMonths
            ? `${data.overall.prisonMonths.count.toLocaleString()} 件判自由刑，半數落在 ${monthsLabel(data.overall.prisonMonths.p25)} 至 ${monthsLabel(data.overall.prisonMonths.p75)}`
            : "尚無足夠樣本"}</small>
        </div>
      </div>

      <div className="judge-nav">
        <div className="judge-nav-head">
          <span className="section-kicker">分四區細看</span>
          <h3>想深入哪一部分？點一區展開</h3>
        </div>
        <nav className="judge-tabs" aria-label="司法現況四個分區">
          {JUDGE_TABS.map((tab) => (
            <button key={tab.view} className={view === tab.view ? "active" : ""}
              aria-pressed={view === tab.view} onClick={() => onTab(tab.view)}>
              <span className="judge-tab-text">
                <strong>{tab.label}</strong>
                <small>{tab.hint}</small>
              </span>
              <span className="judge-tab-go" aria-hidden="true">→</span>
            </button>
          ))}
        </nav>
        {view === "home" && (
          <p className="judge-tabs-hint">以上四區各回答一個問題，點任一區展開查看；進入後每一區底部也可以直接跳到其他三區。</p>
        )}
      </div>

      {view === "results" && <>
      <div className="judicial-block" id="judge-results">
        <div className="chart-top">
          <span>你的情況歷來怎麼判</span>
          <small>點選罪名可切換下方的結果分布</small>
        </div>
        <div className="offence-filter">
          <button className={offenceKey === "" ? "active" : ""} onClick={() => setOffenceKey("")}>全部案件</button>
          {charges.map(([key, profile]) => (
            <button key={key} className={offenceKey === key ? "active" : ""} onClick={() => setOffenceKey(key)}>
              {profile.label}<b>{profile.total}</b>
            </button>
          ))}
        </div>

        <OutcomeBar profile={shown} labels={data.labels.outcome} />

        {example && (
          <div className="denominator-note">
            <h4>三個百分比的分母不一樣，不能相加</h4>
            <p>
              以{example.label}為例。第一審共 <b>{example.total.toLocaleString()}</b> 件，
              其中 <b>{example.counts.closedBeforeMerits.toLocaleString()}</b> 件因不受理或免訴而在法院認定事實之前就結束，
              剩下 <b>{example.counts.substantive.toLocaleString()}</b> 件法院做出了實體認定，
              這 {example.counts.substantive.toLocaleString()} 件裡有 <b>{example.counts.convicted.toLocaleString()}</b> 件定罪。
            </p>
            <p>
              所以「定罪率 {percent(example.conviction.rate)}」講的是
              {example.counts.convicted.toLocaleString()} ÷ {example.counts.substantive.toLocaleString()}，
              分母是進入實體審理的件數；
              「未進入實體審理 {percent(example.closedBeforeMerits.rate)}」講的是
              {example.counts.closedBeforeMerits.toLocaleString()} ÷ {example.total.toLocaleString()}，
              分母是全部件數；
              「緩刑 {percent(example.probation.rate)}」講的是
              {example.counts.probation.toLocaleString()} ÷ {example.counts.convicted.toLocaleString()}，
              分母是定罪件數。三個分母不同，加起來沒有意義。
            </p>
          </div>
        )}

        <p className="table-note">
          依案由分組的第一審結果。件數欄可以直接對照相加，比率欄的分子與分母
          寫在各罪名的欄位提示裡。
        </p>
        <div className="table-scroll">
          <table className="offence-table">
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>案由</th>
                <th scope="col" colSpan={4} className="group-head">件數</th>
                <th scope="col" colSpan={2} className="group-head">比率</th>
              </tr>
              <tr>
                <th scope="col">全部</th>
                <th scope="col">不受理<br /><small>與免訴</small></th>
                <th scope="col">進入<br /><small>實體審理</small></th>
                <th scope="col">其中<br /><small>定罪</small></th>
                <th scope="col">定罪率<br /><small>÷ 實體審理</small></th>
                <th scope="col">無罪率<br /><small>÷ 實體審理</small></th>
              </tr>
            </thead>
            <tbody>
              {charges.map(([key, profile]) => (
                <tr key={key} className={offenceKey === key ? "row-active" : ""}>
                  <th scope="row">
                    {profile.label}
                    {profile.note && <small>{profile.note}</small>}
                  </th>
                  <td data-label="全部">{profile.total.toLocaleString()}</td>
                  <td data-label="不受理與免訴">{profile.counts.closedBeforeMerits.toLocaleString()}</td>
                  <td data-label="進入實體審理">{profile.counts.substantive.toLocaleString()}</td>
                  <td data-label="其中定罪">{profile.counts.convicted.toLocaleString()}</td>
                  <td data-label="定罪率（÷實體審理）" title={`${fraction(profile.conviction)}（分母為進入實體審理的件數）`}>
                    {percent(profile.conviction.rate)}
                  </td>
                  <td data-label="無罪率（÷實體審理）" title={`${fraction(profile.acquittal)}（分母為進入實體審理的件數）`}>
                    {percent(profile.acquittal.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="judicial-note">
          不受理絕大多數是告訴乃論之罪撤回告訴，性騷擾與跟蹤騷擾尤其常見。
          <b>它不代表事情沒有發生，也不代表法院認為指控不實</b>，只是案件在進入實體認定之前就結束了，所以不能放進定罪率的分母。
        </p>
        <p className="judicial-note">
          無罪也一樣要小心解讀。刑事定罪要求超越合理懷疑的確信，且每項證據都須合法、符合法定要式；
          性相關案件多發生在只有兩人的場合，最常卡在證據。因此「無罪」很多時候是證據不足以跨過這道門檻，
          <b>不等於事情沒有發生，也不等於被害人說謊</b>。
        </p>
      </div>
      </>}

      {view === "sentencing" && (
      <div className="judicial-block" id="judge-sentencing">
        <div className="chart-top"><span>判了多重</span><small>僅定罪案件，依主文論罪分組</small></div>
        <p className="judicial-note">
          這張表用的分組跟上一張不同。上面依案由分組，因為案由在起訴時就決定，
          不受判決結果影響；這裡改依主文實際論的罪分組，分得比較細，但只有定罪的判決
          才會在主文寫出罪名，所以它<b>只能用來看刑度，不能用來算定罪率</b>。
          刑期以中位數與四分位距呈現，少數重刑會把平均值整個拉走。
        </p>
        <p className="table-note">
          各罪名定罪案件的宣告刑。判罰金或拘役者不計入刑期中位數，另列件數。
        </p>
        <div className="table-scroll">
          <table className="offence-table">
            <thead>
              <tr>
                <th scope="col">論罪</th>
                <th scope="col">定罪<br /><small>件數</small></th>
                <th scope="col">宣告刑<br /><small>中位數</small></th>
                <th scope="col">半數落在<br /><small>四分位距</small></th>
                <th scope="col">緩刑<br /><small>÷ 定罪</small></th>
                <th scope="col">判罰金<br /><small>件數</small></th>
                <th scope="col">判拘役<br /><small>件數</small></th>
              </tr>
            </thead>
            <tbody>
              {sentences.map((item) => (
                <tr key={item.label}>
                  <th scope="row">{item.label}</th>
                  <td data-label="定罪件數">{item.convicted.toLocaleString()}</td>
                  <td data-label="宣告刑中位數" title={item.prisonMonths ? `${item.prisonMonths.count} 件判自由刑` : "無自由刑樣本"}>
                    {item.prisonMonths ? monthsLabel(item.prisonMonths.median) : "—"}
                  </td>
                  <td data-label="半數落在">{item.prisonMonths
                    ? `${monthsLabel(item.prisonMonths.p25)} – ${monthsLabel(item.prisonMonths.p75)}`
                    : "—"}</td>
                  <td data-label="緩刑（÷定罪）" title={`${fraction(item.probation)}（分母為定罪件數）`}>
                    {percent(item.probation.rate)}
                  </td>
                  <td data-label="判罰金件數">{item.fine.toLocaleString()}</td>
                  <td data-label="判拘役件數">{item.detention.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {view === "levels" && (
      <div className="judicial-block" id="judge-levels">
        <div className="chart-top"><span>上訴之後會怎樣</span><small>第一、二、三審分開統計，每一審內按最常見的結果排在前</small></div>
        <div className="level-grid">
          {["first", "second", "third"].map((level) => {
            const profile = data.byLevel[level];
            if (!profile || profile.total === 0) return null;
            const upheld = profile.outcomes.upheld ?? 0;
            const reversed = profile.outcomes.reversed ?? 0;
            return (
              <article key={level}>
                <h4>{LEVEL_LABELS[level]}<small className="level-kind">{LEVEL_KINDS[level]}</small></h4>
                <p className="level-count">{profile.total.toLocaleString()} 件</p>
                {level === "first"
                  ? <p>進入實體審理 {profile.counts.substantive.toLocaleString()} 件，其中定罪 {profile.counts.convicted.toLocaleString()} 件（{percent(profile.conviction.rate)}）</p>
                  : <p>維持原判 {upheld.toLocaleString()} 件，原判決撤銷或發回 {reversed.toLocaleString()} 件</p>}
                <OutcomeBar profile={profile} labels={data.labels.outcome} />
              </article>
            );
          })}
        </div>
        <p className="judicial-note">
          第一審與第二審都是事實審，會認定有罪無罪；第三審是法律審，原則上只處理法律見解。
          上訴審主文若載明改判有罪或無罪，本站都會分類。無法判斷的是兩種：「上訴駁回」可能是
          實體上維持原判，也可能是上訴不合程式（如未繳費、未提上訴理由）而被程序駁回；
          「原判決撤銷、發回更審」則是退回重審。<b>這兩類本站不臆測結果</b>，個案完整經過以裁判書原文為準。
        </p>
      </div>
      )}

      {view === "panel" && (
      <div className="judicial-block" id="judge-panel">
        <div className="chart-top">
          <span>各法官的判決結果</span>
          <small>{data.judges.length.toLocaleString()} 位具名法官</small>
        </div>
        <p className="judicial-note">
          一位法官的定罪率高低，大半由「他分到哪種案子」決定，不是他嚴不嚴。簡易程序的案件
          （事證明確或被告認罪）幾乎必然定罪，把它算進去只會虛高；有罪無罪真正有裁量的是
          <b>通常程序、第一審</b>的案件。因此下面每位法官的無罪率只計這個子集，並附上樣本數與
          案件組成。樣本少於 {JUDGE_MIN_SAMPLE} 件不顯示比率——三五件的無罪率只是雜訊。
          這是承審紀錄的整理，不是對法官的評分。展開後每一筆都附案號，可自行到司法院裁判書系統以案號查閱原文（下方也附有直接連結）。
        </p>
        <div className="judge-controls">
          <div className="judge-search">
            <input value={judgeQuery}
              onChange={(event) => { setJudgeQuery(event.target.value); setJudgePage(1); }}
              placeholder="輸入法官姓名" aria-label="搜尋法官姓名" />
          </div>
          <div className="judge-sort" role="group" aria-label="法官排序">
            <span>排序</span>
            {JUDGE_SORTS.map((item) => (
              <button key={item.key}
                className={judgeSort === item.key ? "active" : ""}
                aria-pressed={judgeSort === item.key}
                onClick={() => { setJudgeSort(item.key); setJudgePage(1); }}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <label className="judge-filter">
          <input type="checkbox" checked={enoughOnly}
            onChange={(event) => { setEnoughOnly(event.target.checked); setJudgePage(1); }} />
          只看通常程序實體案件達 {JUDGE_MIN_SAMPLE} 件以上的法官
        </label>
        <p className="judge-count-line">
          {judgeQuery
            ? `找到 ${sortedJudges.length.toLocaleString()} 位符合「${judgeQuery}」`
            : `共 ${sortedJudges.length.toLocaleString()} 位，每頁 ${JUDGE_PAGE_SIZE} 位`}
          <span className="judge-hint">　點任一位法官可展開，看承審案件與案號。</span>
        </p>
        <div className="judge-list">
          {pageJudges.map((judge) => {
            const detail = detailFor(judge.name);
            const acqRate = judgeAcquittalRate(judge);
            return (
              <details className="judge-row" key={judge.name} onToggle={loadDetails}>
                <summary>
                  <strong>{judge.name}</strong>
                  <span className="judge-counts">
                    <b className="contested">通常實體 {judge.contested}</b>
                    <b className="guilty">定罪 {judge.convicted}</b>
                    <b className="acquitted">無罪 {judge.acquitted}</b>
                    {acqRate !== null
                      ? <b className="rate">無罪率 {percent(acqRate)}</b>
                      : <b className="rate muted">樣本不足</b>}
                  </span>
                  <span className="judge-toggle">
                    <span className="open-label">看案件</span>
                    <span className="close-label">收合</span>
                  </span>
                </summary>
                <div className="judge-cases">
                  <p className="judge-note judge-context">
                    另有簡易程序 {judge.summary} 件、上訴審 {judge.appellate} 件，未計入上方無罪率。
                    {detail && detail.charges.length > 0 && <>
                      {" "}通常程序的案件組成：
                      {detail.charges.map((c) => `${data.labels.charge[c.key] ?? c.key} ${c.total}（無罪 ${c.acquitted}）`).join("、")}。
                    </>}
                  </p>
                  {!detail && <p className="judge-note">正在載入案件清單…</p>}
                  {detail && detail.acquittedCases.length > 0 && (
                    <div>
                      <h4>判決無罪（全部 {detail.acquittedCases.length} 筆）</h4>
                      <ul>
                        {detail.acquittedCases.map((item) => <CaseItem key={item.jid} item={item} />)}
                      </ul>
                    </div>
                  )}
                  {detail && detail.guiltyCases.length > 0 && (
                    <div>
                      <h4>判決有罪或部分有罪{detail.guiltyTotal > detail.guiltyCases.length ? `（共 ${detail.guiltyTotal} 筆，列出最近 ${detail.guiltyCases.length} 筆）` : ""}</h4>
                      <ul>
                        {detail.guiltyCases.map((item) => <CaseItem key={item.jid} item={item} />)}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
          {pageJudges.length === 0 && <p className="observer-empty">找不到符合「{judgeQuery}」的法官。</p>}
        </div>
        {judgePageCount > 1 && (
          <nav className="judge-pagination" aria-label="法官清單分頁">
            <button onClick={() => setJudgePage(1)} disabled={page === 1}>第一頁</button>
            <button onClick={() => setJudgePage(page - 1)} disabled={page === 1}>← 上一頁</button>
            <span>第 {page} / {judgePageCount} 頁</span>
            <button onClick={() => setJudgePage(page + 1)} disabled={page === judgePageCount}>下一頁 →</button>
            <button onClick={() => setJudgePage(judgePageCount)} disabled={page === judgePageCount}>最後一頁</button>
          </nav>
        )}
      </div>
      )}

      {view !== "home" && (
        <nav className="judge-pager" aria-label="切換到其他分區">
          <span>看其他分區</span>
          <div>
            {JUDGE_TABS.filter((tab) => tab.view !== view).map((tab) => (
              <button key={tab.view} onClick={() => onTab(tab.view)}>{tab.label} →</button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
