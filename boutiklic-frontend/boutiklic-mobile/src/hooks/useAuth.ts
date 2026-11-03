import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getAccessToken, getUserId, getUserRole, getActiveTenantId, AUTH_CHANGED_EVENT, notifyAuthChanged } from '../lib/session'
import { emitter } from '../lib/eventBus'

export { notifyAuthChanged }

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  hasCompletedOnboarding: boolean
  user: { id: string; role: string; tenantId: string } | null
}

async function readAuthState(): Promise<Omit<AuthState, 'isLoading'>> {
  const [token, onboarding, userId, tenantId] = await Promise.all([
    getAccessToken(),
    AsyncStorage.getItem('boutiklic_onboarding'),
    getUserId(),
    getActiveTenantId(),
  ])
  if (token && userId && tenantId) {
    const role = (await getUserRole()) ?? 'OWNER'
    return {
      isAuthenticated: true,
      hasCompletedOnboarding: true,
      user: { id: userId, role, tenantId },
    }
  }
  return {
    isAuthenticated: false,
    hasCompletedOnboarding: !!onboarding,
    user: null,
  }
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    hasCompletedOnboarding: false,
    user: null,
    isLoading: true,
  })

  useEffect(() => {
    let mounted = true

    readAuthState().then((s) => {
      if (mounted) setState({ ...s, isLoading: false })
    })

    const onAuthChanged = () => {
      readAuthState().then((s) => {
        if (mounted) setState((prev) => ({ ...s, isLoading: prev.isLoading }))
      })
    }
    emitter.on(AUTH_CHANGED_EVENT, onAuthChanged)

    return () => {
      mounted = false
      emitter.off(AUTH_CHANGED_EVENT, onAuthChanged)
    }
  }, [])

  return state
}
