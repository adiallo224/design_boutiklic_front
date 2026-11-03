import { apiClient } from './apiClient'

export interface TeamMemberResponse {
  userId: string
  phone: string | null
  email: string | null
  /** null tant que le membre invité n'a pas activé son compte (cf. User.invite côté backend). */
  displayName: string | null
  role: string
  status: string
  /** Permissions personnalisables accordées en plus du rôle (écran F2, "Permissions" — boutiques GRANDE). */
  extraPermissions: string[]
}

export type TeamRole = 'SELLER' | 'APPRENTICE' | 'SUPERVISOR'

export interface InviteTeamMemberRequest {
  phone?: string
  email?: string
  role: 'OWNER' | TeamRole
}

/** Catalogue statique des permissions personnalisables — cf. GetPermissionsCatalogUseCase côté backend. */
export interface PermissionCatalogEntry {
  name: string
  customizable: boolean
  defaultRoles: string[]
}

/** Client typé du module identity/team — cf. boutiklic-core TeamController (écran F2). */
export const teamApi = {
  getTeam: () => apiClient.get<TeamMemberResponse[]>('/identity/team'),

  invite: (payload: InviteTeamMemberRequest, shopName: string) =>
    apiClient.post<void>(`/identity/team/invite?shopName=${encodeURIComponent(shopName)}`, payload),

  getPermissionsCatalog: () => apiClient.get<PermissionCatalogEntry[]>('/identity/team/permissions-catalog'),

  grantPermission: (userId: string, permission: string) =>
    apiClient.post<void>(`/identity/team/${userId}/permissions/${permission}`),

  revokePermission: (userId: string, permission: string) =>
    apiClient.delete<void>(`/identity/team/${userId}/permissions/${permission}`),
}
