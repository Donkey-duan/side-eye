"use client";

import { CONTACT_EMAIL, CORRECTION_FORM_URL, FEEDBACK_FORM_URL, type SiteView } from "../routes";

/** 隱私政策、資料更正與下架、資料授權。純靜態內容，只從頁尾進入。 */
export default function PolicyPages({ siteView, onHome }: { siteView: SiteView; onHome: () => void }) {
  return (
    <>
      <section className={`policy ${siteView !== "privacy" ? "site-hidden" : ""}`} id="privacy">
        <button className="back-to-hub" onClick={() => onHome()}>← 回首頁</button>
        <div className="section-heading"><div><span className="section-kicker">PRIVACY</span><h2>隱私政策</h2></div><p>不設帳號 · 不追蹤 · 不投放廣告</p></div>
        <div className="policy-body">
          <h3>本站不收集個人資料</h3>
          <p>瀏覽本站不需要註冊、不需要登入，也沒有帳號系統。本站不使用分析工具、不放追蹤像素、不投放廣告，也不與第三方廣告或資料仲介交換任何資料。</p>

          <h3>搜尋不會送出你輸入的內容</h3>
          <p>本站是純靜態網站，沒有後端伺服器。新聞索引與全國性平委員名冊都是在你開啟頁面時整份下載，之後的搜尋與篩選完全在你的瀏覽器內完成，輸入的關鍵字不會離開你的裝置，也不會被儲存或與任何人關聯。受害者專區的所有內容都是靜態的，你點了哪一區、讀了哪一頁，本站不會記錄，也無法得知。</p>

          <h3>伺服器紀錄</h3>
          <p>本站以 GitHub Pages 靜態託管。託管平台會為了運作產生一般的連線紀錄，例如 IP 位址與請求時間，這些紀錄由平台依其政策保存，本站無法讀取，也不另行分析或建立使用者輪廓。</p>

          <h3>外部連結</h3>
          <p>站上指向司法院、教育部、衛福部、公視等網站的連結，點擊後即離開本站，對方網站的隱私政策由對方負責。若你正在使用共用裝置或擔心瀏覽紀錄被查看，請留意這些連結會留在瀏覽器的歷史紀錄中。</p>

          <h3>給正在求助的人</h3>
          <p>本站不會記錄你的閱讀行為，但你的裝置與瀏覽器會。如果你擔心有人查看你的裝置，可考慮使用無痕視窗、事後清除瀏覽紀錄，或改用對方無法接觸的裝置。這一點在安全計畫那一區也有更完整的說明。</p>
        </div>
      </section>

      <section className={`policy ${siteView !== "corrections" ? "site-hidden" : ""}`} id="corrections">
        <button className="back-to-hub" onClick={() => onHome()}>← 回首頁</button>
        <div className="section-heading"><div><span className="section-kicker">CORRECTIONS</span><h2>資料更正與下架</h2></div><p>可以更正什麼、怎麼提出</p></div>
        <div className="policy-body">
          <h3>本站沒有個案下架需求</h3>
          <p>本站不收錄個別事件的紀錄，也不建立個人的事件索引，站上唯一涉及具名個人的內容是教育部公開的性平調查專業人才名冊，以及司法院公開裁判書中的承審法官署名統計。兩者都直接來自官方公開資料，且都不是對個人的評價。因此這裡沒有「把某個案件從名單上撤下」這種需求。</p>

          <h3>可以要求更正的範圍</h3>
          <ul>
            <li>引用錯誤：數字、日期、機關名稱或條文編號與原始來源不符</li>
            <li>來源標示有誤：授權條款、擷取時間或涵蓋範圍寫錯</li>
            <li>資料過期：統計已有新版本，或法規、期限、程序已經修正</li>
            <li>流程說明與現行規定不符：受害者專區的程序描述與最新法規有出入</li>
            <li>名冊內容有誤：姓名、服務單位或職稱與教育部原始名冊不一致</li>
          </ul>

          <h3>名冊本身的更正要向教育部提出</h3>
          <p>人才名冊的內容以教育部公告版本為準。若你認為名冊本身的記載有誤，或希望自己不再列於名冊中，須向教育部提出；本站會在下一次改版時同步。若本站的轉錄與教育部版本不一致，那屬於本站的錯誤，請直接告知。</p>

          <h3>提出方式</h3>
          {CORRECTION_FORM_URL
            ? <>
                <p>請填寫回報表單，說明你認為有誤的位置、正確的內容，以及可供查證的原始來源。收到後會核對原始機關頁面，確認屬實即更正，並保留異動紀錄。表單不強制留下聯絡方式，可以匿名回報。</p>
                <a className="form-button" href={CORRECTION_FORM_URL} target="_blank" rel="noreferrer">開啟資料更正與回報表單 <span>↗</span></a>
              </>
            : CONTACT_EMAIL
              ? <p>請寄信至 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>，說明你認為有誤的位置、正確的內容，以及可供查證的原始來源。收到後我們會核對原始機關頁面，確認屬實即更正，並保留異動紀錄。</p>
              : <p className="policy-pending">回報管道建置中。在表單開通前，若你發現站上的引用有誤，請以原始機關頁面為準——每一項資料在「資料來源與涵蓋範圍」都列出了權責機關與原始連結。本站不收錄個別事件紀錄，因此沒有緊急的個案下架需求。</p>}

          <h3>更正之後</h3>
          <p>更正會直接反映在頁面上，並在對應的資料來源說明中標註最新的擷取時間。本站的原始碼與內容變更都保留在版本紀錄中，改了什麼、何時改的都可追溯。</p>

          {FEEDBACK_FORM_URL && <>
            <h3>只是想分享使用心得</h3>
            <p>如果你不是要回報錯誤，而是想單純說說使用感受、覺得哪裡有幫助或哪裡可以更好，這裡有另一份意見表單。不必留下聯絡方式。</p>
            <a className="form-button secondary" href={FEEDBACK_FORM_URL} target="_blank" rel="noreferrer">開啟意見反饋表單 <span>↗</span></a>
          </>}
        </div>
      </section>

      <section className={`policy ${siteView !== "licence" ? "site-hidden" : ""}`} id="licence">
        <button className="back-to-hub" onClick={() => onHome()}>← 回首頁</button>
        <div className="section-heading"><div><span className="section-kicker">LICENCE</span><h2>資料授權</h2></div><p>各來源的授權條款與引用方式</p></div>
        <div className="policy-body">
          <h3>政府開放資料</h3>
          <p>校園性別事件通報與調查統計來自臺北市政府主計處時間數列統計，依政府資料開放授權條款第 1 版使用。全國性平調查專業人才名冊來自教育部公開名冊。使用這些資料時請保留來源標示，並以原始機關公告的版本為準。</p>

          <h3>司法院裁判書</h3>
          <p>裁判統計來自司法院資料開放平台的裁判書資料集與裁判書開放 API，依政府資料開放授權條款第 1 版使用。本站保留案由、案號、裁判日期、署名法官與主文摘要，不重製裁判全文。定罪率、刑期分布等數字是本站從主文判讀後計算的，不是司法院發布的統計，判準與限制列於「資料來源與涵蓋範圍」頁。統計呈現的是歷來的裁判樣態，不代表法官的立場、能力或個案的最終評價。查閱裁判原文請至司法院裁判書系統。</p>

          <h3>新聞索引</h3>
          <p>新聞的文字、圖片與影音著作權均屬公視或原權利人所有。本站只保存標題、短摘要與原始連結，不重製內文與影音，所有連結都指回公視原始頁面。若權利人認為索引方式有疑義，請循資料更正與下架頁面所列的方式告知。</p>

          <h3>本站自行撰寫的內容</h3>
          <p>受害者專區的流程整理、期限對照與程序說明由本站撰寫，整理自性別平等教育法、校園性別事件防治準則與公開裁判所示原則。歡迎在標示出處的前提下轉載、印製或改編給需要的人使用；若要用於商業用途，請先告知。</p>

          <h3>引用本站</h3>
          <p>本站是二手整理，不是原始出處。引用具體數字、條文或程序規定時，請一併查核並註明原始機關的公告，因為法規與統計都會更新，而本站的擷取時間可能落後。所有流程說明都不取代個案法律意見。</p>
        </div>
      </section>
    </>
  );
}
