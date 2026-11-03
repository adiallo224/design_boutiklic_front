const DEVICE_ID_KEY = 'boutiklic_device_id'

/** Identifiant d'appareil stable pour ce navigateur (persisté, requis par register/login/refresh). */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function getDeviceName(): string {
  return 'Navigateur Web'
}

export const DEVICE_PLATFORM = 'WEB'
