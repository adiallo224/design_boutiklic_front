import { apiClient } from './apiClient'

export interface CurrentUserResponse {
  userId: string
  tenantId: string
  phone: string | null
  email: string | null
  displayName: string
  role: string
  avatarUrl: string | null
  language: string
  birthDate: string | null
  gender: string | null
  secondaryContact: string | null
  addressLine: string | null
  city: string | null
  countryId: string | null
  jobTitle: string | null
}

export interface UpdatePersonalProfileRequest {
  birthDate: string | null
  gender: string | null
  secondaryContact: string | null
  addressLine: string | null
  city: string | null
  countryId: string | null
  jobTitle: string | null
  /** Code à 6 chiffres reçu sur le contact principal, exigé quand le contact secondaire est ajouté/modifié. */
  secondaryContactCode?: string | null
}

/** Client typé du module identity/me : profil du compte courant (icône profil, écran caisse). */
export const userApi = {
  getMe: () => apiClient.get<CurrentUserResponse>('/identity/me'),

  updateDisplayName: (displayName: string) => apiClient.patch<void>('/identity/me', { displayName }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post<void>('/identity/me/password', { currentPassword, newPassword }),

  /** Vérifie le mot de passe sans le changer (déverrouillage de l'écran de verrouillage auto, A4). */
  verifyPassword: (password: string) => apiClient.post<void>('/identity/me/verify-password', { password }),

  updateAvatar: (avatarUrl: string) => apiClient.patch<void>('/identity/me/avatar', { avatarUrl }),

  updateLanguage: (language: string) => apiClient.patch<void>('/identity/me/language', { language }),

  updatePersonalProfile: (profile: UpdatePersonalProfileRequest) => apiClient.patch<void>('/identity/me/personal-profile', profile),

  /** Envoie le code de confirmation du contact secondaire au contact principal (email ou SMS). */
  requestSecondaryContactOtp: () => apiClient.post<void>('/identity/me/secondary-contact/otp'),
}
