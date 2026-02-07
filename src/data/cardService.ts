import type { Card } from './types'

export interface CardDataProvider {
  getCards(): Promise<Card[]>
  getCardById(id: string): Promise<Card | null>
}

export type ProviderType = 'static' | 'api'

export async function createCardProvider(
  type: ProviderType = 'static',
): Promise<CardDataProvider> {
  switch (type) {
    case 'static': {
      const { StaticProvider } = await import('./providers/staticProvider')
      return new StaticProvider()
    }
    case 'api': {
      const { ApiProvider } = await import('./providers/apiProvider')
      return new ApiProvider()
    }
    default:
      throw new Error(`Unknown provider type: ${type}`)
  }
}
