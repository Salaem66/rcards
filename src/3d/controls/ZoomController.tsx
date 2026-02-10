import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { lerp, clamp } from '@/utils/mathUtils'
import type { ViewMode } from '@/hooks/useCardStore'

const ZOOM_SPEED = 0.8
const ZOOM_SMOOTH = 6
const SCROLL_SPEED = 0.008

// Min/max camera Z per view mode
const ZOOM_LIMITS: Record<ViewMode, { min: number; max: number }> = {
  gallery: { min: 10, max: 10 },
  inspect: { min: 3, max: 8 },
  booster: { min: 8, max: 18 },
}

interface ZoomControllerProps {
  viewMode: ViewMode
  contentHeight?: number
}

export function ZoomController({ viewMode, contentHeight = 0 }: ZoomControllerProps) {
  const { camera, gl } = useThree()
  const targetZ = useRef(camera.position.z)
  const targetY = useRef(0)
  const limits = ZOOM_LIMITS[viewMode]

  // Reset target when switching views
  useEffect(() => {
    targetZ.current = viewMode === 'inspect' ? 6 : viewMode === 'booster' ? 12 : 10
    if (viewMode === 'gallery' && contentHeight > 0) {
      // Start camera at the top of the gallery content
      const startY = contentHeight / 2 - 2
      targetY.current = startY
      camera.position.y = startY
    } else {
      targetY.current = 0
      camera.position.y = 0
    }
  }, [viewMode, camera, contentHeight])

  // Attach wheel listener to the canvas DOM element
  useEffect(() => {
    const domElement = gl.domElement

    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      if (viewMode === 'gallery') {
        const maxScrollDown = Math.max(0, contentHeight / 2)
        const maxScrollUp = contentHeight > 0 ? contentHeight / 2 - 3.5 : 0
        targetY.current = clamp(targetY.current - e.deltaY * SCROLL_SPEED, -maxScrollDown, maxScrollUp)
      } else {
        const delta = e.deltaY > 0 ? ZOOM_SPEED : -ZOOM_SPEED
        targetZ.current = clamp(targetZ.current + delta, limits.min, limits.max)
      }
    }

    domElement.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      domElement.removeEventListener('wheel', handleWheel)
    }
  }, [gl.domElement, limits, viewMode, contentHeight])

  useFrame((_state, delta) => {
    camera.position.z = lerp(camera.position.z, targetZ.current, ZOOM_SMOOTH * delta)
    if (viewMode === 'gallery') {
      camera.position.y = lerp(camera.position.y, targetY.current, ZOOM_SMOOTH * delta)
    }
  })

  return null
}
