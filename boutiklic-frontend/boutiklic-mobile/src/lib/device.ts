import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import * as ExpoDevice from 'expo-device'
import { Platform } from 'react-native'

const DEVICE_ID_KEY = 'boutiklic_device_id'

/** Identifiant d'appareil stable pour cet appareil (persisté, requis par register/login/refresh). */
export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = Crypto.randomUUID()
    await AsyncStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function getDeviceName(): string {
  return ExpoDevice.deviceName ?? 'Appareil mobile'
}

export const DEVICE_PLATFORM = Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB'
