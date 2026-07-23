/**
 * 裁判書的篩選、解析與判決結果判別規則。
 *
 * 兩個來源共用這一份：每晚的 API 增量同步（build-data.mjs）與
 * 官方月包的批次匯入（import-judgments.mjs）。規則只寫一次，
 * 兩邊的結果才會一致。
 *
 * 流程分成兩段。toRecord 把一份裁判書解析成保留完整主文的紀錄，
 * 這一段昂貴且不會變；classify 由紀錄推出結果、罪名與刑度，這一段
 * 會隨著判準調整而反覆重算，所以不依賴原始檔案。
 */

/**
 * 以「案由」而非判決全文比對。用全文會把大量無關案件收進來——一件詐欺案只要
 * 內文提到被告前科或引用了相關法條就會命中，實測混入了竊盜、侵占、洗錢、
 * 給付薪資等完全無關的案件。
 */
export const TITLE_TERMS = [
  "性自主", "性騷擾", "性侵害", "性剝削", "妨害風化",
  "跟蹤騷擾", "猥褻", "性影像", "性交易",
];

export const JUDGMENT_BASE = "https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=";

/**
 * JID 格式為「法院代碼＋裁判類別,年度,字別,號次,裁判日期,檢查單號」，
 * 裁判類別 M 為刑事。只有刑事判決才有有罪／無罪可言。
 */
export function isCriminal(jid) {
  return /M$/.test(String(jid).split(",")[0] ?? "");
}

/**
 * 裁判文首行會載明判決或裁定。裁定處理的是羈押、補正、發還扣押物等程序事項，
 * 大法庭裁定則是統一法律見解，兩者都沒有個案的有罪無罪可言，不應計入。
 */
export function isRuling(content) {
  return /刑事(大法庭)?裁定/.test(content.slice(0, 200));
}

/**
 * 附帶民事訴訟審理的是損害賠償，不是刑責，主文寫的是給付或駁回原告之訴。
 * 字別含「附民」即可辨識。
 */
export function isCivilAttachment(caseType) {
  return /附民/.test(caseType);
}

/**
 * 取出主文。主文載明判決結果，理由部分則常引述其他案件，用全文判斷會誤判。
 *
 * 段落標題自成一行，前方常有全形空白，字與字之間也可能加空格（「事 實 及 理 由」）。
 * 終止條件必須綁定行首，否則會被罪名裡的字切斷——「無正當理由持有性影像罪」
 * 就曾讓主文只擷取到「犯無正當」四個字，整筆判決因此無法判別。
 */
