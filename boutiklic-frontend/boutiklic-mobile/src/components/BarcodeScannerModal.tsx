import { useEffect, useState } from 'react'
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { useTranslation } from 'react-i18next'

interface BarcodeScannerModalProps {
  open: boolean
  onDetected: (code: string) => void
  onClose: () => void
}

/** Modale plein écran de scan caméra — premier point de l'app à demander la permission caméra,
 * cf. écrans B2 (caisse), C1 (stock), C3 (fiche produit), C5 (arrivage). Mirror fonctionnel de
 * components/BarcodeScannerModal.tsx côté web (qui utilise @zxing/browser + getUserMedia) — ici
 * expo-camera fournit le scan de codes-barres nativement (CameraView + onBarcodeScanned). */
export default function BarcodeScannerModal({ open, onDetected, onClose }: BarcodeScannerModalProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)

  useEffect(() => {
    if (open) setScanned(false)
  }, [open])

  const handleScanned = (result: BarcodeScanningResult) => {
    // onBarcodeScanned est rappelé en continu tant que la modale reste ouverte — un seul code
    // retenu par ouverture, mirror du contrôle "stop après premier résultat" du reader web.
    if (scanned) return
    setScanned(true)
    onDetected(result.data)
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-encre">
        <View className="flex-row items-center justify-between px-5 pb-3" style={{ paddingTop: insets.top + 12 }}>
          <Text className="text-papier text-base font-extrabold">{t('components.barcodeScanner.title')}</Text>
          <Pressable onPress={onClose} className="w-10 h-10 rounded-xl bg-papier/15 items-center justify-center">
            <X size={20} color="#FFFDFA" />
          </Pressable>
        </View>

        <View className="flex-1 items-center justify-center overflow-hidden">
          {!permission ? null : !permission.granted ? (
            <View className="px-8 items-center gap-4">
              <Text className="text-papier text-[13px] font-semibold text-center">
                {t('components.barcodeScanner.permissionRequired')}
              </Text>
              <Pressable onPress={requestPermission} className="px-5 py-3 rounded-xl bg-primary">
                <Text className="text-papier font-extrabold">{t('components.barcodeScanner.allowCamera')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
                onBarcodeScanned={handleScanned}
              />
              <View className="w-[78%] max-w-[360px] aspect-[3/2] rounded-2xl border-2 border-papier/80" />
            </>
          )}
        </View>

        <View className="px-5 pb-9 pt-3">
          <Text className="text-[13px] font-semibold text-papier/60 text-center">{t('components.barcodeScanner.hint')}</Text>
        </View>
      </View>
    </Modal>
  )
}
