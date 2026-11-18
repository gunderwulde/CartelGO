import { create } from "zustand";

/** Anuncio en pantalla: qué recompensa da y cuándo empezó (null = ninguno) */
export type AdKind = "rescue" | "favor";

interface AdState {
  current: { kind: AdKind; startedAt: number } | null;
  start: (kind: AdKind) => void;
  end: () => void;
}

export const useAdStore = create<AdState>((set) => ({
  current: null,
  start: (kind) => set({ current: { kind, startedAt: Date.now() } }),
  end: () => set({ current: null }),
}));
