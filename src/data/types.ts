export type CardRarity = 'classique' | 'uncommon' | 'legendary' | 'historique' | 'concept' | 'blueprint'

export interface Card {
  id: string
  name: string
  rarity: CardRarity
  set: string
  description: string
  artworkUrl: string
  /** Optional: override the default card back */
  backUrl?: string
  /** Stats or attributes specific to the game */
  stats?: Record<string, number | string>
}