export function extractDisposition(content) {
  const start = content.search(/主\s*文/);
  if (start < 0) return "";
  const rest = content.slice(start);
  const end = rest.search(/[\r\n][\s　]*(犯\s*罪\s*事\s*實|事\s*實|理\s*由)/);
  return (end > 0 ? rest.slice(0, end) : rest.slice(0, 2000))
    .replace(/^主\s*文/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 取出署名法官。
 *
 * 署名寫在文末，格式是「刑事第三庭　審判長法官　王大明」後接換行，姓名本身
 * 有時會被拆開成「張　明　儀」。判斷的關鍵是姓名後面就是行尾——
 * 內文裡的「大法官釋字第803號」與「由法官獨任進行簡易程序」後面都還有字。
 * 少了這個條件，單月就有兩千七百多份裁判被抓出「獨任進行簡」「釋字第」
 * 這類根本不是人名的字串。
 */
export function extractJudgeNames(content) {
  const names = new Set();
  const pattern = /(?<!大)法\s{0,3}官[ \t　]+([㐀-鿿]{1,2}(?:[ \t　]{0,2}[㐀-鿿]){1,3})[ \t　]*(?=\r?\n|$)/g;
  for (const match of content.matchAll(pattern)) {
    const name = match[1].replace(/[\s　]/g, "");
    // 判決書以○或代號遮蔽的姓名無法辨識，不列入統計
    if (name.length >= 2 && name.length <= 4 && !/[○Ｏ〇]/.test(name)) names.add(name);
  }
  return [...names];
}

/** 組出可讀的案號，例如「114年度侵訴字第123號」。 */
export function caseNumber({ JYEAR, JCASE, JNO }) {
  return JYEAR && JCASE && JNO ? `${JYEAR}年度${JCASE}字第${JNO}號` : "";
}

/**
 * 審級。字別開頭為「台」是最高法院；含「上」是第二審（上訴、侵上訴、簡上）；
 * 其餘為第一審。受害者關心的「上訴會不會被改判」要靠這個分層才看得出來。
 */
export function courtLevel(caseType) {
  if (/^台/.test(caseType)) return "third";
  if (/上/.test(caseType)) return "second";
  return "first";
}

/**
 * 把一份裁判書解析成本站保存的紀錄；不相關或不該計入者回 null。
 * 官方月包用 JFULL 存全文，API 則放在 JFULLX.JFULLCONTENT，這裡一併吸收差異。
 *
 * 主文完整保留。判準日後會調整，屆時只要重跑分類，不必再解壓一次原始資料。
 */
export function toRecord(document) {
  const jid = document.JID;
  const title = document.JTITLE || "";
  if (!jid || !TITLE_TERMS.some((term) => title.includes(term)) || !isCriminal(jid)) return null;

  const caseType = document.JCASE || "";
  if (isCivilAttachment(caseType)) return null;

  const content = document.JFULL || document.JFULLX?.JFULLCONTENT || "";
  if (!content || isRuling(content)) return null;

  const disposition = extractDisposition(content);
  if (!disposition) return null;

  return {
    jid,
    title,
    caseNumber: caseNumber(document),
    court: String(jid).split(",")[0].slice(0, 3),
    caseType,
    level: courtLevel(caseType),
    decisionDate: document.JDATE || document["JDA TE"] || "",
    judges: extractJudgeNames(content),
    disposition,
    // 不存網址：它完全由 jid 推導得出，一萬多筆各存一份只是白白多出一 MB
  };
}

// ---------------------------------------------------------------------------
// 以下由紀錄推出結果，不需要原始檔案
// ---------------------------------------------------------------------------

/** 主文中代表科刑的用語。刑度寫在附表時，主文只會寫「各處如附表所示之刑」。 */
const SENTENCED = [
  /處.{0,20}(死刑|無期徒刑|有期徒刑|拘役|罰金)/,
  /科.{0,10}罰金/,
  /(各處|處)如附表/,
  /如附表.{0,30}所示之(刑|罪)/,
];

const OUTCOME_RULES = [
  // 程序上終結，沒有進入實體審理。不受理多為告訴乃論之罪撤回告訴，
  // 對受害者而言是重要的一類，不能混進「其他」。
  { outcome: "dismissed", test: /不受理/ },
  { outcome: "exempted", test: /免訴/ },
  { outcome: "transferred", test: /管轄錯誤/ },
];

/**
 * 判斷判決結果。
 *
 * 一部有罪一部無罪相當常見（主文寫「其餘被訴部分無罪」），過去兩種訊號同時
 * 出現就一律歸為無法判別，等於把最需要被看見的一類藏了起來，改為獨立分類。
 * 上訴駁回維持原判，本身就是二三審法官的決定，也自成一類；至於原審判的是
 * 有罪還是無罪，主文沒有寫，本站不臆測。
 */
export function classifyOutcome(disposition) {
  for (const rule of OUTCOME_RULES) {
    if (rule.test.test(disposition)) return rule.outcome;
  }

  const sentenced = SENTENCED.some((re) => re.test(disposition));
  const acquitted = /無罪/.test(disposition);
  if (sentenced && acquitted) return "partial";
  if (sentenced) return "guilty";
  if (acquitted) return "acquitted";

  if (/上訴.{0,4}駁回/.test(disposition)) return "upheld";
  if (/撤銷/.test(disposition)) return "reversed";
  return "unclear";
}

/** 判決結果在畫面上的名稱與順序。 */
export const OUTCOME_LABELS = {
  guilty: "有罪",
  partial: "部分有罪",
  acquitted: "無罪",
  upheld: "上訴駁回，維持原判",
  reversed: "原判決撤銷",
  dismissed: "不受理",
  exempted: "免訴",
  transferred: "管轄錯誤移送",
  unclear: "無法判別",
};

// 判決書裡的「○」是遮蔽用的白圈，不是數字，因此不列入
const NUMERALS = {
  "零": 0, "〇": 0, "一": 1, "壹": 1, "二": 2, "貳": 2, "兩": 2, "三": 3, "參": 3, "叁": 3,
  "四": 4, "肆": 4, "五": 5, "伍": 5, "六": 6, "陸": 6, "七": 7, "柒": 7,
  "八": 8, "捌": 8, "九": 9, "玖": 9,
};
const NUMERAL_UNITS = { "十": 10, "拾": 10, "百": 100, "佰": 100, "千": 1000, "仟": 1000 };

/** 判決主文的數字有大寫、小寫與阿拉伯數字三種寫法，全部要能讀。 */
export function parseNumber(text) {
  if (!text) return null;
  const arabic = /^\d+$/.exec(text.replace(/[,，]/g, ""));
  if (arabic) return Number(arabic[0]);

  let total = 0;
  let current = 0;
  let seen = false;
  for (const char of text) {
    if (char in NUMERALS) {
      current = NUMERALS[char];
      seen = true;
    } else if (char in NUMERAL_UNITS) {
      total += (current || 1) * NUMERAL_UNITS[char];
      current = 0;
      seen = true;
    }
  }
  return seen ? total + current : null;
}

const NUM = "[0-9零〇一二三四五六七八九十百千壹貳兩參叁肆伍陸柒捌玖拾佰仟，,]+";

/** 取出最重的一項自由刑，換算成月。定應執行刑優先，那才是實際要服的刑期。 */
export function extractSentence(disposition) {
  if (/死刑/.test(disposition)) return { kind: "death", months: null };
  if (/無期徒刑/.test(disposition)) return { kind: "life", months: null };

  const collect = (text) => {
    const found = [];
    for (const match of text.matchAll(new RegExp(`有期徒刑(${NUM})年(?:(${NUM})月)?`, "g"))) {
      found.push((parseNumber(match[1]) ?? 0) * 12 + (parseNumber(match[2]) ?? 0));
    }
    for (const match of text.matchAll(new RegExp(`有期徒刑(${NUM})月`, "g"))) {
      found.push(parseNumber(match[1]) ?? 0);
    }
    return found.filter((months) => months > 0);
  };

  // 數罪併罰時，主文先列各罪之刑，再寫應執行刑
  const aggregate = new RegExp(`應執行[^。]{0,40}有期徒刑(${NUM})年(?:(${NUM})月)?`).exec(disposition)
    ?? new RegExp(`應執行[^。]{0,40}有期徒刑(${NUM})月`).exec(disposition);
  if (aggregate) {
    const months = aggregate[0].includes("年")
      ? (parseNumber(aggregate[1]) ?? 0) * 12 + (parseNumber(aggregate[2]) ?? 0)
      : parseNumber(aggregate[1]) ?? 0;
    if (months > 0) return { kind: "prison", months };
  }

  const terms = collect(disposition);
  if (terms.length) return { kind: "prison", months: Math.max(...terms) };

  const detention = new RegExp(`拘役(${NUM})日`).exec(disposition);
  if (detention) return { kind: "detention", days: parseNumber(detention[1]) };

  if (/罰金|罰鍰/.test(disposition)) return { kind: "fine", months: null };
  return { kind: "none", months: null };
}

/** 緩刑年數。緩刑代表不用入監，對受害者的心理預期影響很大。 */
export function extractProbation(disposition) {
  const match = new RegExp(`緩刑(${NUM})年`).exec(disposition);
  return match ? parseNumber(match[1]) : null;
}

/**
 * 罪名分類。優先讀主文裡的「犯……罪」，那是法院實際論罪的結果；
 * 主文沒寫時才退回案由，案由常常只寫「妨害性自主」這種概括名稱。
 *
 * 一份判決只給一個標籤，取最先命中的規則，因此順序即優先序：
 * 先分出性質完全不同的類別（判決確定後的義務違反、性交易、猥褻物品），
 * 再依被害人身分（年齡、權勢關係）分，最後才是行為態樣。
 * 這個順序寫在站上的統計方法說明裡，讀者才知道一件案子為何被歸在某一類。
 */
const OFFENCE_RULES = [
  // 加害人屆期不履行身心治療、未依規定登記報到，是判決確定後的義務違反，
  // 不是性侵害行為本身。刑度多為拘役，混進來會把刑期分布整個拉低。
  {
    key: "offenderCompliance",
    label: "加害人未履行治療或登記義務",
    test: /屆期(仍)?不履行|性侵害犯罪防治法第\s*(五十|50|二十一|21)\s*條/,
  },
  { key: "childSexualExploitation", label: "兒少性剝削", test: /性剝削|兒童及少年性交易/ },
  { key: "sexualImage", label: "性影像", test: /性影像|不實性影像/ },
  { key: "obscenePublication", label: "散布猥褻物品", test: /(散布|播送|販賣|供人觀覽|公然陳列).{0,8}猥褻/ },
  {
    key: "sexTrade",
    label: "媒介與圖利性交易",
    test: /圖利(容留|媒介|引誘)|意圖使.{0,10}為(性交|猥褻).{0,12}(媒介|容留|引誘|營利)|媒介.{0,6}性交易/,
  },
  { key: "stalking", label: "跟蹤騷擾", test: /跟蹤騷擾/ },
  { key: "sexualHarassment", label: "性騷擾", test: /性騷擾/ },
  { key: "publicIndecency", label: "公然猥褻", test: /公然猥褻/ },
  { key: "childUnder14", label: "對未滿十四歲者性交猥褻", test: /未滿十四歲|未滿14歲/ },
  { key: "youth14to16", label: "對十四至十六歲者性交猥褻", test: /十四歲以上未滿十六歲|14歲以上未滿16歲/ },
  { key: "authorityAbuse", label: "利用權勢性交猥褻", test: /利用權勢|受監督.{0,6}照護|受照護之人/ },
  { key: "incapacitated", label: "乘機性交猥褻", test: /乘機/ },
  { key: "forcedIntercourse", label: "強制性交", test: /強制性交|強姦/ },
  { key: "forcedIndecency", label: "強制猥褻", test: /強制猥褻/ },
  { key: "sexualIntrusion", label: "妨害性隱私與偷拍", test: /性隱私|窺視|竊錄|攝錄他人非公開|偷拍/ },
];

export function classifyOffence({ disposition, title }) {
  for (const source of [disposition, title]) {
    for (const rule of OFFENCE_RULES) {
      if (rule.test.test(source)) return rule.key;
    }
  }
  return "other";
}

export const OFFENCE_LABELS = Object.fromEntries(
  [...OFFENCE_RULES.map((rule) => [rule.key, rule.label]), ["other", "其他"]],
);

/**
 * 案由分類。
 *
 * 上面那套讀主文的分類有一個致命問題：它依賴判決結果。有罪判決的主文寫
 * 「犯強制猥褻罪」，無罪判決只寫「被告無罪」，於是無罪案件永遠分不到具體罪名，
 * 全部落進「其他」。實測第一審 389 件無罪有 275 件如此，各罪名的定罪率因而
 * 被系統性地灌高到接近百分之百。
 *
 * 案由在起訴時就決定了，與判決結果無關，因此凡是牽涉結果比較的統計一律用它。
 * 代價是比較粗——妨害性自主底下不分強制性交或對未成年——量刑的細分另外處理。
 */
const CHARGE_RULES = [
  { key: "sexualPrivacy", label: "妨害性隱私及不實性影像", test: /性隱私|性影像/ },
  {
    key: "offenderDuty",
    label: "違反性侵害犯罪防治法",
    note: "多為加害人未依規定履行身心治療或登記報到義務",
    test: /性侵害犯罪防治法|性侵害防治法/,
  },
  { key: "childExploitation", label: "兒少性剝削防制條例", test: /性剝削|兒童及少年性交易/ },
  { key: "stalkingAct", label: "跟蹤騷擾防制法", test: /跟蹤騷擾/ },
  { key: "harassmentAct", label: "性騷擾防治法", test: /性騷擾/ },
  { key: "publicMorals", label: "妨害風化", test: /妨害風化|公然猥褻|性交易/ },
  { key: "sexualAutonomy", label: "妨害性自主", test: /妨害性自主|強制性交|強制猥褻|猥褻|性侵害/ },
];

export function classifyCharge(title) {
  for (const rule of CHARGE_RULES) {
    if (rule.test.test(title)) return rule.key;
  }
  return "otherCharge";
}

export const CHARGE_LABELS = Object.fromEntries(
  [...CHARGE_RULES.map((rule) => [rule.key, rule.label]), ["otherCharge", "其他案由"]],
);

export const CHARGE_NOTES = Object.fromEntries(
  CHARGE_RULES.filter((rule) => rule.note).map((rule) => [rule.key, rule.note]),
);

/**
 * 由紀錄推出結果、罪名與刑度，合成完整的一筆判決。
 *
 * charge 來自案由，與判決結果無關，用於一切牽涉結果比較的統計；
 * offence 來自主文論罪，比較細，但只有定罪的判決才寫得出來，
 * 因此僅用於定罪案件內部的量刑統計。兩者不可互換。
 */
export function classify(record) {
  const outcome = classifyOutcome(record.disposition);
  const convicted = outcome === "guilty" || outcome === "partial";
  return {
    ...record,
    outcome,
    charge: classifyCharge(record.title),
    offence: classifyOffence(record),
    sentence: convicted ? extractSentence(record.disposition) : null,
    probation: convicted ? extractProbation(record.disposition) : null,
  };
}
