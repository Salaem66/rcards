import { create } from 'zustand'
import type { Card } from '@/data/types'

export type ViewMode = 'gallery' | 'inspect' | 'booster'
export type GpuTier = 'high' | 'medium' | 'low'
export type BoosterState = 'pack' | 'opening' | 'revealing' | 'summary'

interface CardStore {
  cards: Card[]
  selectedCardId: string | null
  viewMode: ViewMode
  gpuTier: GpuTier

  // Booster state
  boosterState: BoosterState
  boosterCards: Card[]
  revealedIndices: Set<number>

  setCards: (cards: Card[]) => void
  selectCard: (id: string) => void
  deselectCard: () => void
  setViewMode: (mode: ViewMode) => void
  setGpuTier: (tier: GpuTier) => void

  // Booster actions
  startBooster: (pulledCards: Card[]) => void
  tearOpen: () => void
  finishOpening: () => void
  revealCard: (index: number) => void
  closeBooster: () => void
}

export const useCardStore = create<CardStore>((set) => ({
  cards: [],
  selectedCardId: null,
  viewMode: 'gallery',
  gpuTier: 'high',

  boosterState: 'pack',
  boosterCards: [],
  revealedIndices: new Set(),

  setCards: (cards) => set({ cards }),
  selectCard: (id) => set({ selectedCardId: id, viewMode: 'inspect' }),
  deselectCard: () => set({ selectedCardId: null, viewMode: 'gallery' }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setGpuTier: (tier) => set({ gpuTier: tier }),

  startBooster: (pulledCards) =>
    set({
      viewMode: 'booster',
      boosterState: 'pack',
      boosterCards: pulledCards,
      revealedIndices: new Set(),
    }),
  tearOpen: () => set({ boosterState: 'opening' }),
  finishOpening: () => set({ boosterState: 'revealing' }),
  revealCard: (index) =>
    set((state) => {
      const next = new Set(state.revealedIndices)
      next.add(index)
      return {
        revealedIndices: next,
        boosterState: next.size === state.boosterCards.length ? 'summary' : 'revealing',
      }
    }),
  closeBooster: () =>
    set({
      viewMode: 'gallery',
      boosterState: 'pack',
      boosterCards: [],
      revealedIndices: new Set(),
    }),
}))
