import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

const SPEED_PX_PER_S = 30;

/**
 * One line of text that, when it doesn't fit, slides to its end and back so
 * the whole message can be read on a narrow screen. Text that fits stays
 * still. With "reduce motion" enabled it wraps instead.
 */
export function ScrollingText({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = textRef.current;
    if (!container || !inner) return;

    const measure = () => setOverflow(Math.max(0, inner.scrollWidth - container.clientWidth));
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  // Sliding there and back takes 70% of the cycle; the rest are pauses.
  const duration = Math.max(6, (2 * overflow) / SPEED_PX_PER_S / 0.7);
  const style = overflow > 0
    ? ({ "--marquee-distance": `-${overflow}px`, "--marquee-duration": `${duration}s` } as CSSProperties)
    : undefined;

  return (
    <div ref={containerRef} className={cn("marquee-container overflow-hidden whitespace-nowrap", className)}>
      <span ref={textRef} className={cn("inline-block", overflow > 0 && "animate-marquee")} style={style}>
        {text}
      </span>
    </div>
  );
}
