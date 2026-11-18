import { latLngToCell } from 'h3-js'
import type { Session } from '@supabase/supabase-js'
import { useAccountStore } from '../store/accountStore'
import { useBaseStore } from '../store/baseStore'
import { useInventoryStore } from '../store/inventoryStore'
import { fullKey, isPristine, isSaveBlob, planSync, progressKey, summarize, type SaveBlob } from './cloudPlan'
import { backendEnabled, getSupabase } from './supabaseClient'

/**
 * Sincronización de la partida con Supabase. El juego sigue siendo local (offline-first):
 * la nube es copia de seguridad y puente entre dispositivos. Cada dispositivo recuerda la revisión
 * que sincronizó por última vez para detectar si el otro lado avanzó.
 */
const META_KEY = 'cartelgo:cloud'
const DEVICE_KEY = 'cartelgo:device'
/** Celda H3 del HQ que se sube en lugar de sus coordenadas (AGENTS §3) */
const HQ_CELL_RES = 7

interface Meta {
  userId: string
  revision: number
  progress: string
}

interface ServerRow {
  data: unknown
  revision: number
  updated_at: string
}

const patch = (p: Parameters<ReturnType<typeof useAccountStore.getState>['patch']>[0]): void =>
  useAccountStore.getState().patch(p)

// ---------- Almacenamiento local de metadatos ----------

function readMeta(userId: string): Meta | null {
  try {
    const raw = localStorage.getItem(META_KEY)
    const m = raw ? (JSON.parse(raw) as Meta) : null
    return m && m.userId === userId ? m : null
  } catch {
    return null
  }
}

function writeMeta(m: Meta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m))
  } catch {
    /* sin almacenamiento: se tratará como dispositivo nuevo */
  }
}

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return 'sin-id'
  }
}

// ---------- Exportar / aplicar la partida ----------

/** Foto de la partida. Sin coordenadas del HQ. */
export function exportSave(): SaveBlob {
  const inv = useInventoryStore.getState()
  const b = useBaseStore.getState()
  return {
    v: 1,
    inventory: {
      inventory: inv.inventory,
      dirtyCash: inv.dirtyCash,
      cleanCash: inv.cleanCash,
      capacity: inv.capacity,
      limits: inv.limits,
      heat: inv.heat,
    },
    base: {
      hqLevel: b.hqLevel,
      labLevel: b.labLevel,
      storageLevel: b.storageLevel,
      backpackLevel: b.backpackLevel,
      storage: b.storage,
      job: b.job,
      dealers: b.dealers,
      businesses: b.businesses,
      visited: b.visited,
      reputation: b.reputation,
      dealersAt: b.dealersAt,
      launderAt: b.launderAt,
    },
  }
}

const hqCell = (): string | null => {
  const hq = useBaseStore.getState().hq
  return hq ? latLngToCell(hq.lat, hq.lng, HQ_CELL_RES) : null
}

/** Sustituye la partida local. El HQ local (si existe) se conserva: la nube nunca lo trae. */
function applySave(blob: SaveBlob): void {
  useInventoryStore.setState({ ...blob.inventory })
  useBaseStore.setState({ ...blob.base })
}

// ---------- Estado interno ----------

let userId: string | null = null
let initialized = false
let busy = false
let lastFull: string | null = null
let lastPushAt = 0
let pendingRow: ServerRow | null = null

function handleError(e: unknown): void {
  const offline = !navigator.onLine || (e instanceof TypeError && /fetch|network/i.test(e.message))
  const message = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'Error desconocido'
  patch({ sync: offline ? 'offline' : 'error', error: offline ? null : message })
}

function finishPush(blob: SaveBlob, revision: number): void {
  if (!userId) return
  writeMeta({ userId, revision, progress: progressKey(blob) })
  lastFull = fullKey(blob)
  lastPushAt = Date.now()
  patch({ sync: 'ok', lastSyncAt: Date.now(), error: null, conflict: null })
}

/** Sube la partida. `expected` es la revisión que creemos que hay en el servidor (null = no hay fila). */
async function pushBlob(expected: number | null): Promise<'ok' | 'conflict'> {
  if (!userId) return 'ok'
  const sb = await getSupabase()
  const blob = exportSave()
  const payload = { data: blob, hq_cell: hqCell(), device_id: deviceId(), updated_at: new Date().toISOString() }
  if (expected === null) {
    const { error } = await sb.from('saves').insert({ user_id: userId, revision: 1, ...payload })
    if (error) {
      if (error.code === '23505') return 'conflict' // otro dispositivo creó la fila a la vez
      throw error
    }
    finishPush(blob, 1)
    return 'ok'
  }
  const { data, error } = await sb
    .from('saves')
    .update({ ...payload, revision: expected + 1 })
    .eq('user_id', userId)
    .eq('revision', expected) // solo si nadie subió nada mientras tanto
    .select('revision')
  if (error) throw error
  if (!data || data.length === 0) return 'conflict'
  finishPush(blob, expected + 1)
  return 'ok'
}

function pullRow(row: ServerRow): void {
  if (!userId) return
  if (!isSaveBlob(row.data)) throw new Error('La partida de la nube no es válida.')
  applySave(row.data)
  const blob = exportSave()
  writeMeta({ userId, revision: row.revision, progress: progressKey(blob) })
  lastFull = fullKey(blob)
  lastPushAt = Date.now()
  patch({ sync: 'ok', lastSyncAt: Date.now(), error: null, conflict: null })
  useInventoryStore.getState().setNotice('Partida descargada de la nube.')
}

