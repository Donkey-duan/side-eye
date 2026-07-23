"use client";

import { useEffect, useRef } from "react";

// 資料方法彈窗。需自行處理 Esc 關閉、焦點鎖定與關閉後的焦點返回——
// 這些瀏覽器不會代勞，缺一項鍵盤使用者就會迷失在背景頁面裡。
export default function MethodDialog({ onClose, onOpenCorrections }: { onClose: () => void; onOpenCorrections: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(
      dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    );
    focusable()[0]?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="method-title" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="關閉">×</button>
        <span className="section-kicker">DATA POLICY</span>
        <h2 id="method-title">資料收錄與更正原則</h2>
        <ol>
          <li><strong>只收錄官方公開來源</strong><p>目前的來源是臺北市政府開放統計、教育部公開名冊、司法院裁判書開放資料、公視新聞與運動部公告。每一項在「資料來源與涵蓋範圍」都列出權責機關、涵蓋範圍與更新頻率。</p></li>
          <li><strong>每個來源都標明現況</strong><p>本站沒有個別事件的跨來源索引，也不提供人物姓名查詢。每一項資料在「資料來源與涵蓋範圍」都列出權責機關、涵蓋範圍與更新頻率。</p></li>
          <li><strong>不轉錄私人資訊</strong><p>人才名冊只保留姓名、服務單位與職稱，未轉錄電話、電子郵件與證號。新聞只保存標題、短摘要與原始連結，不重製內文與影音。</p></li>
          <li><strong>本站算出來的數字會標明算法</strong><p>裁判統計不是機關發布的，是從裁判書全文判讀彙整的。判準、分母的取法與已知限制全部寫在「資料來源與涵蓋範圍」頁，每一筆判決也都附原始連結，可以逐筆檢驗。</p></li>
          <li><strong>統計不等於評價</strong><p>裁判統計呈現的是歷來的裁判樣態，不是對個案結果的預測，也不代表任何法官的立場或能力；人才名冊只代表具備調查資格。兩者都不是對個人的排名或評價。</p></li>
          <li><strong>可以要求更正</strong><p>若發現引用錯誤、來源標示有誤或內容需要更新，可循「資料更正與下架」頁面所列的方式提出，我們會保留異動紀錄。<button className="inline-jump" onClick={onOpenCorrections}>前往資料更正與回報 →</button></p></li>
        </ol>
        <div className="modal-actions">
          <button className="primary" onClick={onClose}>我了解了</button>
        </div>
      </section>
    </div>
  );
}
