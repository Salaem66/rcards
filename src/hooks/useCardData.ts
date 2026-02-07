import { useEffect } from 'react'
import { useCardStore } from './useCardStore'
import { createCardProvider } from '@/data/cardService'

export function useCardData() {
  const cards = useCardStore((s) => s.cards)
  const setCards = useCardStore((s) => s.setCards)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const provider = await createCardProvider('static')
      const data = await provider.getCards()
      if (!cancelled) {
        setCards(data)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [setCards])

  return cards
}
