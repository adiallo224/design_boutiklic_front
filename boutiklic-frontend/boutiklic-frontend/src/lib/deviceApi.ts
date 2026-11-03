import { apiClient } from './apiClient'

export interface DeviceResponse {
  id: string
  deviceName: string
  platform: string
  lastActiveAt: string
  current: boolean
}

/** Client typé du module identity/devices — cf. boutiklic-core DeviceController (écran A4, "Sécurité"). */
export const deviceApi = {
  list: () => apiClient.get<DeviceResponse[]>('/identity/devices'),

  revoke: (deviceId: string) => apiClient.delete<void>(`/identity/devices/${deviceId}`),
}
