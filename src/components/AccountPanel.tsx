import { useState } from 'react'
import { X } from 'lucide-react'
import { useAccountStore, type ConflictInfo } from '../store/accountStore'
import { resolveConflict, sendCode, signOut, syncNow, verifyCode } from '../services/cloudSync'
import type { SaveSummary } from '../services/cloudPlan'
import { play } from '../services/sound'

const input = 'w-full border-[3px] border-black rounded-lg px-3 py-2 font-bold bg-white text-sm'
const btn = 'cartoon-btn px-4 py-2 text-sm disabled:opacity-40'

const fmtDate = (t: number | string): string =>
  new Date(t).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function SignInForm() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const err = await sendCode(email.trim())
    setBusy(false)
    if (err) {
      play('error')
      setError(err)
    } else setStep('code')
  }

  const verify = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const err = await verifyCode(email.trim(), code)
    setBusy(false)
    if (err) {
      play('error')
      setError(err)
    } else play('tap')
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold">
        Guarda tu partida en la nube para no perderla y seguir en otro móvil. Solo hace falta un email: te enviamos un
        código, sin contraseñas.
      </p>
      {step === 'email' ? (
        <>
          <input
            className={input}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className={btn} disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())} onClick={() => void send()}>
            {busy ? 'Enviando…' : 'Enviarme un código'}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-black">Te hemos escrito a {email}. Mira también en spam.</p>
          <input
            className={`${input} tracking-[0.3em] text-center text-lg`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="Código"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button className={btn} disabled={busy || code.length < 6} onClick={() => void verify()}>
            {busy ? 'Comprobando…' : 'Entrar'}
          </button>
          <button className="text-xs font-bold underline self-start" onClick={() => setStep('email')}>
            Cambiar email
          </button>
        </>
      )}
      {error && <p className="text-sm font-black text-red-600">{error}</p>}
    </div>
  )
}

const SYNC_TEXT = {
  idle: 'En espera',
  syncing: 'Sincronizando…',
  ok: 'Al día',
  offline: 'Sin conexión: se subirá al volver',
  error: 'Error al sincronizar',
} as const

function Account() {
  const { email, sync, lastSyncAt, error } = useAccountStore()
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-black break-all">Sesión iniciada: {email ?? 'cuenta'}</p>
      <p className="text-sm font-bold">
        {SYNC_TEXT[sync]}
        {lastSyncAt && sync === 'ok' ? ` · ${fmtDate(lastSyncAt)}` : ''}
      </p>
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      <p className="text-xs font-bold opacity-70">
        Tu partida se guarda sola cada pocos minutos y al cerrar la app. La posición exacta de tu HQ nunca se sube: solo
        la zona aproximada. En otro móvil tendrás que volver a colocarlo.
      </p>
      <div className="flex gap-2">
        <button className={btn} disabled={sync === 'syncing'} onClick={() => void syncNow()}>
          Sincronizar ahora
        </button>
        <button className={`${btn} bg-white!`} onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default function AccountPanel({ onClose }: { onClose: () => void }) {
  const auth = useAccountStore((s) => s.auth)
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 max-h-[80%] overflow-y-auto cartoon-card rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center mb-3">
        <h2 className="flex-1 font-black text-lg">Partida en la nube</h2>
        <button className="cartoon-btn w-9 h-9 flex items-center justify-center" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>
      {auth === 'loading' ? <p className="text-sm font-bold">Conectando…</p> : auth === 'in' ? <Account /> : <SignInForm />}
    </div>
  )
}

function Side({ title, s }: { title: string; s: SaveSummary }) {
  return (
    <div className="flex-1 border-[3px] border-black rounded-lg p-2 bg-white">
      <p className="font-black text-sm mb-1">{title}</p>
      <p className="text-xs font-bold">Reputación {s.reputation}</p>
      <p className="text-xs font-bold">Limpio ${s.cleanCash}</p>
      <p className="text-xs font-bold">Sucio ${s.dirtyCash}</p>
      <p className="text-xs font-bold">
        {s.dealers} camellos · {s.businesses} negocios
      </p>
    </div>
  )
}

/** Las dos partidas han avanzado: se elige cuál conservar. Nunca se pisa nada sin preguntar. */
export function CloudConflict({ conflict }: { conflict: ConflictInfo }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center p-3">
      <div className="cartoon-card p-4 w-full max-w-sm flex flex-col gap-3">
        <h2 className="font-black text-lg">¿Qué partida conservas?</h2>
        <p className="text-sm font-bold">
          La partida de este móvil y la de la nube son distintas. La que no elijas se perderá.
        </p>
        <div className="flex gap-2">
          <Side title="Este móvil" s={conflict.local} />
          <Side title={`Nube · ${fmtDate(conflict.cloudUpdatedAt)}`} s={conflict.cloud} />
        </div>
        <button className={btn} onClick={() => void resolveConflict('cloud')}>
          Usar la de la nube
        </button>
        <button className={`${btn} bg-white!`} onClick={() => void resolveConflict('local')}>
          Mantener la de este móvil
        </button>
      </div>
    </div>
  )
}
