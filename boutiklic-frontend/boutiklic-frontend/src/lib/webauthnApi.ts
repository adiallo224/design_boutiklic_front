import { apiClient } from './apiClient'
import type { AuthSessionResponse } from './authApi'
import i18n from '../i18n'

export interface WebAuthnStatusResponse {
  enabled: boolean
}

/** Client typé du module identity/webauthn — cf. boutiklic-core WebAuthnController (écrans A3/A4).
 * Les options/réponses de cérémonie transitent au format WebAuthn Level 3 JSON natif du navigateur
 * (PublicKeyCredential.parseCreationOptionsFromJSON/toJSON) — pas de conversion base64url manuelle. */
export const webauthnApi = {
  /** État réel du toggle "Empreinte digitale" pour CET appareil (pas le compte entier). */
  getStatus: () => apiClient.get<WebAuthnStatusResponse>('/identity/webauthn/credentials/status'),

  startRegistration: () => apiClient.post<PublicKeyCredentialCreationOptionsJSON>('/identity/webauthn/registration/options'),

  finishRegistration: (credential: PublicKeyCredentialJSON) =>
    apiClient.post<void>('/identity/webauthn/registration/verify', { credential }),

  removeCredential: () => apiClient.delete<void>('/identity/webauthn/credentials'),

  /** PRE-authentification (écran login, A3) — n'a de sens que sur un appareil déjà connu. */
  startAuthentication: (payload: { tenantId: string; userId: string; deviceId: string }) =>
    apiClient.post<PublicKeyCredentialRequestOptionsJSON>('/identity/webauthn/authentication/options', payload),

  finishAuthentication: (payload: { tenantId: string; userId: string; deviceId: string; credential: PublicKeyCredentialJSON }) =>
    apiClient.post<AuthSessionResponse>('/identity/webauthn/authentication/verify', payload),
}

/** true si cet appareil a un capteur biométrique/Windows Hello utilisable — à vérifier avant
 * d'afficher tout bouton empreinte (écrans A3/A4), navigator.credentials n'existe pas partout. */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
    return false
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/** Cérémonie complète d'enregistrement (écran Sécurité, A4, toggle ON) — déclenche le prompt
 * biométrique natif du navigateur/OS. */
export async function registerWebAuthnCredential(): Promise<void> {
  const optionsJson = await webauthnApi.startRegistration()
  const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(optionsJson)
  const credential = await navigator.credentials.create({ publicKey })
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error(i18n.t('auth.fingerprintCreateFailed'))
  }
  await webauthnApi.finishRegistration(credential.toJSON())
}

/** Cérémonie complète de connexion par empreinte (écran Login, A3). */
export async function loginWithWebAuthnCredential(tenantId: string, userId: string, deviceId: string): Promise<AuthSessionResponse> {
  const optionsJson = await webauthnApi.startAuthentication({ tenantId, userId, deviceId })
  const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(optionsJson)
  const credential = await navigator.credentials.get({ publicKey })
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error(i18n.t('auth.fingerprintVerifyFailed'))
  }
  return webauthnApi.finishAuthentication({ tenantId, userId, deviceId, credential: credential.toJSON() })
}
