import type { CardDataProvider } from '../cardService'
import type { Card } from '../types'

/**
 * Stub provider for future REST/GraphQL API integration.
 * Implement the fetch logic here when a backend is available.
 */
export class ApiProvider implements CardDataProvider {
  async getCards(): Promise<Card[]> {
    throw new Error('ApiProvider not implemented. Configure your API endpoint.')
  }

  async getCardById(_id: string): Promise<Card | null> {
    throw new Error('ApiProvider not implemented. Configure your API endpoint.')
  }
}
