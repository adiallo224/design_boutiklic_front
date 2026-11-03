import { Tabs } from 'expo-router'
import { useEffect, useState } from 'react'
import { View, Text, type ColorValue } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Home as HomeIcon, Calculator, Package, BarChart3, HandCoins, MoreHorizontal, type LucideIcon } from 'lucide-react-native'
import { inventoryApi } from '../../src/lib/inventoryApi'

/** Repris du bloc @theme de src/index.css (web) — la barre d'onglets native ne peut pas consommer
 *  className sur ses propres options de navigation, donc ces valeurs sont dupliquées ici. */
const COLORS = {
  bg: '#FBF8F2',
  border: '#E9DFD2',
  primary: '#0E2038',
  textDim: '#A2A9B8',
  danger: '#C6362F',
  papier: '#FFFDFA',
  activePill: '#E4EAF2',
}

/** Port de components/layout/MainLayout.tsx (web) — barre à 6 onglets + badge alerte stock. */
export default function TabsLayout() {
  const [stockAlertCount, setStockAlertCount] = useState(0)
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  useEffect(() => {
    inventoryApi
      .getSummary()
      .then((s) => setStockAlertCount(s.lowStockCount + s.outOfStockCount))
      .catch(() => undefined)
  }, [])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textDim,
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
          height: 64 + insets.bottom,
          paddingTop: 10,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { paddingTop: insets.top, backgroundColor: COLORS.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('components.nav.home'),
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={HomeIcon} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cashier"
        options={{
          title: t('components.nav.cashier'),
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={Calculator} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: t('components.nav.stock'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Package} color={color} focused={focused} badge={stockAlertCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('components.nav.stats'),
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={BarChart3} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="debts"
        options={{
          title: t('components.nav.debts'),
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={HandCoins} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('components.nav.more'),
          tabBarIcon: ({ color, focused }) => <TabIcon Icon={MoreHorizontal} color={color} focused={focused} />,
        }}
      />
    </Tabs>
  )
}

function TabIcon({
  Icon,
  color,
  focused,
  badge,
}: {
  Icon: LucideIcon
  color: ColorValue
  focused: boolean
  badge?: number
}) {
  return (
    <View
      style={{
        position: 'relative',
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderRadius: 11,
        backgroundColor: focused ? COLORS.activePill : 'transparent',
      }}
    >
      <Icon size={21} strokeWidth={focused ? 2 : 1.8} color={color as string} />
      {!!badge && badge > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -6,
            minWidth: 15,
            height: 15,
            paddingHorizontal: 3,
            borderRadius: 8,
            backgroundColor: COLORS.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: COLORS.papier, fontSize: 9, fontWeight: '800' }}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </View>
  )
}
