import assert from "node:assert/strict";
import test from "node:test";
import { extractDailynewsArticles, extractFeedArticles, mergeArticle } from "../scripts/build-data.mjs";

/**
 * 內嵌的小段真實結構 fixture：截自 2026-08-06 改站後的 newsfeed.xml 與
 * dailynews 列表頁，只留下驗證解析邏輯所需的欄位與層次，其餘（如 tag 清單、
 * 縮圖 img）省略。dailynews 的 fixture 刻意在 <article> 區塊外多放一個
 * id="idleModal" 彈窗、且彈窗裡也有 /article/ 連結，用來驗證解析器不會
 * 把彈窗內容也收進來。
 */
const FEED_XML = `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="zh-TW">
    <id>https://news.pts.org.tw/xml/newsfeed.xml</id>
    <title><![CDATA[公視新聞網]]></title>
    <updated>2026-08-07T08:50:08+08:00</updated>
    <entry>
        <title><![CDATA[女學生遭教師性騷擾 校方認定不成立]]></title>
        <link rel="alternate" href="https://news.pts.org.tw/article/900001" />
        <id>https://news.pts.org.tw/article/900001</id>
        <summary type="html">
            <![CDATA[<p>某國中傳出女學生指控遭男教師性騷擾一案，校方性平會調查後認定不成立，家長質疑調查過程有瑕疵，要求教育局重啟調查，全案仍在申復程序中，本文為了測試摘要截斷特別加長內容使其超過一百六十個字元，以確保截斷邏輯能被驗證到，重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複重複。</p>]]>
        </summary>
        <updated>2026-08-07T08:20:12+08:00</updated>
    </entry>
    <entry>
        <title><![CDATA[天氣炎熱慎防中暑]]></title>
        <link rel="alternate" href="https://news.pts.org.tw/article/900002" />
        <id>https://news.pts.org.tw/article/900002</id>
        <summary type="html">
            <![CDATA[近日高溫炎熱，醫師提醒民眾外出應注意補充水分，慎防中暑。]]>
        </summary>
        <updated>2026-08-06T21:27:00+08:00</updated>
    </entry>
</feed>`;

const DAILYNEWS_HTML = `<!DOCTYPE html>
<html>
<body>
<article>
    <div class="breakingnews">
        <a href="https://news.pts.org.tw/article/900001" class="useImgHover">
            <img class="cover-fit" src="x.jpg">
        </a>
        <h1><a href="https://news.pts.org.tw/article/900001">女學生遭教師性騷擾 校方認定不成立</a></h1>
        <div class="news-info">
            <time datetime="2026-08-07 07:33:54">2026/8/7 07:33</time>
            <span>|</span>
            <a href="https://news.pts.org.tw/category/7">社會</a>
        </div>
    </div>
    <ul class="list-unstyled news-list news-list-update">
        <li class="d-flex">
            <figure>
                <a href="https://news.pts.org.tw/article/900003" class="useImgHover">
                    <img class="cover-fit" src="y.jpg">
                </a>
            </figure>
            <div>
                <h2 title="縣府舉辦性別平等宣導活動"><a
                    href="https://news.pts.org.tw/article/900003">縣府舉辦性別平等宣導活動</a></h2>
                <div class="news-info news-info-update">
                    <time datetime="2026-08-06 19:39:37">2026/8/6 19:39</time>
                    <span>|</span>
                    <a href="https://news.pts.org.tw/category/1">政治</a>
                </div>
            </div>
        </li>
    </ul>
</article>
<div class="program-mask idle-modal-fade" id="idleModal">
    <div class="idle-modal-main">
        <a href="https://news.pts.org.tw/article/999999">不該被收錄的閒置彈窗新聞</a>
    </div>
</div>
</body>
</html>`;

test("extractFeedArticles：解出 title／url／summary（去標籤截斷）／publishedAt（正規化為臺北時間）", () => {
  const articles = extractFeedArticles(FEED_XML);
  assert.equal(articles.length, 2);

  const [first, second] = articles;
  assert.equal(first.title, "女學生遭教師性騷擾 校方認定不成立");
  assert.equal(first.url, "https://news.pts.org.tw/article/900001");
  // ISO 帶 +08:00 位移要換算成「YYYY-MM-DD HH:mm:ss」，不能留 ISO 格式，
  // 否則既有索引靠字串排序會被混進來的格式打亂
  assert.equal(first.publishedAt, "2026-08-07 08:20:12");
  assert.doesNotMatch(first.publishedAt, /T|Z|\+/, "publishedAt 不應殘留 ISO 格式的字元");
  assert.ok(!("dateUnknown" in first), "有正常時間就不該標記 dateUnknown");
  // 摘要含 HTML（<p> 標籤）要先去標籤，再截到 160 字
  assert.doesNotMatch(first.summary, /<[^>]+>/, "摘要不應殘留 HTML 標籤");
  assert.ok(first.summary.length <= 160, `摘要應截到 160 字以內，實際 ${first.summary.length} 字`);

  assert.equal(second.title, "天氣炎熱慎防中暑");
  assert.equal(second.publishedAt, "2026-08-06 21:27:00");
  assert.equal(second.summary, "近日高溫炎熱，醫師提醒民眾外出應注意補充水分，慎防中暑。");
});

