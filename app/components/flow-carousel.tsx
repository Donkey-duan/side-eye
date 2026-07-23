"use client";

import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";

// 流程步驟改為橫向卡片：一次專注一步，前後步驟露邊淡出。
// 目前置中的卡片由 IntersectionObserver 標記，不靠捲動事件輪詢。
type StepCardProps = { className?: string; "data-step-hint"?: string };

// 只捲動這個容器，不用 scrollIntoView，避免連帶把整頁往上下推。
function centerCard(scroller: HTMLOListElement, card: HTMLLIElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scroller.scrollTo({
    left: card.offsetLeft - (scroller.clientWidth - card.offsetWidth) / 2,
    behavior: reduced ? "auto" : "smooth",
  });
}

export default function FlowCarousel({ label, compact = false, children }: { label: string; compact?: boolean; children: ReactNode }) {
  const scrollerRef = useRef<HTMLOListElement>(null);
  const [index, setIndex] = useState(0);
  const steps = Children.toArray(children);
  const count = steps.length;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const cards = Array.from(scroller.querySelectorAll<HTMLLIElement>("li"));
    // 記錄每張卡片的可見比例，取最大的那張當作目前這一步。
    // 若改用「最後一個 isIntersecting 的 entry」，多張同時可見時會互相覆蓋，
    // index 會停在錯誤的位置，讓上一步／下一步變成無作用的按鈕。
    const ratios = new Map<Element, number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) ratios.set(entry.target, entry.intersectionRatio);
      let best = 0;
      let bestRatio = -1;
      cards.forEach((card, position) => {
        const ratio = ratios.get(card) ?? 0;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          best = position;
        }
      });
      setIndex(best);
    }, { root: scroller, threshold: [0, 0.25, 0.5, 0.75, 0.9, 1] });
    cards.forEach((card) => observer.observe(card));

    // 點前後卡片直接滑過去。用事件委派掛在容器上，而不是在 render 期間
    // 替每張卡片建立會存取 ref 的 onClick 閉包。
    const handleClick = (event: MouseEvent) => {
      const card = (event.target as HTMLElement).closest("li");
      if (card instanceof HTMLLIElement && scroller.contains(card)) centerCard(scroller, card);
    };
    scroller.addEventListener("click", handleClick);

    return () => {
      observer.disconnect();
      scroller.removeEventListener("click", handleClick);
    };
  }, [count]);

  function goTo(target: number) {
    const scroller = scrollerRef.current;
    const card = scroller?.querySelectorAll<HTMLLIElement>("li")[target];
    if (scroller && card) centerCard(scroller, card);
  }

  return (
    <div className="flow-carousel">
      <ol className={compact ? "flow-steps compact-flow" : "flow-steps"} ref={scrollerRef} tabIndex={0} aria-label={`${label}步驟，共 ${count} 步，可左右捲動`}>
        {steps.map((step, position) => {
          if (!isValidElement(step)) return step;
          const isActive = position === index;
          const hint = position === index - 1 ? "← 上一步" : position === index + 1 ? "下一步 →" : `跳到第 ${position + 1} 步`;
          return cloneElement(step as ReactElement<StepCardProps>, {
            key: position,
            className: isActive ? "is-active" : undefined,
            "data-step-hint": hint,
          });
        })}
      </ol>
      <div className="flow-nav">
        <button onClick={() => goTo(index - 1)} disabled={index === 0}>← 上一步</button>
        <div className="flow-dots">
          {Array.from({ length: count }, (_, dot) => (
            <button key={dot} className={dot === index ? "is-current" : ""} onClick={() => goTo(dot)} aria-label={`第 ${dot + 1} 步`} aria-current={dot === index ? "step" : undefined} />
          ))}
        </div>
        <span className="flow-count">{index + 1} / {count}</span>
        <button onClick={() => goTo(index + 1)} disabled={index >= count - 1}>下一步 →</button>
      </div>
    </div>
  );
}
