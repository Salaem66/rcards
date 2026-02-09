import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCardGeometry, CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH, CARD_BEVEL_THICKNESS } from '@/3d/card/CardGeometry'
import { HOLO_VERTEX, HOLO_FRAGMENT } from '@/3d/card/holoShaders'
import { Lighting } from '@/3d/environment/Lighting'
import { EnvironmentMap } from '@/3d/environment/EnvironmentMap'
import type { Card } from '@/data/types'
import type { BoosterState } from '@/hooks/useCardStore'
import { lerp } from '@/utils/mathUtils'

const textureLoader = new THREE.TextureLoader()

const EDGE_COLORS: Record<string, string> = {
  classique: '#e8e0d8',
  uncommon: '#c0c0c0',
  legendary: '#ffb830',
  historique: '#8b6914',
  concept: '#00ccff',
  blueprint: '#4fc3f7',
}

const CARD_SPACING = 2.8
const FLIP_SPEED = 8

// Pack constants
const PACK_WIDTH = CARD_WIDTH * 1.08
const PACK_HEIGHT = CARD_HEIGHT * 1.12
const PACK_TOP_HEIGHT = PACK_HEIGHT * 0.25
const PACK_BOTTOM_HEIGHT = PACK_HEIGHT - PACK_TOP_HEIGHT
const PACK_TEAR_LINE_Y = PACK_HEIGHT / 2 - PACK_TOP_HEIGHT
const PACK_BOTTOM_CENTER_Y = -PACK_HEIGHT / 2 + PACK_BOTTOM_HEIGHT / 2
const DRAG_THRESHOLD_PX = 80

interface BoosterSceneProps {
  cards: Card[]
  boosterState: BoosterState
  revealedIndices: Set<number>
  onTearOpen: () => void
  onFinishOpening: () => void
  onReveal: (index: number) => void
}

export function BoosterScene({
  cards,
  boosterState,
  revealedIndices,
  onTearOpen,
  onFinishOpening,
  onReveal,
}: BoosterSceneProps) {
  return (
    <>
      <Lighting />
      <EnvironmentMap />

      {(boosterState === 'pack' || boosterState === 'opening') && (
        <BoosterPack
          boosterState={boosterState}
          onTearOpen={onTearOpen}
          onFinishOpening={onFinishOpening}
        />
      )}

      {(boosterState === 'revealing' || boosterState === 'summary') &&
        cards.map((card, i) => {
          const x = (i - (cards.length - 1) / 2) * CARD_SPACING
          return (
            <BoosterCard
              key={`${card.id}-${i}`}
              card={card}
              index={i}
              targetX={x}
              revealed={revealedIndices.has(i)}
              onReveal={() => onReveal(i)}
            />
          )
        })}
    </>
  )
}

/* ─── Booster Pack ─── */

interface BoosterPackProps {
  boosterState: BoosterState
  onTearOpen: () => void
  onFinishOpening: () => void
}

