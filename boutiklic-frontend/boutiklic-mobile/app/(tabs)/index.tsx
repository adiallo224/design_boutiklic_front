import { useRouter } from 'expo-router'
import Home from '../../src/pages/home_Accueil/Home'

export default function HomeTab() {
  const router = useRouter()

  return (
    <Home
      onNavigateToCashier={() => router.push('/cashier')}
      onNavigateToStock={() => router.push('/stock')}
      onNavigateToDebts={() => router.push('/debts')}
      onOpenSettings={() => router.push('/settings')}
      onOpenShopSwitcher={() => router.push('/settings')}
    />
  )
}
