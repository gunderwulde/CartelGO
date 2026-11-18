import type { ReactNode } from 'react'

/** Lista vacía con guía: qué falta, para qué sirve y un botón que lleva a hacerlo */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  onAction,
}: {
  icon: ReactNode
  title: string
  hint: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="border-4 border-dashed border-black bg-yellow-100 p-4 flex flex-col items-center gap-2 text-center">
      <span className="opacity-80" aria-hidden>
        {icon}
      </span>
      <p className="text-sm font-black leading-tight">{title}</p>
      <p className="text-xs font-bold opacity-70">{hint}</p>
      {action && onAction && (
        <button className="cartoon-btn px-4 py-1.5 text-sm" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}
