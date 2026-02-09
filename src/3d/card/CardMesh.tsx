import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useCardGeometry, CARD_DEPTH, CARD_BEVEL_THICKNESS } from './CardGeometry'
import { HOLO_VERTEX, HOLO_FRAGMENT } from './holoShaders'
import type { Card } from '@/data/types'
import { lerp, clamp } from '@/utils/mathUtils'

const textureLoader = new THREE.TextureLoader()

const EDGE_COLORS: Record<string, string> = {
  classique: '#e8e0d8',
  uncommon: '#c0c0c0',
  legendary: '#ffb830',
  historique: '#8b6914',
  concept: '#00ccff',
  blueprint: '#4fc3f7',
}

// Maximum tilt angle in radians (~12 degrees)
const MAX_TILT = 0.21
// Hover lift amount
const HOVER_LIFT = 0.25
// Smooth interpolation speed
const SMOOTH_SPEED = 8

interface CardMeshProps {
  card: Card
  position?: [number, number, number]
  onClick?: () => void
  inspectMode?: boolean
  flipped?: boolean
}

export function CardMesh({
  card,
  position = [0, 0, 0],
  onClick,
  inspectMode = false,
  flipped = false,
}: CardMeshProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const { edgeGeometry, faceGeometry } = useCardGeometry()
  const [hovered, setHovered] = useState(false)

  // Smooth animation values (current / target)
  const anim = useRef({
    tiltX: 0,
    tiltY: 0,
    targetTiltX: 0,
    targetTiltY: 0,
    liftY: 0,
    targetLiftY: 0,
    flipY: 0,
    targetFlipY: 0,
  })

  // Track the flip target
  anim.current.targetFlipY = flipped ? Math.PI : 0

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (inspectMode) return
      e.stopPropagation()

      // Get the intersection point in the mesh's local space
      const point = e.point
      const obj = groupRef.current
      if (!obj) return

      // Convert world intersection to local coordinates
      const local = obj.worldToLocal(point.clone())

      // Map local position to [-1, 1] range relative to card center
      // Card is 2.5 wide, 3.5 tall
      const nx = clamp(local.x / 1.25, -1, 1)
      const ny = clamp(local.y / 1.75, -1, 1)

      // Tilt toward the mouse: rotate around Y for horizontal, X for vertical
      // Invert Y-axis tilt so the card tilts "toward" the cursor
      anim.current.targetTiltX = -ny * MAX_TILT
      anim.current.targetTiltY = nx * MAX_TILT
    },
    [inspectMode],
  )

  const handlePointerEnter = useCallback(() => {
    if (inspectMode) return
    setHovered(true)
    anim.current.targetLiftY = HOVER_LIFT
    document.body.style.cursor = 'pointer'
  }, [inspectMode])

  const handlePointerLeave = useCallback(() => {
    if (inspectMode) return
    setHovered(false)
    anim.current.targetTiltX = 0
    anim.current.targetTiltY = 0
    anim.current.targetLiftY = 0
    document.body.style.cursor = 'auto'
  }, [inspectMode])

  useFrame((_state, delta) => {
    if (!groupRef.current) return
    const a = anim.current
    const speed = SMOOTH_SPEED * delta

    // Smoothly interpolate all values
    a.tiltX = lerp(a.tiltX, a.targetTiltX, speed)
    a.tiltY = lerp(a.tiltY, a.targetTiltY, speed)
    a.liftY = lerp(a.liftY, a.targetLiftY, speed)
    a.flipY = lerp(a.flipY, a.targetFlipY, speed)

    // Apply transforms
    groupRef.current.position.y = position[1] + a.liftY
    groupRef.current.rotation.x = a.tiltX
    groupRef.current.rotation.y = a.tiltY + a.flipY
  })

  const isBlueprint = card.rarity === 'blueprint'
  const edgeColor = EDGE_COLORS[card.rarity] ?? EDGE_COLORS.classique
  const artworkTexture = useCardArtworkTexture(card)
  const backTexture = useBackTexture()

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

  // Drive holo band from tilt + hover
  useFrame(() => {
    if (!isBlueprint) return
    const a = anim.current
    const bandPos = (-a.tiltX / MAX_TILT) * 0.4 + 0.5
    const intensity = hovered ? 0.21 : 0.0
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
      position={position}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {/* Card body + edge */}
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
          emissive={isBlueprint ? edgeColor : (hovered ? edgeColor : '#000000')}
          emissiveIntensity={isBlueprint ? 0.15 : (hovered ? 0.2 : 0)}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      {/* Front face */}
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
          emissiveIntensity={isBlueprint ? 0.08 : 0}
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
      {/* Back face — blueprint cards have no back */}
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

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
}

/**
 * Loads the card artwork from PNG. Falls back to a procedural texture
 * if the PNG file doesn't exist yet.
 */
function useCardArtworkTexture(card: Card): THREE.Texture {
  const [texture, setTexture] = useState<THREE.Texture>(() => createFallbackTexture(card))

  useEffect(() => {
    const url = card.artworkUrl
    let cancelled = false

    loadTexture(url).then(
      (tex) => { if (!cancelled) setTexture(tex) },
      () => { /* PNG not found, keep fallback */ },
    )

    return () => { cancelled = true }
  }, [card.artworkUrl, card.id])

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

function useBackTexture(): THREE.Texture {
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
      () => { /* No back texture found, keep fallback */ },
    )
    return () => { cancelled = true }
  }, [])

  return texture
}

function createFallbackTexture(card: Card): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 716

  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  const colors: Record<string, [string, string]> = {
    classique: ['#3a3a4a', '#2a2a3a'],
    uncommon: ['#2a4a3a', '#1a3a2a'],
    legendary: ['#4a2a1a', '#3a1a0a'],
    historique: ['#3a3020', '#2a2010'],
    concept: ['#102a3a', '#081a2a'],
    blueprint: ['#0a2a3a', '#051520'],
  }
  const [c1, c2] = colors[card.rarity] ?? colors.classique!
  gradient.addColorStop(0, c1!)
  gradient.addColorStop(1, c2!)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = EDGE_COLORS[card.rarity] ?? '#e8e0d8'
  ctx.lineWidth = 8
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 28px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(card.name, canvas.width / 2, 60)

  ctx.font = '14px Inter, sans-serif'
  ctx.fillStyle = EDGE_COLORS[card.rarity] ?? '#e8e0d8'
  ctx.fillText(`[ ${card.rarity.toUpperCase()} ]`, canvas.width / 2, 85)

  ctx.font = '100px serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
  const symbols: Record<string, string> = {
    classique: '\u25C6',
    uncommon: '\u25C8',
    legendary: '\u2726',
    historique: '\u2302',
    concept: '\u2B22',
    blueprint: '\u2B21',
  }
  ctx.fillText(symbols[card.rarity] ?? '\u25C6', canvas.width / 2, canvas.height / 2 + 30)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}
