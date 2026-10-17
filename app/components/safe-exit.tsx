"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const LEAVE_URL = "https://www.google.com.tw/";
const DIARY_URL = "https://nuannuansunshine.org/%e5%90%8c%e8%a1%8c%e6%97%a5%e8%a8%98/";

// 全站的「回到現在」安全出口。瀏覽者被內容勾起情緒時，可以先緩一緩，或直接離開本站。
// 焦點鎖定、Esc 關閉、body 捲動鎖定與關閉後焦點返回，做法同 MethodDialog，
// 這些瀏覽器不會代勞，缺一項鍵盤使用者就會迷失在背景頁面裡。
function SafeExitDialog({ onClose, triggerRef }: { onClose: () => void; triggerRef: RefObject<HTMLButtonElement | null> }) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // 部分瀏覽器（如 Safari）點按鈕不會讓它取得焦點，此時退回用觸發按鈕本身
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && active !== document.body ? active : triggerRef.current;
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
  }, [onClose, triggerRef]);

  // 只在事件處理函式裡碰 window：靜態輸出會在建置時預先渲染，render 期間沒有 window
  const leave = () => {
    window.location.replace(LEAVE_URL);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal safe-exit-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="safe-exit-title" onClick={(event) => event.stopPropagation()}>
        <span className="section-kicker">SAFE EXIT</span>
        <h2 id="safe-exit-title">你在看網頁，可以先停下來</h2>
        <p>這一頁不會跑掉，不用急著看完。如果是回憶或情緒突然湧上來，下面是倖存者常用的幾個緩和方法，挑一個做就好，做完覺得還不夠也沒關係；如果是身邊的人或環境讓你不安全，直接用下面的離開按鈕。</p>
        <ol className="safe-exit-methods">
          <li><strong>讓感官帶你回來</strong><p>看看四周，隨機挑三樣東西，說出它們的形狀和顏色；閉上眼睛聽周圍的聲音三十秒；喝一口水或含一顆糖，感覺它的味道和溫度。</p></li>
          <li><strong>感覺身體</strong><p>用冷水洗把臉，或拿冰塊敷在脖子靠近下巴的位置，感覺冰涼；站不起來就坐著，把雙腳用力踏在地上；也可以把手放在胸口或額頭，停留一會，感覺溫度和呼吸的起伏。</p></li>
          <li><strong>用呼吸放慢</strong><p>用鼻子慢慢吸氣數到四，再從嘴巴慢慢吐氣數到六，重複到稍微舒緩為止，注意力放在吸與吐上。</p></li>
          <li><strong>說出此刻</strong><p>跟自己說：現在是幾年幾月幾日、幾點幾分，我是誰，我人在哪裡。然後說「現在，我很安全」。</p></li>
        </ol>
        <p className="safe-exit-escalate">如果還是很不舒服，先離開這個網站，找信任的人說說話。113 保護專線 24 小時有人接；有立即危險時打 110。</p>
        <div className="modal-actions safe-exit-actions">
          <button className="primary" type="button" onClick={onClose}>我好一些了，回到頁面</button>
          <button className="safe-exit-leave" type="button" onClick={leave}>離開本站，前往 Google</button>
        </div>
        <p className="safe-exit-note">離開後本站仍會留在瀏覽器的紀錄裡，需要時請清除紀錄或改用無痕視窗。</p>
        <p className="safe-exit-credit">緩和方法參考暖暖 Sunshine《同行日記》「一起回到現在」一節，文字為本站改寫。<a href={DIARY_URL} target="_blank" rel="noreferrer">前往同行日記 ↗<span className="sr-only">（另開新分頁）</span></a></p>
      </section>
    </div>
  );
}

export default function SafeExit() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // 穩定的參考，否則對話框的 effect 每次 render 都會重跑並把焦點搶走
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button ref={triggerRef} type="button" className="safe-exit-button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>回到現在</button>
      {open && <SafeExitDialog onClose={close} triggerRef={triggerRef} />}
    </>
  );
}
