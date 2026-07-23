import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCharge, classifyOffence, classifyOutcome, courtLevel, extractDisposition, extractJudgeNames,
  extractProbation, extractSentence, isCivilAttachment, isRuling, parseNumber, toRecord,
} from "../scripts/judgment-rules.mjs";
import { summarise } from "../scripts/judgment-stats.mjs";

/** 依實際月包的格式組出裁判書全文：段落標題自成一行，前方帶全形空白。 */
function document(disposition, { type = "判決", body = "理 由\r\n略" } = {}) {
  return `臺灣某地方法院刑事${type}　114年度侵訴字第1號\r\n主　文\r\n${disposition}\r\n　　${body}\r\n`;
}

test("主文的終止條件綁定行首，不會被罪名裡的「理由」切斷", () => {
  // 「無正當理由持有性影像罪」曾讓主文只擷取到「犯無正當」四個字，
  // 整筆判決因此無法判別，是先前 160 筆歸類失敗的主因之一。
  const content = document("Ａ０７犯無正當理由持有兒童性影像罪，處有期徒刑陸月。");
  const disposition = extractDisposition(content);
  assert.match(disposition, /處有期徒刑陸月/);
  assert.equal(classifyOutcome(disposition), "guilty");
});

test("一部有罪一部無罪自成一類，不歸為無法判別", () => {
  const disposition = extractDisposition(
    document("陳某犯強制猥褻罪，處有期徒刑壹年陸月。 其餘被訴部分無罪。"));
  assert.equal(classifyOutcome(disposition), "partial");
});

test("刑度載於附表時仍判定為有罪", () => {
  const disposition = extractDisposition(
    document("Ａ１２犯如附表二編號1至4所示之罪，各處如附表二編號1至4所示之刑。"));
  assert.equal(classifyOutcome(disposition), "guilty");
});

test("程序性結果各自成立一類", () => {
  const cases = [
    ["本件公訴不受理。", "dismissed"],
    ["本件免訴。", "exempted"],
    ["本件管轄錯誤，移送於臺灣新竹地方法院。", "transferred"],
    ["上訴駁回。", "upheld"],
    ["上訴均駁回。", "upheld"],
    ["原判決撤銷。", "reversed"],
    ["被告無罪。", "acquitted"],
  ];
  for (const [text, expected] of cases) {
    assert.equal(classifyOutcome(extractDisposition(document(text))), expected, text);
  }
});

test("裁定與附帶民事訴訟不計入", () => {
  assert.ok(isRuling("臺灣高等法院刑事裁定 114年度抗字第1號"));
  assert.ok(isRuling("最高法院刑事大法庭裁定 114年度台上大字第1405號"));
  assert.ok(!isRuling("臺灣臺北地方法院刑事判決 114年度侵訴字第1號"));

  for (const type of ["侵附民", "審簡附民", "原附民", "附民"]) {
    assert.ok(isCivilAttachment(type), type);
  }
  assert.ok(!isCivilAttachment("侵訴"));

  assert.equal(toRecord({
    JID: "TPDM,114,侵附民,62,20260225,1",
    JTITLE: "妨害性自主罪附帶民訴",
    JCASE: "侵附民",
    JFULL: document("被告應給付原告新臺幣貳佰萬元。"),
  }), null, "附帶民訴的主文是給付金額，不是刑責，不該進入統計");
});

test("刑期讀得懂大寫、小寫與阿拉伯數字，並以應執行刑為準", () => {
  assert.equal(parseNumber("參"), 3);
  assert.equal(parseNumber("拾肆"), 14);
  assert.equal(parseNumber("二十"), 20);
  assert.equal(parseNumber("15"), 15);

  assert.deepEqual(extractSentence("處有期徒刑柒年陸月。"), { kind: "prison", months: 90 });
  assert.deepEqual(extractSentence("處有期徒刑2月。"), { kind: "prison", months: 2 });
  // 數罪併罰時，實際要服的是應執行刑，不是最重的單一罪刑
  assert.deepEqual(
    extractSentence("各處有期徒刑參年貳月。應執行有期徒刑肆年。"),
    { kind: "prison", months: 48 });
  assert.equal(extractSentence("處無期徒刑。").kind, "life");
  assert.equal(extractSentence("科罰金新臺幣參萬伍仟元。").kind, "fine");
  assert.equal(extractProbation("處有期徒刑柒月。緩刑叁年。"), 3);
  assert.equal(extractProbation("處有期徒刑柒月。"), null);
});

