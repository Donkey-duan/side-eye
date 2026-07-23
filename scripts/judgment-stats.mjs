/**
 * 由判決紀錄彙整統計。
 *
 * 這裡回答的是受害者最先會問的問題：像我這樣的案件，法院歷來怎麼判、
 * 定罪的比例多少、判多重、多少人拿到緩刑、上訴之後會不會被翻掉。
 *
 * 分母的取法會直接改變數字的意義，因此一律寫死在這裡並在站上標明：
 * 定罪率只計第一審且進入實體審理的案件，上訴審會重複計入同一件事實，
 * 不受理與免訴則沒有經過實體認定，兩者都不能放進分母。
 */

import {
  CHARGE_LABELS, CHARGE_NOTES, OFFENCE_LABELS, OUTCOME_LABELS, classify,
} from "./judgment-rules.mjs";

const CONVICTED = new Set(["guilty", "partial"]);
/** 進入實體審理、法院對事實作出認定的結果。 */
const SUBSTANTIVE = new Set(["guilty", "partial", "acquitted"]);

function tally(items, key) {
  const counts = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

function ratio(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 1000 : null;
}

/** 刑期分布用中位數與四分位數呈現。平均值會被極少數重刑拉走。 */
function quantiles(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { count: sorted.length, min: sorted[0], p25: at(0.25), median: at(0.5), p75: at(0.75), max: sorted.at(-1) };
}

/**
 * 一組案件的結果分布與各項比率。傳入的應該已經限定審級。
 *
 * 每個比率的分母都不一樣：定罪率的分母是進入實體審理的件數，緩刑率的分母是
 * 定罪件數，未進入實體審理的比例則是佔全部件數。三者並排時極容易被誤讀成
 * 同一個分母（「定罪率 99% 為什麼還有 17% 不受理」），因此每個比率都連同
 * 分子與分母一起輸出，畫面上直接把絕對數字放在旁邊，讀者可以自己驗算。
 */
function rate(part, whole) {
  return { part, whole, rate: ratio(part, whole) };
}

function profile(items) {
  const outcomes = tally(items, (item) => item.outcome);
  const substantive = items.filter((item) => SUBSTANTIVE.has(item.outcome));
  const convicted = items.filter((item) => CONVICTED.has(item.outcome));
  const acquitted = items.filter((item) => item.outcome === "acquitted");
  const probation = convicted.filter((item) => item.probation);
  const prison = convicted
    .filter((item) => item.sentence?.kind === "prison")
    .map((item) => item.sentence.months);
  // 不受理與免訴都是案件在實體認定之前就結束，對讀者是同一件事
  const closed = (outcomes.dismissed ?? 0) + (outcomes.exempted ?? 0);

  return {
    total: items.length,
    outcomes,
    counts: {
      substantive: substantive.length,
      convicted: convicted.length,
      acquitted: acquitted.length,
      partial: outcomes.partial ?? 0,
      dismissed: outcomes.dismissed ?? 0,
      exempted: outcomes.exempted ?? 0,
      closedBeforeMerits: closed,
      probation: probation.length,
    },
    // 每個比率都帶著自己的分子與分母
    conviction: rate(convicted.length, substantive.length),
    acquittal: rate(acquitted.length, substantive.length),
    closedBeforeMerits: rate(closed, items.length),
    probation: rate(probation.length, convicted.length),
    prisonMonths: quantiles(prison),
    lifeOrDeath: convicted.filter((item) => item.sentence?.kind === "death" || item.sentence?.kind === "life").length,
  };
}

/** 字別含「簡」為簡易程序。簡易程序多用於事證明確或被告認罪的案件，幾乎必然定罪，
 *  因此其定罪率不能拿來判讀法官的傾向。有罪無罪真正有爭執的是通常訴訟程序。 */
function isSummaryProc(caseType) {
  return /簡/.test(caseType ?? "");
}

/**
 * 各法官的承審紀錄。
 *
 * 關鍵在把案件組成拆開：一位法官的定罪率高低，大半由「他分到哪種案子」決定，
 * 而非他嚴不嚴。因此只在「通常程序、第一審、進入實體審理」的案件上計無罪率——
 * 那才是有罪無罪由法官裁量的部分——並附上樣本數與各案由組成，讓讀者看得見脈絡。
 * 簡易程序與上訴審另計，不混入。公開指名，每一筆都可連回原文查證。
 */
function byJudge(items) {
  const map = new Map();
  for (const item of items) {
    for (const name of item.judges ?? []) {
      const e = map.get(name) ?? {
        name, summary: 0, appellate: 0,
        contested: 0, convicted: 0, acquitted: 0, contestedOther: 0,
        charges: new Map(), guiltyCases: [], acquittedCases: [], latestDate: "",
      };

      const convicted = item.outcome === "guilty" || item.outcome === "partial";
      const acquitted = item.outcome === "acquitted";

      if (item.level !== "first") {
        e.appellate++;
      } else if (isSummaryProc(item.caseType)) {
        e.summary++;
      } else if (convicted || acquitted) {
        // 通常程序、第一審、進入實體審理——唯一可用於判讀的子集
        e.contested++;
        if (convicted) e.convicted++;
        else e.acquitted++;
        const c = e.charges.get(item.charge) ?? { total: 0, acquitted: 0 };
        c.total++;
        if (acquitted) c.acquitted++;
        e.charges.set(item.charge, c);
      } else {
        e.contestedOther++;
      }

      // 明細供查證；標記簡易程序，讓人看得出這筆的定罪是不是「幾乎必然」的那種
      const brief = {
        jid: item.jid, title: item.title, caseNumber: item.caseNumber,
        decisionDate: item.decisionDate, summary: isSummaryProc(item.caseType),
      };
      if (convicted) e.guiltyCases.push(brief);
      else if (acquitted) e.acquittedCases.push(brief);
      if (String(item.decisionDate) > e.latestDate) e.latestDate = item.decisionDate;
      map.set(name, e);
    }
  }

  return [...map.values()].map((e) => ({
    name: e.name,
    summary: e.summary,
    appellate: e.appellate,
    contested: e.contested,
    convicted: e.convicted,
    acquitted: e.acquitted,
    contestedOther: e.contestedOther,
    // 各案由組成：讓「無罪率高」能對照到「他審的是哪種案子」
    charges: [...e.charges.entries()]
      .map(([key, v]) => ({ key, total: v.total, acquitted: v.acquitted }))
      .sort((a, b) => b.total - a.total),
    // 無罪案件少、又是最會被檢視的，全部保留；有罪案件多、爭議小，只留最近 12 筆
    // （items 已按日期新到舊排序），另記總數，避免明細檔在手機上過重。
    guiltyTotal: e.guiltyCases.length,
    guiltyCases: e.guiltyCases.slice(0, 12),
    acquittedCases: e.acquittedCases,
    latestDate: e.latestDate,
  })).sort((a, b) => b.contested - a.contested || a.name.localeCompare(b.name, "zh-Hant"));
}

export function summarise(records) {
  const items = records.map((record) => (record.outcome ? record : classify(record)))
    .sort((a, b) => String(b.decisionDate).localeCompare(String(a.decisionDate)));

  const first = items.filter((item) => item.level === "first");
  const dates = items.map((item) => String(item.decisionDate)).filter(Boolean).sort();

  // 結果比較一律依案由分組：案由在起訴時就決定，不受判決結果影響
  const charges = {};
  for (const [key, label] of Object.entries(CHARGE_LABELS)) {
    const group = first.filter((item) => item.charge === key);
    if (group.length) charges[key] = { label, note: CHARGE_NOTES[key] ?? "", ...profile(group) };
  }

  // 量刑依主文論罪分組，且只取定罪的案件。無罪判決的主文不寫罪名，
  // 拿它來比較結果會偏誤，但在定罪案件內部比較刑度沒有這個問題。
  const convicted = first.filter((item) => CONVICTED.has(item.outcome));
  const sentencing = {};
  for (const [key, label] of Object.entries(OFFENCE_LABELS)) {
    const group = convicted.filter((item) => item.offence === key);
    if (!group.length) continue;
    const months = group.filter((item) => item.sentence?.kind === "prison").map((item) => item.sentence.months);
    sentencing[key] = {
      label,
      convicted: group.length,
      prisonMonths: quantiles(months),
      probation: rate(group.filter((item) => item.probation).length, group.length),
      fine: group.filter((item) => item.sentence?.kind === "fine").length,
      detention: group.filter((item) => item.sentence?.kind === "detention").length,
      lifeOrDeath: group.filter((item) => ["life", "death"].includes(item.sentence?.kind)).length,
    };
  }

  const years = {};
  for (const item of first) {
    const year = String(item.decisionDate).slice(0, 4);
    if (year) (years[year] ??= []).push(item);
  }

  return {
    // 已分類的逐筆紀錄。發布時會拿掉主文，但分類結果隨紀錄一起帶走，
    // 每晚的增量同步讀回來就不必重新判讀。
    judgments: items,
    coverage: { from: dates[0] ?? "", to: dates.at(-1) ?? "", judgments: items.length },
    labels: { outcome: OUTCOME_LABELS, offence: OFFENCE_LABELS, charge: CHARGE_LABELS },
    totals: {
      judgments: items.length,
      byOutcome: tally(items, (item) => item.outcome),
      byLevel: tally(items, (item) => item.level),
    },
    // 定罪率等指標一律以第一審為準，避免同一件事實在上訴審重複計入
    overall: profile(first),
    byCharge: charges,
    bySentence: sentencing,
    byLevel: Object.fromEntries(["first", "second", "third"].map((level) =>
      [level, profile(items.filter((item) => item.level === level))])),
    byYear: Object.fromEntries(Object.entries(years)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, group]) => [year, profile(group)])),
    judges: byJudge(items),
  };
}