function BoosterPack({ boosterState, onTearOpen, onFinishOpening }: BoosterPackProps) {
  const packGroupRef = useRef<THREE.Group>(null!)
  const topGroupRef = useRef<THREE.Group>(null!)
  const bottomGroupRef = useRef<THREE.Group>(null!)
  const packTexture = usePackTexture()
  const dragRef = useRef({ active: false, startY: 0, currentDelta: 0 })

  const anim = useRef({
    packScale: 0.4,
    packY: 3,
    topGroupY: 0,
    topGroupRotX: 0,
    bottomGroupY: 0,
    openTimer: 0,
    finishCalled: false,
  })

  // Drag via DOM events for reliability
  const handlePointerDown = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      if (boosterState !== 'pack') return
      e.stopPropagation()
      dragRef.current.active = true
      dragRef.current.startY = e.nativeEvent.clientY
      dragRef.current.currentDelta = 0
      document.body.style.cursor = 'grabbing'
    },
    [boosterState],
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current.active) return
      const delta = dragRef.current.startY - e.clientY
      dragRef.current.currentDelta = Math.max(0, delta)
      if (delta > DRAG_THRESHOLD_PX) {
        dragRef.current.active = false
        dragRef.current.currentDelta = 0
        document.body.style.cursor = 'auto'
        onTearOpen()
      }
    }
    const onUp = () => {
      if (dragRef.current.active) {
        dragRef.current.active = false
        dragRef.current.currentDelta = 0
        document.body.style.cursor = 'auto'
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [onTearOpen])

  const handlePointerEnter = useCallback(() => {
    if (boosterState === 'pack') document.body.style.cursor = 'grab'
  }, [boosterState])

  const handlePointerLeave = useCallback(() => {
    if (!dragRef.current.active) document.body.style.cursor = 'auto'
  }, [])

  // Animation
  useFrame((_state, delta) => {
    if (!packGroupRef.current || !topGroupRef.current || !bottomGroupRef.current) return
    const a = anim.current

    if (boosterState === 'pack') {
      // Entrance
      a.packScale = lerp(a.packScale, 1, 5 * delta)
      a.packY = lerp(a.packY, 0, 5 * delta)
      packGroupRef.current.scale.setScalar(a.packScale)
      packGroupRef.current.position.y = a.packY

      // Drag feedback — top lifts proportionally
      const dragProgress = dragRef.current.active
        ? Math.min(dragRef.current.currentDelta / DRAG_THRESHOLD_PX, 1)
        : 0
      a.topGroupY = lerp(a.topGroupY, dragProgress * 0.4, 10 * delta)
      topGroupRef.current.position.y = a.topGroupY
    }

    if (boosterState === 'opening') {
      a.openTimer += delta

      // Top flap flies up
      a.topGroupY = lerp(a.topGroupY, 8, 4 * delta)
      a.topGroupRotX = lerp(a.topGroupRotX, -0.3, 3 * delta)
      topGroupRef.current.position.y = a.topGroupY
      topGroupRef.current.rotation.x = a.topGroupRotX

      // Bottom drops
      a.bottomGroupY = lerp(a.bottomGroupY, -5, 3 * delta)
      bottomGroupRef.current.position.y = a.bottomGroupY

      // Whole pack scales away
      if (a.openTimer > 0.3) {
        a.packScale = lerp(a.packScale, 0, 4 * delta)
        packGroupRef.current.scale.setScalar(a.packScale)
      }

      if (a.openTimer > 1.0 && !a.finishCalled) {
        a.finishCalled = true
        onFinishOpening()
      }
    }
  })

  // Pack split geometry with correct UVs
  const { topGeo, bottomGeo } = useMemo(() => {
    const tGeo = new THREE.PlaneGeometry(PACK_WIDTH, PACK_TOP_HEIGHT)
    const tUv = tGeo.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < tUv.count; i++) {
      const u = tUv.getX(i)
      const v = tUv.getY(i)
      tUv.setXY(i, u, 1 - PACK_TOP_HEIGHT / PACK_HEIGHT + v * (PACK_TOP_HEIGHT / PACK_HEIGHT))
    }
    tUv.needsUpdate = true

    const bGeo = new THREE.PlaneGeometry(PACK_WIDTH, PACK_BOTTOM_HEIGHT)
    const bUv = bGeo.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < bUv.count; i++) {
      const u = bUv.getX(i)
      const v = bUv.getY(i)
      bUv.setXY(i, u, v * (PACK_BOTTOM_HEIGHT / PACK_HEIGHT))
    }
    bUv.needsUpdate = true

    return { topGeo: tGeo, bottomGeo: bGeo }
  }, [])

  return (
    <group ref={packGroupRef}>
      {/* Dark border behind pack */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[PACK_WIDTH + 0.06, PACK_HEIGHT + 0.06]} />
        <meshPhysicalMaterial color="#1a1a2e" roughness={0.4} metalness={0.3} />
      </mesh>

      {/* Top flap — pivot at tear line */}
      <group ref={topGroupRef} position={[0, PACK_TEAR_LINE_Y, 0]}>
        <mesh
          geometry={topGeo}
          position={[0, PACK_TOP_HEIGHT / 2, 0]}
          onPointerDown={handlePointerDown}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          <meshPhysicalMaterial
            map={packTexture}
            color="#ffffff"
            roughness={0.4}
            metalness={0.05}
            clearcoat={0.6}
            clearcoatRoughness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Bottom body */}
      <group ref={bottomGroupRef}>
        <mesh
          geometry={bottomGeo}
          position={[0, PACK_BOTTOM_CENTER_Y, 0]}
          onPointerDown={handlePointerDown}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          <meshPhysicalMaterial
            map={packTexture}
            color="#ffffff"
            roughness={0.4}
            metalness={0.05}
            clearcoat={0.6}
            clearcoatRoughness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Tear line indicator */}
      {boosterState === 'pack' && (
        <mesh position={[0, PACK_TEAR_LINE_Y, 0.005]}>
          <planeGeometry args={[PACK_WIDTH * 0.92, 0.012]} />
          <meshBasicMaterial color="#ffffff" opacity={0.25} transparent />
        </mesh>
      )}
    </group>
  )
}

