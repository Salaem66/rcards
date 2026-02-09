import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useCardGeometry, CARD_DEPTH, CARD_BEVEL_THICKNESS } from '@/3d/card/CardGeometry'
import { HOLO_VERTEX, HOLO_FRAGMENT } from '@/3d/card/holoShaders'
import { EnvironmentMap } from '@/3d/environment/EnvironmentMap'
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

// Drag rotation settings
const DRAG_SENSITIVITY = 0.008
const DRAG_DAMPING = 6
const MAX_TILT_X = 1.2 // ~70 degrees
const IDLE_TIMEOUT = 3000 // ms before auto-rotate starts
const IDLE_SWAY_SPEED = 0.3
const IDLE_SWAY_AMOUNT = 0.15

interface InspectSceneProps {
  card: Card
  flipped: boolean
  onFlip: () => void
}

export function InspectScene({ card, flipped, onFlip }: InspectSceneProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const lightRef = useRef<THREE.SpotLight>(null!)
  const { edgeGeometry, faceGeometry } = useCardGeometry()

  const drag = useRef({
    isDragging: false,
    prevX: 0,
    prevY: 0,
    velocityX: 0,
    velocityY: 0,
    rotX: 0,
    rotY: 0,
    targetRotX: 0,
    targetRotY: 0,
    flipY: 0,
    targetFlipY: 0,
    lastInteraction: Date.now(),
  })

  // Track flip target
  drag.current.targetFlipY = flipped ? Math.PI : 0

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    drag.current.isDragging = true
    drag.current.prevX = e.clientX
    drag.current.prevY = e.clientY
    drag.current.velocityX = 0
    drag.current.velocityY = 0
    drag.current.lastInteraction = Date.now()
  }, [])

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!drag.current.isDragging) return
      e.stopPropagation()

      const dx = e.clientX - drag.current.prevX
      const dy = e.clientY - drag.current.prevY

      drag.current.velocityX = dx * DRAG_SENSITIVITY
      drag.current.velocityY = dy * DRAG_SENSITIVITY

      drag.current.targetRotY += dx * DRAG_SENSITIVITY
      drag.current.targetRotX += dy * DRAG_SENSITIVITY
      drag.current.targetRotX = clamp(drag.current.targetRotX, -MAX_TILT_X, MAX_TILT_X)

      drag.current.prevX = e.clientX
      drag.current.prevY = e.clientY
      drag.current.lastInteraction = Date.now()
    },
    [],
  )

  const handlePointerUp = useCallback(() => {
    drag.current.isDragging = false
  }, [])

  const handleDoubleClick = useCallback(() => {
    onFlip()
  }, [onFlip])

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const d = drag.current
    const speed = DRAG_DAMPING * delta

    // Inertia when not dragging
    if (!d.isDragging) {
      d.targetRotY += d.velocityX * 0.95
      d.targetRotX += d.velocityY * 0.95
      d.velocityX *= 0.92
      d.velocityY *= 0.92

      // Kill tiny velocities
      if (Math.abs(d.velocityX) < 0.0001) d.velocityX = 0
      if (Math.abs(d.velocityY) < 0.0001) d.velocityY = 0

      // Idle auto-rotate
      const idleTime = Date.now() - d.lastInteraction
      if (idleTime > IDLE_TIMEOUT && d.velocityX === 0 && d.velocityY === 0) {
        const t = state.clock.elapsedTime
        d.targetRotY = Math.sin(t * IDLE_SWAY_SPEED) * IDLE_SWAY_AMOUNT
        d.targetRotX = Math.sin(t * IDLE_SWAY_SPEED * 0.7) * IDLE_SWAY_AMOUNT * 0.5
      }
    }

    d.targetRotX = clamp(d.targetRotX, -MAX_TILT_X, MAX_TILT_X)

    // Smooth interpolation
    d.rotX = lerp(d.rotX, d.targetRotX, speed)
    d.rotY = lerp(d.rotY, d.targetRotY, speed)
    d.flipY = lerp(d.flipY, d.targetFlipY, speed)

    groupRef.current.rotation.x = d.rotX
    groupRef.current.rotation.y = d.rotY + d.flipY

    // Move key light to follow card rotation for dynamic highlights
    if (lightRef.current) {
      lightRef.current.position.x = 3 * Math.sin(d.rotY * 0.5)
      lightRef.current.position.z = 3 * Math.cos(d.rotY * 0.5) + 2
    }
  })

  const isBlueprint = card.rarity === 'blueprint'
  const edgeColor = EDGE_COLORS[card.rarity] ?? EDGE_COLORS.classique
  const artworkTexture = useInspectArtworkTexture(card)
  const backTexture = useInspectBackTexture()

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

  // Drive holo band from drag rotation — constant intensity
  useFrame(() => {
    if (!isBlueprint) return
    const d = drag.current
    const bandPos = (-d.rotX / MAX_TILT_X) * 0.4 + 0.5
    if (holoFrontRef.current) {
      holoFrontRef.current.uniforms.uBandPosition!.value = bandPos
      holoFrontRef.current.uniforms.uIntensity!.value = 0.2
    }
    if (holoBackRef.current) {
      holoBackRef.current.uniforms.uBandPosition!.value = bandPos
      holoBackRef.current.uniforms.uIntensity!.value = 0.2
    }
  })

  return (
    <>
      {/* Dramatic inspect lighting */}
      <ambientLight intensity={0.15} color="#f0f0ff" />
      <spotLight
        ref={lightRef}
        position={[3, 5, 5]}
        angle={Math.PI / 5}
        penumbra={0.6}
        intensity={3}
        color="#ffffff"
        castShadow
      />
      <pointLight position={[-2, 1, -3]} intensity={0.8} color="#4488ff" />
      <pointLight position={[0, -2, 2]} intensity={0.3} color="#ff8844" />

      <EnvironmentMap />

      {/* Invisible full-screen drag plane to catch pointer events beyond the card */}
      <mesh
        position={[0, 0, -1]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        visible={false}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial />
      </mesh>

      <group
        ref={groupRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Card body + edge */}
        <mesh geometry={edgeGeometry} renderOrder={isBlueprint ? 2 : 0}>
          <meshPhysicalMaterial
            color={edgeColor}
            roughness={isBlueprint ? 0.1 : 0.25}
            metalness={isBlueprint ? 0.4 : 0.7}
            clearcoat={isBlueprint ? 1.0 : 0.6}
            clearcoatRoughness={isBlueprint ? 0.03 : 0.08}
            envMapIntensity={1.0}
            transparent={isBlueprint}
            opacity={isBlueprint ? 0.1 : 1}
            depthWrite={!isBlueprint}
            emissive={isBlueprint ? edgeColor : '#000000'}
            emissiveIntensity={isBlueprint ? 0.2 : 0}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
        {/* Front face */}
        <mesh geometry={faceGeometry} position={[0, 0, CARD_DEPTH / 2 + CARD_BEVEL_THICKNESS + 0.001]} renderOrder={isBlueprint ? 3 : 1}>
          <meshPhysicalMaterial
            map={artworkTexture}
            roughness={isBlueprint ? 0.1 : 0.35}
            metalness={isBlueprint ? 0.2 : 0.04}
            clearcoat={isBlueprint ? 1.0 : 0.4}
            clearcoatRoughness={isBlueprint ? 0.03 : 0.1}
            envMapIntensity={isBlueprint ? 1.2 : 0.72}
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
        {/* Back face — blueprint cards have no back */}
        {!isBlueprint && (
          <mesh geometry={faceGeometry} position={[0, 0, -(CARD_DEPTH / 2 + CARD_BEVEL_THICKNESS + 0.001)]} rotation={[0, Math.PI, 0]} renderOrder={1}>
            <meshPhysicalMaterial
              map={backTexture}
              color="#ffffff"
              roughness={0.35}
              metalness={0.04}
              clearcoat={0.4}
              clearcoatRoughness={0.1}
              envMapIntensity={0.72}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </group>
    </>
  )
}

function useInspectArtworkTexture(card: Card): THREE.Texture {
  const fallback = useState(() => {
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
  })[0]

  const [texture, setTexture] = useState<THREE.Texture>(fallback)

  useEffect(() => {
    let cancelled = false
    textureLoader.load(
      card.artworkUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        if (!cancelled) setTexture(tex)
      },
      undefined,
      () => { /* PNG not found, keep fallback */ },
    )
    return () => { cancelled = true }
  }, [card.artworkUrl, fallback])

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

function useInspectBackTexture(): THREE.Texture {
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