async function reconcileOnce(attempt: number): Promise<void> {
  if (!userId) return
  const sb = await getSupabase()
  const { data, error } = await sb.from('saves').select('data,revision,updated_at').eq('user_id', userId).maybeSingle()
  if (error) throw error
  const row = data as ServerRow | null
  const local = exportSave()
  const meta = readMeta(userId)
  const plan = planSync({
    hasServer: row !== null,
    serverRevision: row?.revision ?? 0,
    metaRevision: meta?.revision ?? null,
    dirty: meta ? progressKey(local) !== meta.progress : true,
    pristine: isPristine(local),
  })

  if (plan === 'noop') {
    lastFull = fullKey(local)
    patch({ sync: 'ok', lastSyncAt: Date.now(), error: null })
  } else if (plan === 'pull' && row) {
    pullRow(row)
  } else if (plan === 'ask' && row) {
    pendingRow = row
    if (!isSaveBlob(row.data)) throw new Error('La partida de la nube no es válida.')
    patch({ sync: 'idle', conflict: { local: summarize(local), cloud: summarize(row.data), cloudUpdatedAt: row.updated_at } })
  } else {
    const result = await pushBlob(row?.revision ?? null)
    if (result === 'conflict' && attempt < 2) await reconcileOnce(attempt + 1)
  }
}

/** Compara con el servidor y decide: subir, bajar, no hacer nada o preguntar. */
export async function syncNow(): Promise<void> {
  if (busy || !userId || useAccountStore.getState().conflict) return
  busy = true
  patch({ sync: 'syncing' })
  try {
    await reconcileOnce(0)
  } catch (e) {
    handleError(e)
  } finally {
    busy = false
  }
}

/** Subida periódica: solo si hay cambios y ha pasado `minGapMs` desde la última. */
export async function pushIfNeeded(minGapMs: number): Promise<void> {
  if (busy || !userId || lastFull === null || useAccountStore.getState().conflict) return
  if (Date.now() - lastPushAt < minGapMs) return
  if (fullKey(exportSave()) === lastFull) return
  const meta = readMeta(userId)
  if (!meta) {
    await syncNow()
    return
  }
  busy = true
  let conflict = false
  try {
    conflict = (await pushBlob(meta.revision)) === 'conflict'
  } catch (e) {
    handleError(e)
  } finally {
    busy = false
  }
  if (conflict) await syncNow()
}

/** El jugador elige qué partida conserva cuando las dos han avanzado. */
export async function resolveConflict(choice: 'cloud' | 'local'): Promise<void> {
  const row = pendingRow
  if (!row || !userId || busy) return
  busy = true
  patch({ conflict: null, sync: 'syncing' })
  let retry = false
  try {
    if (choice === 'cloud') pullRow(row)
    else retry = (await pushBlob(row.revision)) === 'conflict'
    pendingRow = null
  } catch (e) {
    handleError(e)
  } finally {
    busy = false
  }
  if (retry) await syncNow()
}

// ---------- Sesión ----------

function onSession(session: Session | null): void {
  if (!session) {
    userId = null
    lastFull = null
    pendingRow = null
    patch({ auth: 'out', email: null, sync: 'idle', conflict: null, error: null })
    return
  }
  patch({ auth: 'in', email: session.user.email ?? null })
  if (userId !== session.user.id) {
    userId = session.user.id
    lastFull = null
    void syncNow()
  }
}

export async function initCloud(): Promise<void> {
  if (!backendEnabled || initialized) return
  initialized = true
  try {
    const sb = await getSupabase()
    sb.auth.onAuthStateChange((_event, session) => {
      // Fuera del callback: dentro no se pueden hacer llamadas a Supabase sin riesgo de bloqueo
      setTimeout(() => onSession(session), 0)
    })
    const { data } = await sb.auth.getSession()
    onSession(data.session)
  } catch (e) {
    patch({ auth: 'out' })
    handleError(e)
  }
}

const friendly = (e: { message: string; status?: number }): string => {
  if (e.status === 429 || /rate limit/i.test(e.message)) return 'Demasiados intentos. Espera unos minutos.'
  if (/expired|invalid/i.test(e.message)) return 'Código incorrecto o caducado.'
  if (/email/i.test(e.message) && /invalid/i.test(e.message)) return 'Ese email no parece válido.'
  return e.message
}

/** Envía un código al email. Devuelve un mensaje de error, o null si salió bien. */
export async function sendCode(email: string): Promise<string | null> {
  try {
    const sb = await getSupabase()
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    return error ? friendly(error) : null
  } catch (e) {
    return navigator.onLine ? (e instanceof Error ? e.message : 'Error') : 'Sin conexión.'
  }
}

/** Comprueba el código. Devuelve un mensaje de error, o null si ya hay sesión. */
export async function verifyCode(email: string, code: string): Promise<string | null> {
  try {
    const sb = await getSupabase()
    const { error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    return error ? friendly(error) : null
  } catch (e) {
    return navigator.onLine ? (e instanceof Error ? e.message : 'Error') : 'Sin conexión.'
  }
}

/** Cierra la sesión. La partida local se queda como está. */
export async function signOut(): Promise<void> {
  try {
    const sb = await getSupabase()
    await sb.auth.signOut({ scope: 'local' })
  } finally {
    onSession(null)
  }
}
