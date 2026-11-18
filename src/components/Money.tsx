import { CASH_SYMBOL, type Cash } from "../services/money";

/** Importe con símbolo y color propios: «$» verde (limpio) y «₡» marrón (sucio). */
export function Money({
  amount,
  kind,
  className = "",
}: {
  amount: number;
  kind: Cash;
  className?: string;
}) {
  return (
    <span
      className={`num font-black ${kind === "clean" ? "text-green-800" : "text-amber-900"} ${className}`}
      aria-label={`${amount} ${kind === "clean" ? "limpios" : "sucios"}`}
    >
      {CASH_SYMBOL[kind]}
      {amount}
    </span>
  );
}
