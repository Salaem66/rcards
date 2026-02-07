import { Environment } from '@react-three/drei'

export function EnvironmentMap() {
  return (
    <Environment
      preset="city"
      background={false}
      environmentIntensity={1.2}
    />
  )
}
