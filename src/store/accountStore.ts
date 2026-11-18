import { create } from 'zustand'
import type { SaveSummary } from '../services/cloudPlan'

export interface ConflictInfo {
  local: SaveSummary
  cloud: SaveSummary
  cloudUpdatedAt: string
}

export type SyncState = 'idle' | 'syncing' | 'ok' | 'offline' | 'error'

interface AccountState {
  auth: 'loading' | 'out' | 'in'
  email: string | null
  sync: SyncState
  lastSyncAt: number | null
  /** Último error legible para el usuario */
  error: string | null
  conflict: ConflictInfo | null
  patch: (p: Partial<Omit<AccountState, 'patch'>>) => void
}

/** Estado de la cuenta y de la nube. No se persiste: la sesión la guarda Supabase. */
export const useAccountStore = create<AccountState>()((set) => ({
  auth: 'loading',
  email: null,
  sync: 'idle',
  lastSyncAt: null,
  error: null,
  conflict: null,
  patch: (p) => set(p),
}))
