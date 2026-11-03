export interface StepDef {
  id: string
  labelKey: string
}

/** Rail d'étapes bureau pour W10 (création de compte + boutique, AuthFlow → ShopSetupFlow) —
 *  la vérification du code (W11) reste un écran centré indépendant, hors rail (cf. spec). Chaque
 *  écran traduit `labelKey` lui-même au rendu (StepRail attend du texte déjà résolu). */
export const SIGNUP_STEPS: StepDef[] = [
  { id: 'compte', labelKey: 'auth.stepAccount' },
  { id: 'pays', labelKey: 'auth.stepCountry' },
  { id: 'boutique', labelKey: 'auth.stepShop' },
  { id: 'activite', labelKey: 'auth.stepActivity' },
]

/** Même rail sans l'étape "Compte" — ajout d'une boutique à un compte déjà authentifié
 *  (W6 "Mes boutiques" → CreateShop.tsx, pas de nouvel OTP). */
export const ADD_SHOP_STEPS: StepDef[] = [
  { id: 'pays', labelKey: 'auth.stepCountry' },
  { id: 'boutique', labelKey: 'auth.stepShop' },
  { id: 'activite', labelKey: 'auth.stepActivity' },
]
