import { Passkey, type PasskeyCreateRequest, type PasskeyCreateResult, type PasskeyGetRequest, type PasskeyGetResult } from 'react-native-passkey'
import { apiClient } from './apiClient'
import type { AuthSessionResponse } from './authApi'

export interface WebAuthnStatusResponse {
  enabled: boolean
}

/** Client typé du module identity/webauthn — cf. boutiklic-core WebAuthnController (écrans A3/A4).
 * Les options/réponses de cérémonie transitent au format WebAuthn Level 3 JSON, structurellement
 * identique aux types PasskeyCreateRequest/Result et PasskeyGetRequest/Result de react-native-passkey
 * (même endpoints que le web, aucune adaptation serveur). */
export const webauthnApi = {
  /** État réel du toggle "Empreinte digitale" pour CET appareil (pas le compte entier). */
  getStatus: () => apiClient.get<WebAuthnStatusResponse>('/identity/webauthn/credentials/status'),

  startRegistration: () => apiClient.post<PasskeyCreateRequest>('/identity/webauthn/registration/options'),

  finishRegistration: (credential: PasskeyCreateResult) =>
    apiClient.post<void>('/identity/webauthn/registration/verify', { credential }),

  removeCredential: () => apiClient.delete<void>('/identity/webauthn/credentials'),

  /** PRE-authentification (écran login, A3) — n'a de sens que sur un appareil déjà connu. */
  startAuthentication: (payload: { tenantId: string; userId: string; deviceId: string }) =>
    apiClient.post<PasskeyGetRequest>('/identity/webauthn/authentication/options', payload),

  finishAuthentication: (payload: { tenantId: string; userId: string; deviceId: string; credential: PasskeyGetResult }) =>
    apiClient.post<AuthSessionResponse>('/identity/webauthn/authentication/verify', payload),
}

/** true si cet appareil peut créer/utiliser un passkey natif — à vérifier avant d'afficher tout
 * bouton empreinte (écrans A3/A4). */
export function isPasskeySupported(): boolean {
  return Passkey.isSupported()
}

/** Cérémonie complète d'enregistrement (écran Sécurité, A4, toggle ON) — déclenche l'overlay
 * biométrique natif de l'OS. */
export async function registerWebAuthnCredential(): Promise<void> {
  const request = await webauthnApi.startRegistration()
  const result = await Passkey.create(request)
  await webauthnApi.finishRegistration(result)
}

/** Cérémonie complète de connexion par empreinte (écran Login, A3). */
export async function loginWithWebAuthnCredential(tenantId: string, userId: string, deviceId: string): Promise<AuthSessionResponse> {
  const request = await webauthnApi.startAuthentication({ tenantId, userId, deviceId })
  const result = await Passkey.get(request)
  return webauthnApi.finishAuthentication({ tenantId, userId, deviceId, credential: result })
}
