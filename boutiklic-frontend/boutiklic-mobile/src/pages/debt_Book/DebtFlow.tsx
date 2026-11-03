import { useState } from 'react'
import { View } from 'react-native'
import OfflineBanner from '../../components/OfflineBanner'
import DebtBook from './DebtBook'
import DebtorDetail from './DebtorDetail'
import NewDebt from './NewDebt'
import DebtHistory from './DebtHistory'
import CustomerDirectory from '../customer/CustomerDirectory'

type SelectedDebtor = { customerPhone: string; urgency?: string; nearestDueDate?: string | null }

export default function DebtFlow() {
  const [selectedDebtor, setSelectedDebtor] = useState<SelectedDebtor | null>(null)
  const [showNewDebt, setShowNewDebt] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showCustomers, setShowCustomers] = useState(false)
  const [debtRefreshKey, setDebtRefreshKey] = useState(0)

  if (selectedDebtor) {
    return (
      <DebtorDetail
        customerPhone={selectedDebtor.customerPhone}
        urgency={selectedDebtor.urgency}
        nearestDueDate={selectedDebtor.nearestDueDate}
        onBack={() => setSelectedDebtor(null)}
      />
    )
  }

  if (showHistory) {
    return <DebtHistory onBack={() => setShowHistory(false)} onSelectDebt={setSelectedDebtor} />
  }

  if (showCustomers) {
    return <CustomerDirectory onBack={() => setShowCustomers(false)} />
  }

  if (showNewDebt) {
    return (
      <NewDebt
        onBack={() => setShowNewDebt(false)}
        onCreated={() => {
          setShowNewDebt(false)
          setDebtRefreshKey((k) => k + 1)
        }}
      />
    )
  }

  return (
    <View className="flex-1 bg-bg">
      <OfflineBanner />
      <DebtBook
        key={debtRefreshKey}
        onSelectDebt={setSelectedDebtor}
        onAddDebt={() => setShowNewDebt(true)}
        onOpenHistory={() => setShowHistory(true)}
        onOpenCustomers={() => setShowCustomers(true)}
      />
    </View>
  )
}
