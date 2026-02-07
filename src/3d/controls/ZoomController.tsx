import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { lerp, clamp } from '@/utils/mathUtils'
import type { ViewMode } from '@/hooks/useCardStore'

const ZOOM_SPEED = 0.8
const ZOOM_SMOOTH = 6

// Min/max camera Z per view mode
const ZOOM_LIMITS: Record<ViewMode, { min: number; max: number }> = {
  gallery: { min: 5, max: 20 },
  inspect: { min: 3, max: 8 },
  booster: { min: 8, max: 18 },
}

interface ZoomControllerProps {
  viewMode: ViewMode
}

export function ZoomController({ viewMode }: ZoomControllerProps) {
  const { camera, gl } = useThree()
  const targetZ = useRef(camera.position.z)
  const limits = ZOOM_LIMITS[viewMode]

  // Reset target when switching views
  useEffect(() => {
    targetZ.current = viewMode === 'inspect' ? 6 : viewMode === 'booster' ? 12 : 10
  }, [viewMode])

  // Attach wheel listener to the canvas DOM element
  useEffect(() => {
    const domElement = gl.domElement

    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? ZOOM_SPEED : -ZOOM_SPEED
      targetZ.current = clamp(targetZ.current + delta, limits.min, limits.max)
    }

    domElement.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      domElement.removeEventListener('wheel', handleWheel)
    }
  }, [gl.domElement, limits])

  useFrame((_state, delta) => {
    camera.position.z = lerp(camera.position.z, targetZ.current, ZOOM_SMOOTH * delta)
  })

  return null
}