/* ─── Pack Texture ─── */

function usePackTexture(): THREE.Texture {
  const [texture, setTexture] = useState<THREE.Texture>(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 716
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  })

  useEffect(() => {
    let cancelled = false
    textureLoader.load(
      '/textures/backs/card-back.png',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        if (!cancelled) setTexture(tex)
      },
      undefined,
      () => {},
    )
    return () => { cancelled = true }
  }, [])

  return texture
}

/* ─── Booster Card (reveal phase) ─── */

interface BoosterCardProps {
  card: Card
  index: number
  targetX: number
  revealed: boolean
  onReveal: () => void
}

function BoosterCard({ card, index, targetX, revealed, onReveal }: BoosterCardProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const { edgeGeometry, faceGeometry } = useCardGeometry()
  const [hovered, setHovered] = useState(false)

  const anim = useRef({
    x: 0,
    y: 0,
    rotY: Math.PI,
    targetRotY: Math.PI,
    scale: 0.5,
    entered: false,
  })

  useEffect(() => {
    const delay = index * 120
    const timer = setTimeout(() => {
      anim.current.entered = true
    }, delay)
    return () => clearTimeout(timer)
  }, [index])

  anim.current.targetRotY = revealed ? 0 : Math.PI

  useFrame((_state, delta) => {
    if (!groupRef.current) return
    const a = anim.current
    const speed = FLIP_SPEED * delta
    const targetScale = revealed ? 1.05 : 1.0

    if (a.entered) {
      a.x = lerp(a.x, targetX, speed)
      a.y = lerp(a.y, 0, speed)
      a.scale = lerp(a.scale, targetScale, speed)
    }

    a.rotY = lerp(a.rotY, a.targetRotY, speed)

    groupRef.current.position.x = a.x
    groupRef.current.position.y = a.y
    groupRef.current.rotation.y = a.rotY
    groupRef.current.scale.setScalar(a.scale)
  })

  const handleClick = useCallback(() => {
    if (!revealed) onReveal()
  }, [revealed, onReveal])

  const handlePointerEnter = useCallback(() => {
    if (!revealed) {
      setHovered(true)
      document.body.style.cursor = 'pointer'
    }
  }, [revealed])

  const handlePointerLeave = useCallback(() => {
    setHovered(false)
    document.body.style.cursor = 'auto'
  }, [])

  const isBlueprint = card.rarity === 'blueprint'
  const edgeColor = EDGE_COLORS[card.rarity] ?? EDGE_COLORS.classique
  const artworkTexture = useBoosterArtworkTexture(card)
  const backTexture = useBoosterBackTexture()

  // Holographic overlay for blueprint cards (front + back)
  const holoFrontRef = useRef<THREE.ShaderMaterial>(null!)
  const holoBackRef = useRef<THREE.ShaderMaterial>(null!)
  const holoFrontUniforms = useMemo(() => ({
    uBandPosition: { value: 0.5 },
    uIntensity: { value: 0.0 },
  }), [])
  const holoBackUniforms = useMemo(() => ({
    uBandPosition: { value: 0.5 },
    uIntensity: { value: 0.0 },
  }), [])

  // Time-based holo animation for booster cards
  useFrame((state) => {
    if (!isBlueprint) return
    const t = state.clock.elapsedTime
    const bandPos = Math.sin(t * 0.8) * 0.5 + 0.5
    const intensity = revealed ? 0.18 : 0.0
    if (holoFrontRef.current) {
      holoFrontRef.current.uniforms.uBandPosition!.value = bandPos
      holoFrontRef.current.uniforms.uIntensity!.value = intensity
    }
    if (holoBackRef.current) {
      holoBackRef.current.uniforms.uBandPosition!.value = bandPos
      holoBackRef.current.uniforms.uIntensity!.value = intensity
    }
  })

  return (
    <group
      ref={groupRef}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <mesh geometry={edgeGeometry} renderOrder={isBlueprint ? 2 : 0}>
        <meshPhysicalMaterial
          color={edgeColor}
          roughness={isBlueprint ? 0.1 : 0.3}
          metalness={isBlueprint ? 0.4 : 0.6}
          clearcoat={isBlueprint ? 1.0 : 0.5}
          clearcoatRoughness={isBlueprint ? 0.03 : 0.1}
          transparent={isBlueprint}
          opacity={isBlueprint ? 0.1 : 1}
          depthWrite={!isBlueprint}
          emissive={isBlueprint ? edgeColor : (hovered && !revealed ? '#ffffff' : '#000000')}
          emissiveIntensity={isBlueprint ? 0.2 : (hovered && !revealed ? 0.15 : 0)}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <mesh geometry={faceGeometry} position={[0, 0, CARD_DEPTH / 2 + CARD_BEVEL_THICKNESS + 0.001]} renderOrder={isBlueprint ? 3 : 1}>
        <meshPhysicalMaterial
          map={artworkTexture}
          roughness={isBlueprint ? 0.1 : 0.4}
          metalness={isBlueprint ? 0.2 : 0.04}
          clearcoat={isBlueprint ? 1.0 : 0.4}
          clearcoatRoughness={isBlueprint ? 0.03 : 0.15}
          envMapIntensity={isBlueprint ? 1.2 : 0.6}
          transparent={isBlueprint}
          opacity={isBlueprint ? 0.5 : 1}
          depthWrite={!isBlueprint}
          emissive={isBlueprint ? '#4fc3f7' : '#000000'}
          emissiveIntensity={isBlueprint ? 0.12 : 0}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Holographic rainbow overlay — front */}
      {isBlueprint && (
        <mesh geometry={faceGeometry} position={[0, 0, CARD_DEPTH / 2 + CARD_BEVEL_THICKNESS + 0.002]} renderOrder={4}>
          <shaderMaterial
            ref={holoFrontRef}
            vertexShader={HOLO_VERTEX}
            fragmentShader={HOLO_FRAGMENT}
            uniforms={holoFrontUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      {/* Holographic rainbow overlay — back */}
      {isBlueprint && (
        <mesh geometry={faceGeometry} position={[0, 0, -(CARD_DEPTH / 2 + CARD_BEVEL_THICKNESS + 0.002)]} rotation={[0, Math.PI, 0]} renderOrder={4}>
          <shaderMaterial
            ref={holoBackRef}
            vertexShader={HOLO_VERTEX}
            fragmentShader={HOLO_FRAGMENT}
            uniforms={holoBackUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      {!isBlueprint && (
        <mesh geometry={faceGeometry} position={[0, 0, -(CARD_DEPTH / 2 + CARD_BEVEL_THICKNESS + 0.001)]} rotation={[0, Math.PI, 0]} renderOrder={1}>
          <meshPhysicalMaterial
            map={backTexture}
            color="#ffffff"
            roughness={0.4}
            metalness={0.04}
            clearcoat={0.4}
            clearcoatRoughness={0.15}
            envMapIntensity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

/* ─── Texture hooks ─── */

function createFallbackTexture(card: Card): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 716
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#2a2a3a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(card.name, canvas.width / 2, canvas.height / 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function useBoosterArtworkTexture(card: Card): THREE.Texture {
  const [texture, setTexture] = useState<THREE.Texture>(() => createFallbackTexture(card))

  useEffect(() => {
    let cancelled = false
    textureLoader.load(
      card.artworkUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        if (!cancelled) setTexture(tex)
      },
      undefined,
      () => {},
    )
    return () => { cancelled = true }
  }, [card.artworkUrl])

  return texture
}

function createBackFallbackTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 716
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function useBoosterBackTexture(): THREE.Texture {
  const [texture, setTexture] = useState<THREE.Texture>(() => createBackFallbackTexture())

  useEffect(() => {
    let cancelled = false
    textureLoader.load(
      '/textures/backs/card-back.png',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        if (!cancelled) setTexture(tex)
      },
      undefined,
      () => {},
    )
    return () => { cancelled = true }
  }, [])

  return texture
}
