import { View, Text } from 'react-native'
import { ArrowUp } from 'lucide-react-native'
import { DiagonalStripes } from './DiagonalStripes'

type Variant = 'indigo' | 'emerald' | 'terracotta' | 'gold'

interface KpiCardProps {
  label: string
  value: string
  trend?: string
  caption?: string
  variant: Variant
}

const variantStyles: Record<Variant, { bg: string; border?: string; label: string; value: string; trend: string }> = {
  indigo: { bg: 'bg-primary', label: 'text-papier/60', value: 'text-papier', trend: 'text-[#8FD3AF]' },
  emerald: { bg: 'bg-[#E6F1EC]', border: 'border border-[#CBE1D7]', label: 'text-[#3F7A61]', value: 'text-[#1F5C43]', trend: 'text-success' },
  terracotta: { bg: 'bg-[#F7E3E1]', border: 'border border-[#F0C9C2]', label: 'text-[#8F3B23]', value: 'text-[#8F3B23]', trend: 'text-[#A9553C]' },
  gold: { bg: 'bg-[#FEF4E6]', border: 'border border-[#EED9AE]', label: 'text-[#8A6712]', value: 'text-[#6B5410]', trend: 'text-[#8A6712]' },
}

export default function KpiCard({ label, value, trend, caption, variant }: KpiCardProps) {
  const s = variantStyles[variant]
  return (
    <View className={`p-4 rounded-[18px] gap-1.5 overflow-hidden relative ${s.bg} ${s.border ?? ''}`}>
      {variant === 'indigo' && <DiagonalStripes color="#FFFDFA" opacity={0.05} stripeWidth={3} gap={11} />}
      <Text className={`text-[11px] font-extrabold tracking-[.09em] ${s.label}`}>{label}</Text>
      <Text className={`amount text-2xl font-extrabold ${s.value}`}>{value}</Text>
      {trend && (
        <View className="flex-row items-center gap-1">
          <ArrowUp size={14} strokeWidth={3} color={variant === 'indigo' ? '#8FD3AF' : '#0E7A52'} />
          <Text className={`text-[13px] font-extrabold ${s.trend}`}>{trend}</Text>
        </View>
      )}
      {caption && <Text className={`text-[13px] font-bold ${s.trend}`}>{caption}</Text>}
    </View>
  )
}
