import { Check } from 'lucide-react'

const STEPS = ['Preparando', 'Recogida', 'En camino', 'Almacén']

/**
 * Línea de estado de un pedido.
 * `step`: 0 preparando · 1 listo, esperando transportista · 2 en camino.
 */
export function OrderTimeline({ step, detail }: { step: 0 | 1 | 2; detail: string }) {
  return (
    <div className="border-2 border-black bg-green-100 p-2 flex flex-col gap-1.5" role="status">
      <ol className="flex items-center">
        {STEPS.map((label, i) => {
          const done = i < step
          const current = i === step
          return (
            <li key={label} className="flex-1 flex items-center last:flex-none">
              <span
                className={`w-6 h-6 shrink-0 rounded-full border-2 border-black flex items-center justify-center text-xs font-black ${
                  done ? 'bg-green-400' : current ? 'bg-yellow-300 timeline-pulse' : 'bg-white opacity-60'
                }`}
                aria-label={`${label}${done ? ' (hecho)' : current ? ' (ahora)' : ''}`}
              >
                {done ? <Check size={14} /> : i + 1}
              </span>
              {i < STEPS.length - 1 && <span className={`flex-1 h-1 border-y-2 border-black ${done ? 'bg-green-400' : 'bg-white'}`} />}
            </li>
          )
        })}
      </ol>
      <p className="text-xs font-black leading-tight">
        <span className="opacity-70">{STEPS[step]} · </span>
        {detail}
      </p>
    </div>
  )
}
