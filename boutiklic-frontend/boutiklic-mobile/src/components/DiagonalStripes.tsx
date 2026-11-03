import Svg, { Defs, Pattern, Rect } from 'react-native-svg'

interface DiagonalStripesProps {
  width?: number | string
  height?: number | string
  color?: string
  opacity?: number
  stripeWidth?: number
  gap?: number
}

/** Remplace les textures décoratives `backgroundImage: repeating-linear-gradient(...)` du web
 *  (Splash, Home) — pas d'équivalent CSS en RN, rendu ici en SVG. */
export function DiagonalStripes({
  width = '100%',
  height = '100%',
  color = '#FFFFFF',
  opacity = 0.15,
  stripeWidth = 2,
  gap = 8,
}: DiagonalStripesProps) {
  const patternSize = stripeWidth + gap
  const patternId = 'diagonalStripes'

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <Pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={patternSize}
          height={patternSize}
          patternTransform="rotate(45)"
        >
          <Rect width={stripeWidth} height={patternSize} fill={color} opacity={opacity} />
        </Pattern>
      </Defs>
      <Rect width={width} height={height} fill={`url(#${patternId})`} />
    </Svg>
  )
}
