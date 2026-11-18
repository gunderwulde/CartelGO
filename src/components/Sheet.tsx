import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export interface SheetTab<T extends string> {
  id: T
  label: string
}

interface Props<T extends string> {
  /** Cabecera: icono, título y datos del sitio */
  header: ReactNode
  tabs: SheetTab<T>[]
  tab: T
  onTab: (id: T) => void
  onClose: () => void
  label: string
  /** Altura fija (50 %) para que no salte al cambiar de pestaña; si no, se ajusta al contenido hasta el 50 % */
  fixedHeight?: boolean
  /** Color del panel: la pestaña activa lo toma para fundirse con el contenido */
  tone?: 'white' | 'yellow'
  className?: string
  children: ReactNode
}

/**
 * Panel inferior común (comercio y HQ): como máximo la mitad de la pantalla, cabecera con los datos del sitio,
 * pestañas de carpeta (si hay más de una) y contenido con scroll. El mapa sigue visible y tocable por encima.
 */
export function Sheet<T extends string>({
  header,
  tabs,
  tab,
  onTab,
  onClose,
  label,
  fixedHeight = false,
  tone = 'white',
  className = '',
  children,
}: Props<T>) {
  const panel = tone === 'yellow' ? 'bg-yellow-300' : 'bg-white'
  const idle = tone === 'yellow' ? 'bg-yellow-100' : 'bg-yellow-200'
  return (
    <div
      role="dialog"
      aria-label={label}
      className={`fixed inset-x-0 bottom-0 z-30 flex flex-col cartoon-card rounded-t-2xl ${panel}! ${fixedHeight ? 'h-[50%]' : 'max-h-[50%]'} ${className}`}
    >
      <div className="flex items-start gap-2 px-4 pt-3 pb-2">
        <div className="flex-1 min-w-0">{header}</div>
        <button aria-label="Cerrar" className="w-11 h-11 -mr-2 -mt-1 flex items-center justify-center shrink-0" onClick={onClose}>
          <X size={28} />
        </button>
      </div>
      {tabs.length > 1 && (
        // Pestañas de carpeta: la activa sube, se funde con el panel y tapa la línea que lo separa de las demás
        <div className="border-b-4 border-black" role="tablist">
          <div className="px-4 flex items-end gap-1">
            {tabs.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  className={`flex-1 min-h-11 px-2 text-xs font-black border-4 border-b-0 border-black rounded-t-xl touch-manipulation select-none ${
                    active ? `relative z-10 translate-y-1 pb-1 ${panel}` : `mt-1 opacity-90 ${idle}`
                  }`}
                  onClick={() => onTab(t.id)}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  )
}
