import type { CardDataProvider } from '../cardService'
import type { Card } from '../types'
import cardsData from '../cards.json'

export class StaticProvider implements CardDataProvider {
  private cards: Card[] = cardsData as Card[]

  async getCards(): Promise<Card[]> {
    return this.cards
  }

  async getCardById(id: string): Promise<Card | null> {
    return this.cards.find((c) => c.id === id) ?? null
  }
}
