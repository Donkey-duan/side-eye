/**
 * 路由與各頁 metadata 的單一來源。
 *
 * URL 是唯一的狀態來源：每個專區都有可分享的網址、瀏覽器上一頁可用、
 * 搜尋引擎逐頁索引得到。任何新增的專區都必須在這裡登記，
 * 否則不會有對應的網址與 metadata。
 *
 * 這個檔案會被 server component 匯入，不可加上 "use client"。
 */

/**
 * 專用聯絡信箱。留空時，資料更正與下架頁會誠實顯示「管道建置中」並說明替代方式，
 * 而不是印一個沒有人收信的地址。取得專用信箱後填入這一行即可上線。
 */
export const CONTACT_EMAIL = "";

/**
 * 資料更正與回報表單（Google 表單）的分享連結。留空時頁面只顯示替代方式，
 * 不放一個連不到的按鈕。取得連結後填入這一行即可上線。
 */
export const CORRECTION_FORM_URL = "https://forms.gle/Ue2mzPJVyzgN3c4y7";

/**
 * 使用心得／意見反饋表單。與更正回報分開：這個不是回報資料錯誤，
 * 而是給想單純分享使用感受或建議的人。留空時不顯示。
 */
export const FEEDBACK_FORM_URL = "https://forms.gle/Du2rkvPUAvxiJ9JM7";

/** 首頁兩道門之一「搞懂」通往的資料總覽頁，以及其下的各資料專區。 */
export const SITE_SECTIONS = ["explore", "sources", "judges", "committee", "news", "coaches"] as const;
/** 關於本站與政策頁，從選單「關於本站」或頁尾進入，不列入專區入口。 */
export const POLICY_SECTIONS = ["faq", "privacy", "corrections", "licence"] as const;
export const ALL_SECTIONS = [...SITE_SECTIONS, ...POLICY_SECTIONS] as const;
export type SiteSection = (typeof ALL_SECTIONS)[number];
export type SiteView = "home" | "victim" | SiteSection;

export const VICTIM_TOPICS = [
  "safety", "evidence", "police", "campus", "appeal", "preparation", "rights", "mental", "talent",
] as const;
export type VictimTopic = (typeof VICTIM_TOPICS)[number];
export type VictimView = "home" | VictimTopic;

/** 司法現況內容多，比照受害者專區分區。/judges 只顯示分頁列（不預設展開任何一區），
 *  點分頁才進入該區。結果也是一個要點開的分頁，不再是預設。 */
export const JUDGE_TOPICS = ["results", "sentencing", "levels", "panel"] as const;
export type JudgeTopic = (typeof JUDGE_TOPICS)[number];
export type JudgeView = "home" | JudgeTopic;
export const JUDGE_TABS: { view: JudgeTopic; label: string; hint: string }[] = [
  { view: "results", label: "會不會定罪", hint: "各罪名判有罪或無罪的比例" },
  { view: "sentencing", label: "判多重", hint: "定罪的刑度、緩刑與罰金" },
  { view: "levels", label: "上訴之後", hint: "二、三審維持或改判" },
  { view: "panel", label: "法官怎麼判", hint: "各法官承審紀錄與無罪率" },
];

export type PageMeta = { title: string; description: string };

const SITE_NAME = "明鏡性平";

export const sectionMeta: Record<SiteView, PageMeta> = {
  home: {
    title: "台灣性別事件公共資訊平台",
    description: "彙整政府開放統計、教育部公開名冊、司法院裁判書與公共新聞，並清楚標示每一項的來源、範圍與更新時間。",
  },
  victim: {
    title: "我是受害者",
    description: "安全計畫、證據保存、報警與校園性平流程、申復救濟與心理支持。先確認安全，再選擇適合你的行動路徑。",
  },
  explore: {
    title: "搞懂性平事件的真實情況",
    description: "以標明來源與分母的官方資料，看性平案件歷來怎麼判、校園通報與屬實趨勢，以及資料來源、新聞索引與不適任教練資訊。",
  },
  sources: {
    title: "資料來源與涵蓋範圍",
    description: "本站五個資料來源的權責機關、涵蓋範圍、更新頻率與現況，包含哪些查得到、哪些查不到以及查不到的原因。",
  },
  judges: {
    title: "司法現況與裁判觀測",
    description: "性平案件歷來怎麼判：各罪名的定罪率、宣告刑分布、緩刑與不受理比例、各審級結果，以及依裁判書署名整理的法官承審紀錄。",
  },
  committee: {
    title: "性平委員調查案例統計",
    description: "臺北市政府公開統計的校園性別事件通報與調查屬實趨勢，涵蓋 109 至 113 學年。",
  },
  news: {
    title: "公視性平新聞索引",
    description: "可搜尋的公視性平相關新聞索引，以監測詞查詢並逐頁往回收錄歷史報導，只保存標題、短摘要與原始連結。",
  },
  coaches: {
    title: "運動部不適任教練專區",
    description: "運動部公開的不適任教練資訊入口，收錄涉及性平、傷害與家暴事件的刑事裁判資料範圍說明。",
  },
  faq: {
    title: "常見問題",
    description: "關於明鏡的定位與取捨：為什麼只有受害者專區、法官資料為何不是評分，以及這個站到底是為誰而做。",
  },
  privacy: {
    title: "隱私政策",
    description: "本站不設帳號、不追蹤使用者、不投放廣告。說明哪些操作會送出資料、哪些完全在瀏覽器內完成。",
  },
  corrections: {
    title: "資料更正與下架",
    description: "可以要求更正的範圍、提出方式，以及本站為何沒有個案下架需求的說明。",
  },
  licence: {
    title: "資料授權",
    description: "站上各項政府開放資料與新聞索引的授權條款、引用方式，以及本站自撰內容的使用規範。",
  },
};

