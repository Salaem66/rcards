export const HOLO_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const HOLO_FRAGMENT = `
  varying vec2 vUv;
  uniform float uBandPosition;
  uniform float uIntensity;

  void main() {
    float bandWidth = 0.15;
    float angled = vUv.y + vUv.x * 0.2;
    float dist = abs(angled - uBandPosition);
    float band = smoothstep(bandWidth, 0.0, dist);

    // Rainbow color from horizontal position + band offset
    float t = vUv.x * 0.8 + uBandPosition * 2.0;
    vec3 color = 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));

    gl_FragColor = vec4(color, band * uIntensity);
  }
`
