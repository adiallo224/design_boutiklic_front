import { apiClient } from './apiClient'

export interface CategoryResponse {
  id: string
  name: string
  color: string
  icon: string | null
  parentId: string | null
  depth: number
  /** Ordre d'affichage parmi les catégories de même parent (écran W37). */
  position: number
  /** TVA propre à la catégorie ; null = hérite du parent, puis du défaut de la boutique. */
  taxCategoryId: string | null
}

export interface CreateCategoryRequest {
  name: string
  color: string
  icon?: string
  parentId?: string
}

/** Remplacement complet : `parentId` absent = catégorie principale. */
export interface UpdateCategoryRequest {
  name: string
  color: string
  icon?: string
  parentId?: string | null
}

/** Client typé du module product_catalog/categories — cf. boutiklic-core CategoryController (écrans C4, W37). */
export const categoriesApi = {
  getAll: () => apiClient.get<CategoryResponse[]>('/categories'),
  create: (payload: CreateCategoryRequest) => apiClient.post<CategoryResponse>('/categories', payload),
  update: (categoryId: string, payload: UpdateCategoryRequest) =>
    apiClient.put<CategoryResponse>(`/categories/${categoryId}`, payload),
  /** Fixe (ou retire, avec null) la TVA propre de la catégorie — cascade article > catégorie > boutique. */
  changeTaxCategory: (categoryId: string, taxCategoryId: string | null) =>
    apiClient.patch<CategoryResponse>(`/categories/${categoryId}/tax-category`, { taxCategoryId }),
  /** Les articles repassent « Non classés », les sous-catégories remontent d'un niveau. */
  remove: (categoryId: string) => apiClient.delete<void>(`/categories/${categoryId}`),
  /** Ordre COMPLET des catégories d'un même parent (`parentId` null = catégories principales). */
  reorder: (parentId: string | null, orderedIds: string[]) => apiClient.put<void>('/categories/reorder', { parentId, orderedIds }),
}