test("罪名以主文論罪為準，案由只是備援", () => {
  assert.equal(classifyOffence({ disposition: "犯強制性交罪，處有期徒刑柒年。", title: "妨害性自主" }), "forcedIntercourse");
  assert.equal(classifyOffence({ disposition: "犯對於十四歲以上未滿十六歲之女子為性交罪。", title: "妨害性自主" }), "youth14to16");
  assert.equal(classifyOffence({ disposition: "處罰鍰參仟元。", title: "違反跟蹤騷擾防制法" }), "stalking");
  // 年齡比行為態樣優先：這件會歸在「對未滿十四歲者」而不是「強制猥褻」
  assert.equal(classifyOffence({ disposition: "對未滿十四歲之女子犯強制猥褻罪。", title: "妨害性自主" }), "childUnder14");
});

test("判決確定後的義務違反不與性侵害行為混為一類", () => {
  // 刑度是拘役而非數年徒刑，混進來會把刑期分布整個拉低
  const compliance = {
    disposition: "犯性侵害犯罪防治法第五十條第三項之加害人屆期不履行身心治療罪，處拘役肆拾日。",
    title: "違反性侵害犯罪防治法",
  };
  assert.equal(classifyOffence(compliance), "offenderCompliance");
  assert.equal(extractSentence(compliance.disposition).kind, "detention");
});

test("妨害風化與性交易各自成類，不落入其他", () => {
  assert.equal(classifyOffence({ disposition: "犯圖利容留性交罪，處有期徒刑參月。", title: "妨害風化" }), "sexTrade");
  assert.equal(classifyOffence({ disposition: "犯以網際網路供人觀覽猥褻影像罪。", title: "妨害風化" }), "obscenePublication");
  // 性影像（刑法第 319 條之 2）與猥褻影像（第 235 條）是不同的罪，不可混同
  assert.equal(classifyOffence({ disposition: "犯無故散布性影像罪。", title: "妨害性隱私" }), "sexualImage");
});

test("法官署名不會抓到內文裡的「法官」二字", () => {
  // 這兩種寫法曾讓單月兩千七百多份裁判抓出「釋字第」「獨任進行簡」當人名
  const noise = "大法官釋字第803號解釋理由書意旨參照，由法官獨任進行簡易程序。\r\n";
  assert.deepEqual(extractJudgeNames(noise), []);

  const signature = `${noise}中　華　民　國　115　年　2　月　10　日\r\n` +
    "　　　　刑事第三庭　審判長法官　王大明\r\n　　　　　　　　　　法　官　張　明　儀\r\n" +
    "　　　　　　　　　　法　官　○○○\r\n以上正本證明與原本無異。\r\n";
  assert.deepEqual(extractJudgeNames(signature), ["王大明", "張明儀"]);
});

test("審級由字別判定", () => {
  assert.equal(courtLevel("侵訴"), "first");
  assert.equal(courtLevel("審簡"), "first");
  assert.equal(courtLevel("侵上訴"), "second");
  assert.equal(courtLevel("簡上"), "second");
  assert.equal(courtLevel("台上"), "third");
});

test("代號化的法官姓名不列入統計", () => {
  const names = extractJudgeNames("審判長法官　王大明\r\n法官　○○○\r\n法官　李小華");
  assert.deepEqual(names, ["王大明", "李小華"]);
});

