import { useMemo } from 'react'
import * as THREE from 'three'

// Standard TCG card ratio: 2.5:3.5 (63mm × 88mm)
export const CARD_WIDTH = 2.5
export const CARD_HEIGHT = 3.5
export const CARD_DEPTH = 0.012
export const CARD_RADIUS = 0.12
export const CARD_BEVEL_THICKNESS = 0.002

interface CardGeometries {
  edgeGeometry: THREE.ExtrudeGeometry
  faceGeometry: THREE.BufferGeometry
}

function createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2

  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + r)
  shape.lineTo(x + w, y + h - r)
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  shape.lineTo(x + r, y + h)
  shape.quadraticCurveTo(x, y + h, x, y + h - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)

  return shape
}

export function useCardGeometry(): CardGeometries {
  return useMemo(() => {
    const w = CARD_WIDTH
    const h = CARD_HEIGHT
    const r = CARD_RADIUS

    // Edge geometry: extruded shape for the card body + bevel
    const edgeShape = createRoundedRectShape(w, h, r)
    const edgeGeometry = new THREE.ExtrudeGeometry(edgeShape, {
      depth: CARD_DEPTH,
      bevelEnabled: true,
      bevelThickness: CARD_BEVEL_THICKNESS,
      bevelSize: CARD_BEVEL_THICKNESS,
      bevelOffset: 0,
      bevelSegments: 3,
      curveSegments: 8,
    })
    edgeGeometry.translate(0, 0, -CARD_DEPTH / 2)

    // Face geometry: separate shape instance for the flat face
    const faceShape = createRoundedRectShape(w, h, r)
    const faceGeometry = new THREE.ShapeGeometry(faceShape)

    // Remap ShapeGeometry UVs from shape coords to [0, 1]
    const posAttr = faceGeometry.getAttribute('position') as THREE.BufferAttribute
    const uvAttr = faceGeometry.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < posAttr.count; i++) {
      const u = (posAttr.getX(i) + w / 2) / w
      const v = (posAttr.getY(i) + h / 2) / h
      uvAttr.setXY(i, u, v)
    }
    uvAttr.needsUpdate = true

    return { edgeGeometry, faceGeometry }
  }, [])
}
