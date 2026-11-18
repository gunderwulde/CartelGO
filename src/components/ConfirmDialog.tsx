import { play } from '../services/sound'
import { useConfirmStore } from '../store/confirmStore'

/** Aviso con el estilo del juego: sustituye a window.confirm */
export default function ConfirmDialog() {
  const dialog = useConfirmStore((s) => s.dialog)
  const close = useConfirmStore((s) => s.close)
  if (!dialog) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
      <div className="cartoon-card bg-yellow-300! w-full max-w-sm p-4 flex flex-col gap-4">
        <p className="text-lg font-black leading-snug">{dialog.message}</p>
        <div className="flex gap-3">
          <button
            className="cartoon-btn flex-1 py-2 bg-white!"
            onClick={() => {
              play('tap')
              close()
            }}
          >
            {dialog.no}
          </button>
          <button
            className="cartoon-btn flex-1 py-2"
            onClick={() => {
              close()
              dialog.onYes()
            }}
          >
            {dialog.yes}
          </button>
        </div>
      </div>
    </div>
  )
}
