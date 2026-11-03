import { apiClient } from './apiClient'

export interface UploadResponse {
  url: string
  fileName: string
}

/** Forme attendue par RN FormData pour un fichier (résultat d'expo-image-picker) — pas de `File`
 *  global comme dans un navigateur. Câblé sur un vrai picker en Phase 2 (ShopIdentity/Security). */
export interface UploadableFile {
  uri: string
  name: string
  type: string
}

/** Client typé du module file — cf. boutiklic-core FileController (logo boutique A5, image produit C3). */
export const fileApi = {
  upload: (file: UploadableFile) => {
    const formData = new FormData()
    formData.append('file', file as unknown as Blob)
    return apiClient.post<UploadResponse>('/files', formData)
  },
}
