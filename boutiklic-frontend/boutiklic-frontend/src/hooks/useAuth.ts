import { useState, useEffect } from 'react'
import { getAccessToken, getUserId, getUserRole, getActiveTenantId, AUTH_CHANGED_EVENT, notifyAuthChanged } from '../lib/session'

export { notifyAuthChanged }

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  hasCompletedOnboarding: boolean
  user: { id: string; role: string; tenantId: string } | null
}

function readAuthState(): Omit<AuthState, 'isLoading'> {
  const token = getAccessToken()
  const onboarding = localStorage.getItem('boutiklic_onboarding')
  const userId = getUserId()
  const tenantId = getActiveTenantId()
  if (token && userId && tenantId) {
    return {
      isAuthenticated: true,
      hasCompletedOnboarding: true,
      user: { id: userId, role: getUserRole() ?? 'OWNER', tenantId },
    }
  }
  return {
    isAuthenticated: false,
    hasCompletedOnboarding: !!onboarding,
    user: null,
  }
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ ...readAuthState(), isLoading: true })

  useEffect(() => {
    setState({ ...readAuthState(), isLoading: false })

    const onAuthChanged = () => {
      setState((prev) => ({ ...readAuthState(), isLoading: prev.isLoading }))
    }
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged)

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
    }
  }, [])

  return state
}
