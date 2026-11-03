import Svg, { Path, Rect } from 'react-native-svg'

export const FingerprintIcon = ({ color = '#111418', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round">
    <Path d="M12 4a6 6 0 0 1 6 6v3M6 10a6 6 0 0 1 3-5.2M6 13v3m3-6a3 3 0 0 1 6 0v5m-3-5v7m3 1v1M9 16v3" />
  </Svg>
)

export const PhoneIcon = ({ color, size = 15 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.78.6 2.63a2 2 0 0 1-.45 2.11L8.09 9.63a16 16 0 0 0 6 6l1.17-1.17a2 2 0 0 1 2.11-.45c.85.28 1.73.48 2.63.6A2 2 0 0 1 22 16.92z" />
  </Svg>
)

export const EmailIcon = ({ color, size = 15 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="2" y="4" width="20" height="16" rx="2" />
    <Path d="m2 7 10 6 10-6" />
  </Svg>
)