test("結果統計依案由分組，不受判決結果影響", () => {
  // 用主文的罪名分組會讓定罪率虛高：有罪判決的主文寫「犯強制猥褻罪」，
  // 無罪判決只寫「被告無罪」，於是無罪案件全部落進「其他」，
  // 剩下每一類的定罪率都逼近百分之百。案由在起訴時就決定，沒有這個問題。
  assert.equal(classifyCharge("妨害性自主"), "sexualAutonomy");
  assert.equal(classifyCharge("家暴妨害性自主等罪"), "sexualAutonomy");
  assert.equal(classifyCharge("違反性騷擾防治法"), "harassmentAct");
  assert.equal(classifyCharge("妨害性隱私及不實性影像罪"), "sexualPrivacy");
  assert.equal(classifyCharge("違反性侵害犯罪防治法"), "offenderDuty");
  assert.equal(classifyCharge("妨害風化"), "publicMorals");

  const base = { judges: [], caseNumber: "", url: "u", decisionDate: "20260101", level: "first" };
  const stats = summarise([
    { ...base, jid: "1", url: "u1", title: "妨害性自主", disposition: "犯強制猥褻罪，處有期徒刑壹年。" },
    { ...base, jid: "2", url: "u2", title: "妨害性自主", disposition: "被告無罪。" },
  ]);
  // 兩件案由相同，必須落在同一組，定罪率才會是 50% 而不是各自 100%
  assert.equal(stats.byCharge.sexualAutonomy.total, 2);
  assert.equal(stats.byCharge.sexualAutonomy.conviction.rate, 0.5);
  // 量刑表只收定罪的案件
  assert.equal(stats.bySentence.forcedIndecency.convicted, 1);
  assert.equal(stats.bySentence.forcedIndecency.prisonMonths.median, 12);
});

test("定罪率只計第一審且排除未經實體審理的案件", () => {
  const base = { judges: ["某法官"], title: "妨害性自主", caseNumber: "", url: "u", decisionDate: "20260101" };
  const records = [
    { ...base, jid: "1", url: "u1", level: "first", disposition: "犯強制猥褻罪，處有期徒刑壹年。" },
    { ...base, jid: "2", url: "u2", level: "first", disposition: "犯強制猥褻罪，處有期徒刑貳年。" },
    { ...base, jid: "3", url: "u3", level: "first", disposition: "被告無罪。" },
    { ...base, jid: "4", url: "u4", level: "first", disposition: "本件公訴不受理。" },
    { ...base, jid: "5", url: "u5", level: "second", disposition: "上訴駁回。" },
  ];

  const stats = summarise(records);
  assert.equal(stats.overall.total, 4, "第一審四件");
  assert.equal(stats.overall.counts.substantive, 3, "不受理不進入實體審理的分母");
  assert.equal(stats.overall.conviction.rate, 0.667, "比率四捨五入到千分位");
  // 每個比率都要帶著自己的分子與分母，畫面才有辦法把分母寫清楚
  assert.deepEqual(stats.overall.conviction, { part: 2, whole: 3, rate: 0.667 });
  assert.deepEqual(stats.overall.closedBeforeMerits, { part: 1, whole: 4, rate: 0.25 },
    "不受理的分母是全部件數，與定罪率的分母不同");
  assert.equal(stats.byLevel.second.outcomes.upheld, 1);
  // 上訴審不計入定罪率，否則同一件事實會被重複計算
  assert.equal(stats.overall.outcomes.upheld, undefined);

  const judge = stats.judges[0];
  assert.equal(judge.name, "某法官");
  // 只有通常程序、第一審、進入實體審理的案件才計入判讀子集（case 1、2、3）
  assert.equal(judge.contested, 3);
  assert.equal(judge.convicted, 2);
  assert.equal(judge.acquitted, 1);
  assert.equal(judge.contestedOther, 1, "不受理不算實體，另計");
  assert.equal(judge.appellate, 1, "上訴駁回是上訴審，不混入第一審判讀");
  assert.equal(judge.guiltyCases.length, 2);
  assert.equal(judge.acquittedCases.length, 1);
});
