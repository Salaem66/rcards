import { CardMesh } from '@/3d/card/CardMesh'
import { Lighting } from '@/3d/environment/Lighting'
import { EnvironmentMap } from '@/3d/environment/EnvironmentMap'
import type { Card } from '@/data/types'

interface GallerySceneProps {
  cards: Card[]
  onSelectCard: (id: string) => void
}

const COLUMNS = 4
const SPACING_X = 3.2
const SPACING_Y = 4.5

export function GalleryScene({ cards, onSelectCard }: GallerySceneProps) {
  const totalRows = Math.ceil(cards.length / COLUMNS)

  return (
    <>
      <Lighting />
      <EnvironmentMap />

      {cards.map((card, i) => {
        const col = i % COLUMNS
        const row = Math.floor(i / COLUMNS)
        const colsInRow = row < totalRows - 1 ? COLUMNS : ((cards.length - 1) % COLUMNS) + 1
        const x = (col - (colsInRow - 1) / 2) * SPACING_X
        const y = -row * SPACING_Y + ((totalRows - 1) / 2) * SPACING_Y

        return (
          <CardMesh
            key={card.id}
            card={card}
            position={[x, y, 0]}
            onClick={() => onSelectCard(card.id)}
          />
        )
      })}
    </>
  )
}
