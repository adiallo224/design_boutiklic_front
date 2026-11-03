import { useRouter } from 'expo-router'
import StatsFlow from '../../src/pages/reports_Analytics/StatsFlow'

export default function StatsTab() {
  const router = useRouter()
  return <StatsFlow onNavigateToStock={() => router.push('/stock')} />
}
