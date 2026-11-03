import '../global.css'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View, Text } from 'react-native'
import { useAuth } from '../src/hooks/useAuth'
import { useIdleTimer } from '../src/hooks/useIdleTimer'
import LockScreen from '../src/components/LockScreen'
import i18n from '../src/i18n'
import { getLanguage } from '../src/lib/language'
import { syncEngine } from '../src/lib/syncEngine'
import { registerCatalogSyncHandlers, backfillCatalogIfEmpty } from '../src/lib/watermelon/catalogSync'

/** Reproduit le gate isLoading/isAuthenticated de App.tsx (web) : Splash pendant le chargement,
 *  puis routes non-authentifiées OU (tabs), jamais les deux en même temps. */
function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth()
  // Monté ici (racine, hors des routes) pour couvrir toute la app authentifiée quel que soit
  // l'onglet actif — cf. Sécurité, A4. onTouchStart capture les taps sans intercepter le geste.
  const { locked, unlock, bumpActivity } = useIdleTimer(isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) return
    // Amorce le catalogue offline (cf. lib/watermelon/catalogSync.ts, plan offline-first Phase 3) et
    // resynchronise à chaque retour réseau — registerChangeHandler est idempotent (Map.set), sûr à
    // rappeler à chaque connexion (changement de compte/boutique compris).
    registerCatalogSyncHandlers()
    backfillCatalogIfEmpty().catch(() => undefined)
    return syncEngine.startAutoSync()
  }, [isAuthenticated])

  if (isLoading) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <Text className="text-papier font-display text-2xl">BOUTIKLIC</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }} onTouchStart={bumpActivity}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>

        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="login" />
          <Stack.Screen name="create-shop" />
        </Stack.Protected>
      </Stack>
      <LockScreen visible={isAuthenticated && locked} onUnlock={unlock} />
    </View>
  )
}

export default function RootLayout() {
  useEffect(() => {
    // Reprend la préférence persistée (AsyncStorage, async) une fois chargée — i18n a déjà démarré
    // sur la langue système en synchrone (cf. src/i18n/index.ts), le flash est négligeable.
    getLanguage().then(({ code }) => {
      if (code !== i18n.language) i18n.changeLanguage(code)
    })
  }, [])

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SafeAreaProvider>
  )
}
