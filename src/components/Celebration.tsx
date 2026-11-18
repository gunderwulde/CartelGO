import { useEffect, type CSSProperties } from "react";
import { useCelebrateStore } from "../store/celebrateStore";

const SHOW_MS = 1800;
const SPARKS = ["✨", "⭐", "✨", "💥", "⭐", "✨"];

/** Destello de éxito: no bloquea toques y desaparece solo */
export default function Celebration() {
  const n = useCelebrateStore((s) => s.n);
  const text = useCelebrateStore((s) => s.text);
  const clear = useCelebrateStore((s) => s.clear);

  useEffect(() => {
    if (!text) return;
    const t = window.setTimeout(clear, SHOW_MS);
    return () => window.clearTimeout(t);
  }, [n, text, clear]);

  if (!text) return null;
  return (
    <div
      className="fixed inset-x-0 top-[30%] z-[47] flex justify-center pointer-events-none px-4"
      role="status"
      aria-live="polite"
    >
      <div
        key={n}
        className="celebrate-pop relative cartoon-card bg-yellow-300! px-4 py-3 text-center max-w-xs"
      >
        <p className="text-lg font-black leading-tight">{text}</p>
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className="celebrate-spark"
            style={
              {
                "--a": `${i * 60}deg`,
                animationDelay: `${i * 40}ms`,
              } as CSSProperties
            }
            aria-hidden
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
