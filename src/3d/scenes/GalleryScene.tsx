import { useMemo } from 'react'
import { Text } from '@react-three/drei'
import { CardMesh } from '@/3d/card/CardMesh'
import { Lighting } from '@/3d/environment/Lighting'
import { EnvironmentMap } from '@/3d/environment/EnvironmentMap'
import type { Card, CardRarity } from '@/data/types'

interface GallerySceneProps {
  cards: Card[]
  onSelectCard: (id: string) => void
}

const COLUMNS = 4
const SPACING_X = 3.2
const SPACING_Y = 4.0
const SEPARATOR_HEIGHT = 0.42
const LABEL_ROW = 0.25

const RARITY_LABELS: Record<string, string> = {
  classique: 'CLASSIQUE',
  concept: 'CONCEPT',
  blueprint: 'BLUEPRINT',
  historique: 'HISTORIQUE',
  uncommon: 'UNCOMMON',
  legendary: 'LEGENDARY',
}

const RARITY_COLORS: Record<string, string> = {
  classique: '#a0a0a0',
  concept: '#daa520',
  blueprint: '#1a3cba',
  historique: '#c8a87a',
  uncommon: '#50c878',
  legendary: '#ffb830',
}

interface LayoutItem {
  type: 'card'
  card: Card
  x: number
  y: number
}

interface SeparatorItem {
  type: 'separator'
  rarity: string
  y: number
}

type GalleryItem = LayoutItem | SeparatorItem

function SeparatorGroup({ rarity, y }: { rarity: string; y: number }) {
  const color = RARITY_COLORS[rarity] ?? '#888888'

  return (
    <group position={[0, y, 0]}>
      <Text
        position={[-5.8, 0, 0.5]}
        fontSize={0.14}
        color={color}
        anchorX="left"
        anchorY="middle"
        fillOpacity={0.25}
        letterSpacing={0.1}
        renderOrder={10}
        material-depthTest={false}
      >
        {RARITY_LABELS[rarity] ?? rarity.toUpperCase()}
      </Text>
      <mesh position={[0.8, 0, 0.5]} renderOrder={10}>
        <planeGeometry args={[10, 0.002]} />
        <meshBasicMaterial color={color} opacity={0.1} transparent depthTest={false} />
      </mesh>
    </group>
  )
}

export function GalleryScene({ cards, onSelectCard }: GallerySceneProps) {
  const items = useMemo(() => {
    // Group cards by rarity (cards are already sorted by rarity from App)
    const groups: { rarity: CardRarity; cards: Card[] }[] = []
    let currentRarity: CardRarity | null = null

    for (const card of cards) {
      if (card.rarity !== currentRarity) {
        currentRarity = card.rarity
        groups.push({ rarity: card.rarity, cards: [] })
      }
      groups[groups.length - 1]!.cards.push(card)
    }

    const result: GalleryItem[] = []
    let currentRow = 0

    for (let g = 0; g < groups.length; g++) {
      const group = groups[g]!

      // Add separator (skip for the very first group)
      if (g > 0) {
        currentRow += SEPARATOR_HEIGHT / SPACING_Y
      }

      const separatorY = -currentRow * SPACING_Y
      result.push({ type: 'separator', rarity: group.rarity, y: separatorY + SPACING_Y * LABEL_ROW })

      currentRow += LABEL_ROW

      // Layout cards in grid
      const groupRows = Math.ceil(group.cards.length / COLUMNS)
      for (let i = 0; i < group.cards.length; i++) {
        const col = i % COLUMNS
        const row = Math.floor(i / COLUMNS)
        const colsInRow = row < groupRows - 1 ? COLUMNS : ((group.cards.length - 1) % COLUMNS) + 1
        const x = (col - (colsInRow - 1) / 2) * SPACING_X
        const y = -(currentRow + row) * SPACING_Y

        result.push({ type: 'card', card: group.cards[i]!, x, y })
      }

      currentRow += groupRows
    }

    return { items: result, totalHeight: currentRow * SPACING_Y }
  }, [cards])

  // Center vertically
  const offsetY = items.totalHeight / 2 - SPACING_Y / 2

  return (
    <>
      <Lighting />
      <EnvironmentMap />

      {items.items.map((item, i) => {
        if (item.type === 'separator') {
          return (
            <SeparatorGroup
              key={`sep-${item.rarity}-${i}`}
              rarity={item.rarity}
              y={item.y + offsetY}
            />
          )
        }

        return (
          <CardMesh
            key={item.card.id}
            card={item.card}
            position={[item.x, item.y + offsetY, 0]}
            onClick={() => onSelectCard(item.card.id)}
          />
        )
      })}
    </>
  )
}
