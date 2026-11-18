/** Duración legible: "2 h 5 min", "3 min 10 s", "45 s". */
export const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : m > 0 ? `${m} min ${s % 60} s` : `${s} s`
}
