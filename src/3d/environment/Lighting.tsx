export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.4} color="#f0f0ff" />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.0}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight
        position={[-3, 4, -2]}
        intensity={0.3}
        color="#e8e0ff"
      />
    </>
  )
}
