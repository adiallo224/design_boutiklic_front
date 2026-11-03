import { ArrowUp } from 'lucide-react'

type Variant = 'indigo' | 'emerald' | 'terracotta' | 'gold'

interface KpiCardProps {
  label: string
  value: string
  trend?: string
  caption?: string
  variant: Variant
}

const variantStyles: Record<Variant, { bg: string; border?: string; label: string; value: string; trend: string }> = {
  indigo: { bg: 'bg-primary bg-[repeating-linear-gradient(45deg,rgba(255,253,250,.05)_0_3px,transparent_3px_14px)]', label: 'text-[#FFFDFA]/60', value: 'text-papier', trend: 'text-[#8FD3AF]' },
  emerald: { bg: 'bg-[#E6F1EC]', border: 'border border-[#CBE1D7]', label: 'text-[#3F7A61]', value: 'text-[#1F5C43]', trend: 'text-success' },
  terracotta: { bg: 'bg-[#F7E3E1]', border: 'border border-[#F0C9C2]', label: 'text-[#8F3B23]', value: 'text-[#8F3B23]', trend: 'text-[#A9553C]' },
  gold: { bg: 'bg-[#FEF4E6]', border: 'border border-[#EED9AE]', label: 'text-[#8A6712]', value: 'text-[#6B5410]', trend: 'text-[#8A6712]' },
}

export default function KpiCard({ label, value, trend, caption, variant }: KpiCardProps) {
  const s = variantStyles[variant]
  return (
    <div className={`min-w-0 p-3 sm:p-4 rounded-[18px] flex flex-col gap-1.5 ${s.bg} ${s.border ?? ''}`}>
      <div className={`break-words text-[10px] sm:text-[11px] font-extrabold tracking-[.09em] ${s.label}`}>{label}</div>
      <div className={`amount text-lg sm:text-2xl break-all font-extrabold ${s.value}`}>{value}</div>
      {trend && (
        <div className={`flex items-center gap-1 text-[13px] font-extrabold ${s.trend}`}>
          <ArrowUp size={14} strokeWidth={3} />
          {trend}
        </div>
      )}
      {caption && <div className={`text-xs sm:text-[13px] break-words font-bold ${s.trend}`}>{caption}</div>}
    </div>
  )
}
