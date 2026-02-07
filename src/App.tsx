import { Canvas } from '@react-three/fiber'
import { Suspense, useState, useCallback } from 'react'
import { GalleryScene } from '@/3d/scenes/GalleryScene'
import { InspectScene } from '@/3d/scenes/InspectScene'
import { BoosterScene } from '@/3d/scenes/BoosterScene'
import { ZoomController } from '@/3d/controls/ZoomController'
import { useCardData } from '@/hooks/useCardData'
import { useCardStore } from '@/hooks/useCardStore'
import type { Card } from '@/data/types'
import './styles/global.css'

/** Pull 5 random cards from the pool (duplicates allowed). */
function pullBoosterCards(pool: Card[]): Card[] {
  if (pool.length === 0) return []
  const pulled: Card[] = []
  for (let i = 0; i < 5; i++) {
    pulled.push(pool[Math.floor(Math.random() * pool.length)]!)
  }
  return pulled
}

export default function App() {
  const cards = useCardData()
  const viewMode = useCardStore((s) => s.viewMode)
  const selectedCardId = useCardStore((s) => s.selectedCardId)
  const selectCard = useCardStore((s) => s.selectCard)
  const deselectCard = useCardStore((s) => s.deselectCard)

  const boosterState = useCardStore((s) => s.boosterState)
  const boosterCards = useCardStore((s) => s.boosterCards)
  const revealedIndices = useCardStore((s) => s.revealedIndices)
  const startBooster = useCardStore((s) => s.startBooster)
  const tearOpen = useCardStore((s) => s.tearOpen)
  const finishOpening = useCardStore((s) => s.finishOpening)
  const revealCard = useCardStore((s) => s.revealCard)
  const closeBooster = useCardStore((s) => s.closeBooster)

  const [flipped, setFlipped] = useState(false)

  const selectedCard = cards.find((c) => c.id === selectedCardId)

  const handleSelectCard = useCallback(
    (id: string) => {
      setFlipped(false)
      selectCard(id)
    },
    [selectCard],
  )

  const handleBack = useCallback(() => {
    setFlipped(false)
    deselectCard()
  }, [deselectCard])

  const handleFlip = useCallback(() => {
    setFlipped((f) => !f)
  }, [])

  const handleOpenBooster = useCallback(() => {
    const pulled = pullBoosterCards(cards)
    startBooster(pulled)
  }, [cards, startBooster])

  const handleRevealAll = useCallback(() => {
    boosterCards.forEach((_, i) => revealCard(i))
  }, [boosterCards, revealCard])

  // Camera config per view mode
  const cameraPosition: [number, number, number] =
    viewMode === 'inspect'
      ? [0, 0, 6]
      : viewMode === 'booster'
        ? [0, 0, 12]
        : [0, 0, 10]

  const cameraFov = viewMode === 'inspect' ? 40 : 45

  return (
    <>
      {/* 3D Canvas */}
      <div className="canvas-container">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: cameraPosition, fov: cameraFov }}
          gl={{
            antialias: true,
            toneMapping: 3,
            toneMappingExposure: 1.0,
          }}
        >
          <Suspense fallback={null}>
            <ZoomController viewMode={viewMode} />
            {viewMode === 'gallery' && (
              <GalleryScene
                cards={cards}
                onSelectCard={handleSelectCard}
              />
            )}
            {viewMode === 'inspect' && selectedCard && (
              <InspectScene
                card={selectedCard}
                flipped={flipped}
                onFlip={handleFlip}
              />
            )}
            {viewMode === 'booster' && (
              <BoosterScene
                cards={boosterCards}
                boosterState={boosterState}
                revealedIndices={revealedIndices}
                onTearOpen={tearOpen}
                onFinishOpening={finishOpening}
                onReveal={revealCard}
              />
            )}
          </Suspense>
        </Canvas>
      </div>

      {/* UI Overlays */}
      {viewMode === 'gallery' && (
        <div className="ui-overlay">
          <div className="gallery-header glass">
            <h1>MY R:CARDS</h1>
            <p>{cards.length} cards in collection</p>
          </div>
          <button
            className="booster-btn glass"
            onClick={handleOpenBooster}
            disabled={cards.length === 0}
          >
            Ouvrir un booster
          </button>
        </div>
      )}

      {viewMode === 'inspect' && selectedCard && (
        <div className="inspect-overlay">
          <button
            className="inspect-back-button glass"
            onClick={handleBack}
          >
            &larr; Back
          </button>

          <div className="inspect-card-info glass">
            <h2>{selectedCard.name}</h2>
            <div className={`rarity ${selectedCard.rarity}`}>
              {selectedCard.rarity}
            </div>
            <div className="description">{selectedCard.description}</div>
          </div>

          <div className="inspect-actions">
            <button className="inspect-btn glass" onClick={handleFlip}>
              Flip
            </button>
          </div>
        </div>
      )}

      {viewMode === 'booster' && (
        <div className="booster-overlay">
          <div className="booster-header">
            <h2>Booster Origines</h2>
            <p>
              {boosterState === 'pack' && 'Glisse vers le haut pour ouvrir'}
              {boosterState === 'opening' && ''}
              {boosterState === 'revealing' && 'Clique sur une carte pour la retourner'}
              {boosterState === 'summary' && 'Toutes les cartes sont revelees !'}
            </p>
          </div>

          <div className="booster-actions">
            {boosterState === 'revealing' && (
              <button className="inspect-btn glass" onClick={handleRevealAll}>
                Tout reveler
              </button>
            )}
            {boosterState === 'summary' && (
              <button className="inspect-btn glass" onClick={handleOpenBooster}>
                Encore un !
              </button>
            )}
            {(boosterState === 'revealing' || boosterState === 'summary') && (
              <button className="inspect-btn glass" onClick={closeBooster}>
                Retour
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