export const victimMeta: Record<VictimTopic, PageMeta> = {
  safety: {
    title: "先做安全計畫",
    description: "報案或申請前先評估風險會不會升高：需要提高警覺的訊號、立即可做的安排，以及不要單獨通知或對質的理由。",
  },
  evidence: {
    title: "證據保存與送件",
    description: "以截圖為主的保存原則、LINE 對話為何不能只留匯出文字、事後告訴信任的人為何是補強證據，以及送件與收件確認。",
  },
  police: {
    title: "一般報警與刑事程序",
    description: "從安全計畫、到場、就醫驗傷、製作筆錄、核對簽名、檢查報案證明單到長期偵查等待的完整流程與實際耗時。",
  },
  campus: {
    title: "校園性平申請流程",
    description: "管轄與收件日、20 日受理通知、2 個月調查期與延長、訪談前核對證據、保護措施，以及 30 日申復期限。",
  },
  appeal: {
    title: "申復與後續救濟",
    description: "申復的法定門檻、防治準則明定的六款調查程序重大瑕疵、新事實與新證據的範圍，以及不服申復後的申訴管道。",
  },
  preparation: {
    title: "行動準備清單",
    description: "每次行動前逐項確認安全、證據、等待、陳述、收件、紀錄與身心照顧的準備清單。",
  },
  rights: {
    title: "性平期限與程序檢核",
    description: "3 日交付、20 日受理通知、2 個月調查、30 日申復與申訴等法定期限，以及可以要求的必要協助。",
  },
  mental: {
    title: "心理準備與支持",
    description: "程序可能很久也可能讓你重回事件：訪談前後的安排、等待期的照顧，以及認定會受委員主觀判斷影響的心理預期。",
  },
  talent: {
    title: "全國性平委員名冊",
    description: "可搜尋教育部公開的性平調查專業人才名冊，並說明這些委員在調查與申復審議中的實際角色。",
  },
};

export const judgeMeta: Record<JudgeTopic, PageMeta> = {
  results: {
    title: "性平案件歷來怎麼判",
    description: "各罪名的第一審定罪率與無罪率，依案由分組（不受判決結果影響），並說明三個比率各自的分母。",
  },
  sentencing: {
    title: "性平案件的量刑",
    description: "各罪名定罪案件的宣告刑中位數與四分位距、緩刑比例，以及判罰金或拘役的件數，依主文實際論罪分組。",
  },
  levels: {
    title: "性平案件的各審級結果",
    description: "第一審、第二審、第三審的結果分布與差異：一二審是事實審、三審是法律審，以及上訴駁回與原判決撤銷的意義。",
  },
  panel: {
    title: "法官承審紀錄",
    description: "依裁判書署名整理的法官承審紀錄。只計通常程序第一審的無罪率並附樣本數與案件組成，避免以案件難易誤讀法官。",
  },
};

export function pageTitle(meta: PageMeta) {
  return `${meta.title}｜${SITE_NAME}`;
}

/** 由目前的 view 組出網址。 */
export function viewPath(siteView: SiteView, victimView: VictimView = "home", judgeView: JudgeView = "home") {
  if (siteView === "home") return "/";
  if (siteView === "victim") return victimView === "home" ? "/victim" : `/victim/${victimView}`;
  if (siteView === "judges") return judgeView === "home" ? "/judges" : `/judges/${judgeView}`;
  return `/${siteView}`;
}

/** 由網址解析出 view。無法對應者一律回首頁，呼叫端自行決定是否 notFound。 */
export function parsePath(pathname: string): { siteView: SiteView; victimView: VictimView; judgeView: JudgeView } {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return { siteView: "home", victimView: "home", judgeView: "home" };
  if (parts[0] === "victim") {
    const topic = parts[1];
    const victimView = (VICTIM_TOPICS as readonly string[]).includes(topic ?? "") ? (topic as VictimTopic) : "home";
    return { siteView: "victim", victimView, judgeView: "home" };
  }
  if (parts[0] === "judges") {
    const topic = parts[1];
    const judgeView = (JUDGE_TOPICS as readonly string[]).includes(topic ?? "") ? (topic as JudgeTopic) : "home";
    return { siteView: "judges", victimView: "home", judgeView };
  }
  if ((ALL_SECTIONS as readonly string[]).includes(parts[0])) {
    return { siteView: parts[0] as SiteSection, victimView: "home", judgeView: "home" };
  }
  return { siteView: "home", victimView: "home", judgeView: "home" };
}

/** 捲動時要對齊的區塊 id。 */
export function scrollTargetFor(siteView: SiteView, victimView: VictimView, judgeView: JudgeView = "home") {
  if (siteView === "home") return "top";
  // 司法現況點到某一分區時，捲到該區內容而非整個專區頂端
  if (siteView === "judges") return judgeView === "home" ? "judges" : `judge-${judgeView}`;
  if (siteView !== "victim") return siteView;
  if (victimView === "home") return "campus-hub";
  if (victimView === "talent") return "talent";
  if (victimView === "police" || victimView === "campus") return "application-flow";
  if (victimView === "preparation" || victimView === "rights") return "preparation";
  return "victim-detail";
}
