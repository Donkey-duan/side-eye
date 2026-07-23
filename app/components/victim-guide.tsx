"use client";

import type { ReactNode } from "react";
import type { SiteView, VictimView } from "../routes";
import FlowCarousel from "./flow-carousel";

/**
 * 受害者專區的靜態內容：專區首頁、細節頁（安全計畫／證據保存／申復救濟／心理支持）、
 * 兩條流程頁，以及行動準備與權利時限。全國性平委員名冊因為帶有搜尋與分頁狀態，
 * 留在 SiteView。
 */
export default function VictimGuide({ siteView, victimView, onOpen, pager }: {
  siteView: SiteView;
  victimView: VictimView;
  onOpen: (view: VictimView) => void;
  pager: ReactNode;
}) {
  return (
    <>
      <section className={`campus-hub ${siteView !== "victim" ? "site-hidden" : ""}`} id="campus-hub">
        <div className="section-heading campus-heading"><div><span className="section-kicker">VICTIM SUPPORT</span><h2>我是受害者</h2></div><p>先確認安全，再選擇適合你的行動路徑</p></div>
        <div className="urgent-strip" role="region" aria-label="緊急求助">
          <div className="urgent-copy">
            <strong>有立即人身危險</strong>
            <p>如果對方就在附近、正在跟蹤你，或你擔心現在就會受到傷害，先打電話，其他事之後再處理。</p>
          </div>
          <div className="urgent-actions">
            <div><b>110</b><small>報警</small></div>
            <div><b>113</b><small>保護專線・24 小時</small></div>
          </div>
        </div>
        <div className={victimView === "home" ? "victim-home" : "victim-hidden"}>
          <div className="campus-intro"><strong>這不是你的錯，你也不必一次做完所有決定。</strong><p>報警、就醫、尋求社工協助與校園性平申請是不同程序，可以依事件與需要分別或同時進行。這裡先幫你看懂每一條路會發生什麼。</p></div>
          <div className="first-steps">
            <h3>如果不知道從哪開始，先做這幾件</h3>
            <p className="first-steps-lead">前三件有時效、越快越好；第四件之後才是選擇路徑，沒有一定順序。不必一次做完，做得到的先做。</p>
            <ol className="first-steps-list">
              <li>
                <strong>先確認安全</strong>
                <p>如果現在有危險、對方就在附近，先撥 110 報警或 113 保護專線，其他事之後再處理。</p>
              </li>
              <li>
                <strong>盡快保全證據</strong>
                <p>截圖對話（不要只留匯出的文字檔）、保留照片與影片的原始檔。若涉及性侵害，盡快就醫並告知需要驗傷採證——採證有時效，盡量在清洗、更衣或如廁前先就醫。</p>
              </li>
              <li>
                <strong>趁記憶清楚記下時間軸</strong>
                <p>寫下人、事、時、地與經過，不確定的地方標「約略」或「目前不記得」，不要為了看起來完整而猜測。</p>
              </li>
              <li>
                <strong>再決定要走哪些程序</strong>
                <p>報警與刑事、校園性平申請、社工與心理協助是不同的路，可以分別或同時進行。下面每一張卡片會說明各條路會發生什麼、有哪些時限。</p>
              </li>
            </ol>
          </div>
          <div className="browse-safe">
            <strong>安全地看這個網站</strong>
            <p>本站不會記錄你看了什麼，但你的裝置與瀏覽器會留下紀錄。如果擔心有人查看你的裝置：</p>
            <ul className="safe-list">
              <li>用無痕／私密視窗瀏覽</li>
              <li>看完後清除這個網站的瀏覽紀錄</li>
              <li>或改用對方接觸不到的裝置</li>
              <li>需要時可直接關閉分頁離開</li>
            </ul>
          </div>
          <div className="campus-cards-lead">
            <h3>依你的情況，挑需要的看</h3>
            <p>下面每一張是一個主題的詳細說明。號碼只是編號，不是要照順序執行——挑跟你現在處境相關的看就好，隨時可以回到這裡換一項。</p>
          </div>
          <nav className="campus-cards" aria-label="我是受害者專區選項">
            <button onClick={() => onOpen("safety")}><b>01</b><span><strong>先做安全計畫</strong><small>對方得知後的跟蹤、施壓與暴力升高風險</small></span><i>→</i></button>
            <button onClick={() => onOpen("evidence")}><b>02</b><span><strong>證據保存與送件</strong><small>原始檔、完整畫面、目錄與收件確認</small></span><i>→</i></button>
            <button onClick={() => onOpen("police")}><b>03</b><span><strong>一般報警／刑事程序</strong><small>現場等待、筆錄、通知與長期偵查</small></span><i>→</i></button>
            <button onClick={() => onOpen("campus")}><b>04</b><span><strong>校園性平申請</strong><small>受理、證據提示、訪談、結果與申復</small></span><i>→</i></button>
            <button onClick={() => onOpen("appeal")}><b>05</b><span><strong>申復與後續救濟</strong><small>法定門檻、六款重大瑕疵與申復之後的申訴</small></span><i>→</i></button>
            <button onClick={() => onOpen("preparation")}><b>06</b><span><strong>行動準備清單</strong><small>出發前逐項確認安全、證據與陪同</small></span><i>→</i></button>
            <button onClick={() => onOpen("rights")}><b>07</b><span><strong>時限與權利提醒</strong><small>受理、調查、申復期限與可要求的協助</small></span><i>→</i></button>
            <button onClick={() => onOpen("mental")}><b>08</b><span><strong>心理準備與支持</strong><small>面對等待、重述、質疑與程序後的耗竭</small></span><i>→</i></button>
            <button onClick={() => onOpen("talent")}><b>09</b><span><strong>全國性平委員</strong><small>搜尋教育部公開調查專業人才名冊</small></span><i>→</i></button>
          </nav>
        </div>
      </section>

      <section className={`victim-detail ${siteView !== "victim" || (victimView !== "safety" && victimView !== "evidence" && victimView !== "appeal" && victimView !== "mental") ? "victim-hidden" : ""}`} id="victim-detail">
        <button className="back-to-hub" onClick={() => onOpen("home")}>← 回專區首頁</button>
        {victimView === "safety" && <div>
          <div className="section-heading"><div><span className="section-kicker">SAFETY FIRST</span><h2>報案或申請前，先評估風險會不會升高</h2></div><p>通知對方後，風險可能改變</p></div>
          <div className="danger-callout"><strong>如果你擔心對方得知後會堵人、跟蹤、傷害或殺害你</strong>
            <ol className="callout-list">
              <li>不要單獨跟對方聯絡、對質，或用見面換取道歉</li>
              <li>先撥 110 或 113 討論安全計畫，再決定下一步</li>
              <li>用對方無法查看的裝置聯絡</li>
              <li>讓可信任的人知道你的行程，以及失聯時該怎麼處理</li>
            </ol>
          </div>
          <div className="detail-grid"><article><h3>需要提高警覺的訊號</h3><ul><li>不接受你要求停止聯絡、給空間或改用文字溝通</li><li>出現在住處、教室、工作地或必經路線等待你</li><li>透過限時動態、摯友、共同朋友或小帳號間接施壓</li><li>知道你報案、分手、拒絕或求助後，情緒與控制行為升高</li><li>掌握你的門禁、鑰匙、定位、班表，或曾威脅你與身邊的人</li></ul></article><article><h3>立即可做的安排</h3><ul><li>改走明亮且有人流的路線，安排結伴、接送與緊急住宿</li><li>關閉定位分享，檢查登入裝置、備援信箱與雙重驗證</li><li>把跟蹤、堵人、威脅與社群施壓逐次截圖並記錄時間地點</li><li>以書面要求校方／雇主提供門禁、動線、課業或工作區隔</li><li>約定暗號；準備證件、藥物、現金、鑰匙與充電設備</li></ul></article></div>
          <p className="legal-note">防狼用品不能取代撤離與求助計畫；攜帶及使用前請確認當地法規、場所規定與自身操作安全。</p>
        </div>}
        {victimView === "evidence" && <div>
          <div className="section-heading"><div><span className="section-kicker">EVIDENCE WORKFLOW</span><h2>不要只蒐集證據，也要確保它真的被收到與看見</h2></div><p>保留原始檔、建立目錄、逐次確認</p></div>
          <div className="detail-grid"><article><h3>保存原則</h3><ul><li>以截圖為主。截圖保留完整螢幕、帳號、日期時間與前後對話，不先裁切或加字</li><li>一段對話分成多張截圖時，讓每一張的最上面重疊到上一張的最下面（重複一兩則訊息），證明截圖是連續的、中間沒有刪去或跳過訊息</li><li>LINE 對話不要只留匯出的文字檔。匯出檔是純文字，看不出頭像、訊息順序、時間戳與收回痕跡，也容易被質疑可修改；截圖才留得住介面脈絡</li><li>匯出的文字紀錄仍可另存一份備用，便於檢索與製作時間軸，但不要當成唯一或主要的證據形式</li><li>照片、影片與 Email 保存原始檔；所有資料另做至少一份安全備份</li><li>製作時間軸；不確定處標示「約略」或「目前不記得」</li><li>就醫、諮商、日記可記錄事件後的身心狀況，但任何單一資料都不是自動成立的保證</li></ul></article><article><h3>送件原則</h3><ul><li>每份檔案編號、標頁碼並附一頁目錄，寫明它要證明什麼</li><li>對話紀錄列印或排版時，一張 A4 最多放兩張截圖，讓字夠大、看得清楚；一頁塞太多張會小到難以辨識，反而削弱證據力</li><li>自行保留與送件版本完全相同的副本，不把唯一原檔交出去</li><li>要求收件日期、附件清單或Email回條；補件也另留紀錄</li><li>訪談前再次確認委員實際取得哪些附件，別假設所有資料都已轉交</li></ul></article></div>
          <div className="danger-callout">
            <strong>事發後告訴信任的人，並留下對話紀錄</strong>
            <p>這不只是情緒支持。性騷擾與性侵害多半發生在只有兩人的場合，缺少目擊者與直接證據，<b>實務上因此重視「事後反應」與「周遭親友的觀察」作為補強證據</b>。</p>
            <ol className="callout-list">
              <li>單純轉述你說了什麼，和你自己的陳述屬於同一件事，不能當作補強</li>
              <li>但那段對話若能推論你當下的心理狀態與認知，或證明事件對你造成的影響，就是適格的補強證據</li>
              <li>還沒打算採取法律行動之前留下的紀錄，可信度特別高，因為沒有事後編造的動機</li>
            </ol>
            <p>所以即使還沒決定要不要提告或申請，先跟人講，並把對話留著。</p>
          </div>
          <div className="process-warning"><b>跨程序陳述</b>
            <p>警方、檢察官與性平訪談可能相隔數月，事先保存每次陳述與時間軸，可以降低遺忘造成的壓力。</p>
            <ol className="callout-list">
              <li>後來想起新細節，清楚標示何時想起與更正的原因</li>
              <li>不要為了看起來「完全一致」而猜測填補</li>
              <li>細節有出入不當然否定你的證詞——實務見解認為被害人記憶會隨時間淡忘，只要對基本事實已具體描述且有補強證據擔保，不得僅因細節瑕疵就摒棄全部證詞</li>
            </ol>
          </div>
          <div className="process-warning"><b>訪談之後索取自己的逐字稿</b>
            <p>調查報告可能寫「委員提示證據，當事人確認無誤並簽名」，但那句話的實際情形只有逐字稿看得出來——你簽名確認的可能只是幾張截圖，而不是完整影像。</p>
            <ol className="callout-list">
              <li>逐字稿是日後證明「程序未給你充分陳述機會」最直接的依據</li>
              <li>可據以詢問對方被訪談了幾次、被提示了哪些證據、以什麼方式提示</li>
              <li>雙方受到的提示是否對等，是判斷程序有無瑕疵的關鍵</li>
            </ol>
          </div>
        </div>}
        {victimView === "appeal" && <div>
          <div className="section-heading"><div><span className="section-kicker">APPEAL &amp; REMEDY</span><h2>申復不是請委員再看一次，而是指出瑕疵或新證據</h2></div><p>逐條對照法定要件</p></div>
          <div className="danger-callout">
            <strong>申復有法定門檻，只表達不服通常不夠</strong>
            <p>性別平等教育法第 37 條第 3 項規定，除非發現調查程序有重大瑕疵，或有足以影響原調查認定的新事實、新證據，否則不得要求性平會重新調查。申復的功能本來就不是在程序中自行再調查一次事實，所以重述一遍經歷、說明自己有多不服，多半不會構成申復理由。要能明確指出哪一個程序出錯，或哪一份證據應該調查卻沒有調查。</p>
          </div>
          <h3 className="block-title">「調查程序有重大瑕疵」的六種法定情形</h3>
          <p className="block-lede">校園性別事件防治準則第 32 條第 5 項明定，符合以下任一種即屬重大瑕疵。寫申復時逐條對照，比長篇陳述有效。</p>
          <ol className="defect-list">
            <li><b>01</b><div><strong>性平會或調查小組組織不適法</strong><p>組成人數、性別比例或成員專業資格不符規定。</p></div></li>
            <li><b>02</b><div><strong>未給予當事人任一方陳述意見之機會</strong><p>包含形式上有訪談，但關鍵證據從未提示給你、也沒讓你就該證據表示意見。</p></div></li>
            <li><b>03</b><div><strong>有應迴避而未迴避之情形</strong><p>調查人員與當事人有師生、指導、任職或其他足以影響公正的關係。</p></div></li>
            <li><b>04</b><div><strong>有應調查之證據而未調查</strong><p>你提出的資料被完全略過、未在報告中審酌，也沒有說明不採的理由。</p></div></li>
            <li><b>05</b><div><strong>有證據取捨瑕疵而影響事實認定</strong><p>只採用對一方有利的片段，或把不利於你的推測當成已認定的事實。</p></div></li>
            <li><b>06</b><div><strong>其他足以影響事實認定之重大瑕疵</strong><p>概括條款，用於前五款未涵蓋但同樣影響結論的程序問題。</p></div></li>
          </ol>
          <div className="detail-grid">
            <article><h3>什麼算「新事實、新證據」</h3><ul><li>原調查時已存在，但在該程序中未經調查審酌的資料</li><li>因行政程序法第 128 條第 3 項修正，處分作成「之後」才出現或成立的證據也算</li><li>所以調查結束後才找到的對話、紀錄或證人，仍可以在申復時提出</li><li>提出時要說明它指向哪一項待證事實，以及為什麼足以影響原本的認定</li></ul></article>
            <article><h3>申復不是最後一關</h3><ul><li>不服申復決定，可依性別平等教育法第 39 條提起申訴</li><li>期限是申復決定書送達的次日起 30 日內</li><li>學生向學校的學生申訴評議委員會提出；其他身分依所屬管道</li><li>申復決定若認為有理由，性平會應重新調查，重啟後一樣適用兩個月的調查期限</li><li>針對「不受理」的申復，以一次為限</li></ul></article>
          </div>
          <div className="process-warning"><b>性平調查的認定標準低於刑事</b><p>這是「性平調查不受刑事程序結果影響」的真正原因。刑事案件要求超越合理懷疑，而校園性平的行政調查門檻較低，且依事件類型不同：性騷擾與性霸凌採「明確合理之法則」，也就是一般理性之人在相同證據上都會認為有此可能即足以認定；性侵害則採「優勢證據法則」，也就是有性侵害的可能性大於沒有時即可認定。兩者都低於刑事的確信門檻，<b>所以檢察官不起訴或法院判決無罪，不代表性平事件就不成立</b>，證明門檻本來就不同。反過來說，行政調查仍須憑證據，不能僅以推測認定。要提醒的是，門檻較低並不保證結果較寬鬆——認定仍取決於委員的自由心證，實務上出現刑事程序認定有罪、性平卻認定不成立的情形確實存在。詳見專區的「心理準備與支持」。</p></div>
          <div className="detail-grid">
            <article><h3>性侵害不成立，不等於性騷擾不成立</h3><ul><li>性別平等教育法把性騷擾定義為「未達性侵害之程度」的情形，兩者是層級關係</li><li>因此認定不構成性侵害之後，仍應繼續審究是否構成性騷擾</li><li>行為若屬不受歡迎且與性或性別有關，就有成立性騷擾的空間</li><li>另可能涉及性騷擾防治法第 25 條：意圖性騷擾，乘人不及抗拒而為親吻、擁抱或觸摸臀部、胸部或其他身體隱私處</li><li>申請時可同時主張性侵害與性騷擾，不必只勾一種</li></ul></article>
            <article><h3>關於「積極同意」，要有正確的期待</h3><ul><li>「沒有得到清楚的同意就是不同意」是倡議與修法方向，實務判決也已多次援引</li><li>但刑法第 221 條強制性交罪與第 224 條強制猥褻罪，目前仍以強制手段違反意願為構成要件</li><li>未使用強制手段、也未取得積極同意的行為，在修法前不當然構成這兩條罪</li><li>這不表示你沒有受到侵害——它仍可能構成性騷擾，也仍可能在性平程序中被認定</li><li>先了解這個落差，可以避免把刑事結果誤讀成「事情沒有發生」</li></ul></article>
          </div>
          <p className="legal-note">本頁整理自性別平等教育法、校園性別事件防治準則與公開裁判所示原則，不取代個案法律意見。實際適用條文、管轄與救濟方式，請以你收到的正式書面通知及最新法規為準。</p>
        </div>}
        {victimView === "mental" && <div>
          <div className="section-heading"><div><span className="section-kicker">MENTAL PREPARATION</span><h2>程序可能很久，也可能讓你再次回到事件裡</h2></div><p>先替訪談後與等待期留出空間</p></div>
          <div className="encouragement"><strong>你不需要有完美記憶、完美反應，才值得被好好對待。</strong><p>僵住、順應、沒有尖叫、事後仍維持表面互動，或隔一段時間才理解發生了什麼，<b>都不等於同意</b>。結果不如預期，也不會抹去你的感受與經歷。</p></div>
          <div className="detail-grid"><article><h3>訪談前</h3><ul><li>列出最重要的三件事、容易觸發的問題與希望採取的休息方式</li><li>安排陪同、交通與訪談後不必立刻工作／上課的時間</li><li>帶水、藥物、充電設備與能讓自己穩定的物品</li></ul></article><article><h3>等待期間</h3><ul><li>把「尚未通知」與「案件沒有進行」分開，不用每天獨自猜測</li><li>設定固定查詢頻率與聯絡窗口，保存每次詢問日期</li><li>若出現失眠、惡夢、呼吸困難、無法進食或工作等狀況，尋求醫療或心理協助</li></ul></article></div>
          <div className="process-warning"><b>認定會受委員主觀判斷影響，先有這個預期</b><p>性平調查沒有陪審團，事實由調查委員依自由心證認定。同一份證據交給不同委員，結論可能不一樣，這是制度本身就存在的空間，不是你哪裡沒做好。行政調查的證明門檻雖然低於刑事，<b>但門檻低不等於比較容易成立</b>——實務上出現刑事程序認定有罪、性平調查卻認定不成立的情況並不少見，反過來也有。委員與行為人可能同屬教育或學術領域，也可能對行為人產生同理、不願讓對方因此留下永久紀錄；學校本身也可能有聲譽上的考量。這些因素不必然出現在你的個案裡，但它們是結構上真實存在的風險，事先知道，比事後才發現要好受一些。</p></div>
          <div className="process-warning"><b>不成立，不等於事情沒有發生</b><p>調查結果是那幾位委員依現有證據所做的判斷，<b>不是對你的經歷所下的定論，也不是對你這個人的評價</b>。你受到的傷害不會因為一份不成立通知而消失，你的感受也不需要別人認定才算數。如果認為程序或證據取捨有問題，還有申復與申訴可以走；如果決定不再往下走，那也是一個正當的選擇——把力氣留給自己的生活，不是放棄，是另一種照顧自己的方式。</p></div>
          <div className="process-warning"><b>遇到質疑式問題時</b><p>你可以要求對方說明問題與待查事實的關聯、換一種問法、暫停休息，並在紀錄中補充「當時為何僵住、順應、沒有離開或仍需與對方接觸」。這不是要求你替他人的偏見負責，而是避免重要脈絡被省略。</p></div>
        </div>}
        {pager}
      </section>

      <section className={`application-flow victim-${victimView} ${siteView !== "victim" || (victimView !== "police" && victimView !== "campus") ? "victim-hidden" : ""}`} id="application-flow">
        <div className="section-heading"><div><span className="section-kicker">CHOOSE YOUR PATH</span><h2>求助與申請流程</h2></div><p>兩條路可以同時進行，並非只能選一種</p></div>
        <button className="back-to-hub" onClick={() => onOpen("home")}>← 回專區首頁</button>
        <div className="flow-track" id="police-flow"><h3>一般報警／刑事程序</h3><p>適用範圍不限校園。是否構成犯罪由檢警與法院依法判斷；報案不要求你先自行完成法律定性。</p></div>
        <FlowCarousel label="一般報警／刑事程序">
          <li><b>01</b><div><strong>報案前先更新安全計畫</strong><p>對方被警方通知後，跟蹤、堵人或施壓的風險可能改變。先決定安全住處、同行方式、校園／職場窗口及遇到對方時的撤離方法。</p><small>有立即危險撥 110；需要保護服務或社工協助可撥 113。不要為蒐證而單獨對質。</small></div></li>
          <li><b>02</b><div><strong>到場、初步說明與可能轉介</strong><p>可到派出所或撥 110。部分案件可能轉由較大或具專責人力的單位製作筆錄；先詢問承辦地點、交通與是否可安排陪同，避免來回奔波。</p><small>接待可能很快，但等候正式筆錄可能達數小時。帶證件、藥物、水、充電器，並預留整段時間。</small></div></li>
          <li><b>03</b><div><strong>就醫、驗傷與身心照顧</strong><p>有身體不適或涉及性侵害時，可前往醫療院所診療與驗傷採證。即使沒有外傷、已洗澡或換衣，仍可求醫、報案並說明其他證據。</p><small>若後續出現惡夢、恐慌、呼吸困難或無法生活，可就醫並保留真實診療紀錄；診斷是照顧與狀況紀錄，不保證個案結論。</small></div></li>
          <li><b>04</b><div><strong>製作筆錄：會問得很細</strong><p>問題可能涉及接觸部位、力道、言語、同意、拒絕、僵住或事後互動，用來判斷可能適用的法律。聽不懂可要求改問，記不得就說不確定。</p><small>筆錄可能四十分鐘以上，複雜案件更久。可要求休息、陪同與補充；被問細節不代表你應受責怪。</small></div></li>
          <li><b>05</b><div><strong>簽名前逐字核對</strong><p>確認用詞符合原意、時間標示是否為確定或約略、附件是否列全；錯誤應當場要求修改。保留報案證明、案件編號、承辦人與聯絡方式。</p><small>把當天提交的檔案另存同版本副本；不要把唯一原始證據交出去。</small></div></li>
          <li><b>06</b><div><strong>拿到報案證明單，當場檢查再離開</strong><p>受理人員與單位審核人員都必須用印，兩個章缺一張單子就無效。案類與案號要看清楚並拍照留存；如果涉及多項罪名，單子上因欄位限制最多只顯示三項，這不影響其他罪名的偵辦。這張單子只是受理登記，不是案件進度證明。</p><small>性侵害案件的報案人姓名會以代號取代，連簽名欄也是簽代號，你的真實姓名不會出現在單子上——記住自己的代號，後續查詢會用到。報案兩日後可自行至警政署網站查詢報案紀錄。單上「謊報案件得處七年以下有期徒刑」是針對虛偽報案的制式警語；照實陳述、記不清楚就說不確定，不會因此觸法。</small></div></li>
          <li><b>07</b><div><strong>移送、檢察署與法院：可能長期等待</strong><p>後續可能收到電話、警方聯絡或檢察署傳票，再次說明事件。刑事程序沒有統一的實際完成時間，可能數月、超過一年甚至更久。</p><small>傳票通常會載明時間、地點與攜帶文件。固定頻率查詢、記錄每次聯絡，不要把長時間無消息解讀成你的案件不重要。</small></div></li>
        </FlowCarousel>
        <div className="flow-track campus-track" id="campus-flow"><h3>校園性平申請</h3><p>原則上向行為人所屬學校提出；行為人現在或曾是校長時，向學校主管機關提出。</p></div>
        <FlowCarousel label="校園性平申請" compact>
          <li><b>01</b><div><strong>確認管轄、收件單位與收件日</strong><p>下載正式申請書，以Email或可留紀錄的方式送件；保存完整申請書、全部附件與寄送紀錄，要求確認收件日期。收件單位原則上應於三日內交付性平會處理。</p><small>報警與性平調查可以同時進行；性平調查不受司法程序是否進行或結果影響。</small></div></li>
          <li><b>02</b><div><strong>20 日內應書面通知是否受理</strong><p>不受理須說明理由與申復方式。逾期未收到通知，或收到不受理通知，可自期限屆滿或通知次日起 20 日內申復。</p><small>建立案件日誌：收件日、承辦人、每次通知與回覆期限。不要只靠口頭說法。</small></div></li>
          <li><b>03</b><div><strong>調查期：法定二個月，可延長兩次</strong><p>性平會應於受理後二個月內完成調查；必要時可延長兩次，每次不超過一個月，並應通知當事人。實際收到最終處理結果還可能包含後續議處時間。</p><small>每次延長都保存通知；若沒有通知，應書面詢問目前階段與新的預計日期。調查期間另有行為限制：防治準則規定當事人不得私下聯繫，也不得透過網路、通訊軟體或其他管道散布事件資訊。在社群上發文說明案情是有風險的，要說請找專業協助或信任的人私下說。</small></div></li>
          <li><b>04</b><div><strong>訪談前先核對附件與證據版本</strong><p>準備一頁證據目錄與頁碼，詢問委員實際收到哪些資料。若有影像、完整對話或長篇附件，確認不是只提示節錄或截圖，也確認你有充分陳述意見的機會。</p><small>看到什麼才簽什麼。簽名確認截圖，不等於確認未曾完整提示的原始影像。訪談後可索取自己的逐字稿，並詢問對方被訪談幾次、被提示了哪些證據；雙方受到的提示是否對等，日後是判斷程序有無重大瑕疵的關鍵，而報告中「已提示、當事人確認無誤」這類記載，只有逐字稿能還原實情。</small></div></li>
          <li><b>05</b><div><strong>訪談可能出現造成二度傷害的問題</strong><p>你可能被問「為何沒有尖叫／反抗」「為何之後仍互動」「體型差距為何會害怕」等。僵住、順應、維持日常或必須繼續上課工作，都不等於同意。</p><small>法律要求充分陳述與答辯，也要求避免重複詢問。可要求休息、說明問題關聯，並把當時的安全考量與身心反應寫入紀錄。</small></div></li>
          <li><b>06</b><div><strong>保護措施要寫清楚誰執行</strong><p>可要求減少雙方互動、彈性出缺勤或成績、課業／工作協助、命行為人迴避、心理、法律、經濟與社福協助，並避免報復及再度加害。</p><small>不要只接受「已提醒對方」。要求書面列明措施、開始日期、執行人與違反後的聯絡方式。</small></div></li>
          <li><b>07</b><div><strong>收到結果後 30 日內決定是否申復</strong><p>保存送達日期並索取完整書面理由。申復可整理程序瑕疵、未給充分陳述機會、未審酌完整證據、新事實或新證據；對處理結果不服的申復，原則上應於 30 日內書面通知結果。</p><small>申復不是重寫情緒，而是逐項對照：哪個程序、哪份證據、哪段理由有問題，以及它如何影響認定。防治準則把「重大瑕疵」明定為六款情形，逐條對照比長篇陳述有效；不服申復決定還可以再提申訴。詳見專區的「申復與後續救濟」。</small></div></li>
        </FlowCarousel>
        <div className="campus-only confidentiality-note">
          <strong>學校要你簽「保密切結書」，沒有法律拘束力</strong>
          <p>校園性別事件的保密義務，規範的是學校與參與處理的人員，不及於事件當事人本人。<b>學校不應再要求當事人簽署保密協議書或切結書；即使簽了，你也不是保密義務人。</b>（依教育部 102 年 11 月 7 日臺教學（三）字第 1020164059 號函，及校園性別事件防治準則關於保密義務範圍的規定。）</p>
          <p>但「沒有保密義務」不等於什麼都能公開講：</p>
          <ul className="safe-list">
            <li>調查進行中，仍應避免干擾調查、私下聯繫對方，或散布會影響調查的資訊（見上方流程第 3 步）</li>
            <li>任何時候，對外揭露對方或其他當事人「可辨識身分」的個人資料，可能涉及個人資料保護法</li>
            <li>指名道姓的貶損、辱罵或未經證實的指控，可能被以公然侮辱或誹謗提告</li>
          </ul>
          <p>你可以尋求協助、談論自己的遭遇，不受學校保密切結的拘束。但要公開到什麼程度、怎麼陳述，建議先與律師或撥 113 討論，分清「陳述自己的經歷」與「公開他人個資或人身攻擊」的界線。</p>
        </div>
        <p className="legal-note">本頁是一般程序導引，不取代個案法律意見；實際管轄與救濟方式請以收到的正式書面通知及最新法規為準。</p>
        {pager}
      </section>

      <section className={`support-tools support-${victimView} ${siteView !== "victim" || (victimView !== "preparation" && victimView !== "rights") ? "victim-hidden" : ""}`} id="preparation">
        <button className="back-to-hub" onClick={() => onOpen("home")}>← 回專區首頁</button>
        <div className="support-grid">
          <div><span className="section-kicker">PREPARATION</span><h2>每次行動前的準備清單</h2><ul><li><b>安全：</b>確認對方是否可能因通知而升高暴力；安排同行、交通、住宿與緊急聯絡人</li><li><b>證據：</b>原始檔另存、完整截圖、時間軸、頁碼目錄、附件清單與安全備份</li><li><b>等待：</b>帶證件、藥物、水、充電器；預留數小時及結束後休息時間</li><li><b>陳述：</b>分清楚確定、約略、不記得與後來想起；不為追求一致而猜測</li><li><b>收件：</b>每次提交都要日期與回條，核對承辦人實際收到的附件</li><li><b>紀錄：</b>保存案號、承辦人、電話、公文、傳票、延長通知與下一期限</li><li><b>身心：</b>安排陪同、就醫或諮商；寫下程序後可能出現的觸發反應與照顧方式</li></ul></div>
          <div id="rights-timeline"><span className="section-kicker">RIGHTS & TIMELINE</span><h2>性平期限與程序檢核</h2><ul><li><b>無申請期限：</b>校園性別事件沒有追訴期，不像刑事有時效限制；事隔多年、已畢業或對方已離職，仍可提出調查申請。惟行為人已非原校師生時管轄可能移轉，且越晚提出證據越難保全。</li><li><b>3 日：</b>收件單位原則上將事證資料交付性平會調查處理</li><li><b>20 日：</b>接獲申請或檢舉後，書面通知是否受理</li><li><b>不受理申復：</b>逾期未通知或收到不受理通知次日起 20 日內提出</li><li><b>調查 2 個月：</b>必要時可延長兩次，每次不超過一個月，且應通知</li><li><b>結果申復：</b>收到處理結果書面通知次日起 30 日內提出</li><li><b>申復門檻：</b>須有調查程序重大瑕疵，或足以影響認定的新事實、新證據</li><li><b>再提申訴：</b>不服申復決定，於決定書送達次日起 30 日內提起申訴</li><li><b>重啟調查：</b>申復有理由而重新調查者，一樣適用二個月的調查期限</li><li><b>充分陳述：</b>調查應給雙方充分陳述與答辯機會，並避免重複詢問</li><li><b>必要協助：</b>可要求受教權／工作權、心理、法律、課業、經濟與安全措施</li><li><b>司法並行：</b>性平調查不受刑事程序是否進行及結果影響</li></ul></div>
        </div>
        <div className="official-links"><a href="https://mohw.gov.tw/SS/cp-4530-63643-204.html" target="_blank" rel="noreferrer">衛福部性侵害求助指引 ↗</a><a href="https://dep.mohw.gov.tw/dops/np-1183-105.html" target="_blank" rel="noreferrer">113 保護專線 ↗</a><a href="https://www.gender.edu.tw/web/index.php/m7/m7_02_01_index" target="_blank" rel="noreferrer">教育部申請書與流程圖 ↗</a><a href="https://edu.law.moe.gov.tw/LawContent.aspx?id=FL030508" target="_blank" rel="noreferrer">性別平等教育法 ↗</a></div>
        {pager}
      </section>
    </>
  );
}
