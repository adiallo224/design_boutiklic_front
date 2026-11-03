import { apiClient } from './apiClient'

export interface UploadResponse {
  url: string
  fileName: string
}

/** Client typé du module file — cf. boutiklic-core FileController (logo boutique A5, image produit C3). */
export const fileApi = {
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<UploadResponse>('/files', formData)
  },
}