test("extractDailynewsArticles：解出 title／url／publishedAt／category，且不收 idleModal 裡的連結", () => {
  const articles = extractDailynewsArticles(DAILYNEWS_HTML);
  assert.equal(articles.length, 2, "應只解出 <article> 區塊內的兩則新聞");

  const urls = articles.map((a) => a.url);
  assert.ok(!urls.includes("https://news.pts.org.tw/article/999999"),
    "不該收錄 idleModal 閒置彈窗裡的 /article/ 連結");

  const [first, second] = articles;
  assert.equal(first.title, "女學生遭教師性騷擾 校方認定不成立");
  assert.equal(first.url, "https://news.pts.org.tw/article/900001");
  // dailynews 的 time datetime 本身就是既有索引在用的格式，原樣採用不需轉換
  assert.equal(first.publishedAt, "2026-08-07 07:33:54");
  assert.equal(first.category, "社會");

  assert.equal(second.title, "縣府舉辦性別平等宣導活動");
  assert.equal(second.url, "https://news.pts.org.tw/article/900003");
  assert.equal(second.publishedAt, "2026-08-06 19:39:37");
  assert.equal(second.category, "政治");
});

test("mergeArticle：以網址合併時，摘要取 feed、分類與發布時間優先取列表頁、標題誰有取誰", () => {
  const feedItem = {
    title: "女學生遭教師性騷擾 校方認定不成立",
    url: "https://news.pts.org.tw/article/900001",
    publishedAt: "2026-08-07 08:20:12",
    summary: "某國中傳出女學生指控遭男教師性騷擾一案……",
  };
  const dailyItem = {
    title: "女學生遭教師性騷擾 校方認定不成立",
    url: "https://news.pts.org.tw/article/900001",
    publishedAt: "2026-08-07 07:33:54",
    category: "社會",
  };

  const merged = mergeArticle(feedItem, dailyItem);
  assert.equal(merged.url, "https://news.pts.org.tw/article/900001");
  assert.equal(merged.summary, feedItem.summary, "摘要應取 feed 的值");
  assert.equal(merged.publishedAt, dailyItem.publishedAt, "發布時間應優先取列表頁的值");
  assert.equal(merged.category, dailyItem.category, "分類應優先取列表頁的值");
  assert.equal(merged.title, dailyItem.title);

  // 只在 feed 出現：沒有列表頁的分類與時間，分類要退回預設值、時間退回 feed 的值
  const feedOnly = mergeArticle(
    { title: "天氣炎熱慎防中暑", url: "https://news.pts.org.tw/article/900002",
      publishedAt: "2026-08-06 21:27:00", summary: "近日高溫炎熱……" },
    undefined,
  );
  assert.equal(feedOnly.publishedAt, "2026-08-06 21:27:00", "只有 feed 時應退回 feed 的發布時間");
  assert.equal(feedOnly.category, "公視新聞", "缺分類時應退回預設分類");
  assert.equal(feedOnly.title, "天氣炎熱慎防中暑");

  // 只在列表頁出現：沒有摘要，標題取列表頁的
  const dailyOnly = mergeArticle(
    undefined,
    { title: "縣府舉辦性別平等宣導活動", url: "https://news.pts.org.tw/article/900003",
      publishedAt: "2026-08-06 19:39:37", category: "政治" },
  );
  assert.equal(dailyOnly.summary, "", "只有列表頁時沒有摘要");
  assert.equal(dailyOnly.title, "縣府舉辦性別平等宣導活動");
  assert.equal(dailyOnly.category, "政治");

  // 兩邊都沒有可用的發布時間時要標記 dateUnknown，而不是留空字串卻沒有標記
  const noDate = mergeArticle(
    { title: "無日期報導", url: "https://news.pts.org.tw/article/900004", publishedAt: "", summary: "" },
    undefined,
  );
  assert.equal(noDate.publishedAt, "");
  assert.equal(noDate.dateUnknown, true);
});
