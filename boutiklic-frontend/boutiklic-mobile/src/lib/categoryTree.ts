import type { CategoryResponse } from './categoriesApi'

export interface CategoryTreeNode {
  category: CategoryResponse
  children: CategoryTreeNode[]
}

/** Construit l'arbre des catégories (jusqu'à 3 niveaux) à partir de la liste plate renvoyée par l'API. */
export function buildCategoryTree(categories: CategoryResponse[]): CategoryTreeNode[] {
  const byParent = new Map<string | null, CategoryResponse[]>()
  for (const category of categories) {
    const key = category.parentId ?? null
    const siblings = byParent.get(key) ?? []
    siblings.push(category)
    byParent.set(key, siblings)
  }

  const sortByName = (list: CategoryResponse[]) =>
    [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name))

  const toNode = (category: CategoryResponse): CategoryTreeNode => ({
    category,
    children: sortByName(byParent.get(category.id) ?? []).map(toNode),
  })

  return sortByName(byParent.get(null) ?? []).map(toNode)
}

/** Liste des catégories en ordre d'arbre (préordre) : chaque parent suivi de ses descendants. */
export function flattenCategoryTree(categories: CategoryResponse[]): CategoryResponse[] {
  const result: CategoryResponse[] = []
  const visit = (nodes: CategoryTreeNode[]) => {
    for (const node of nodes) {
      result.push(node.category)
      visit(node.children)
    }
  }
  visit(buildCategoryTree(categories))
  return result
}

/** Ensemble {catégorie + tous ses descendants}, utilisé pour agréger les produits d'une branche. */
export function descendantAndSelfIds(categoryId: string, categories: CategoryResponse[]): Set<string> {
  const childrenByParent = new Map<string, string[]>()
  for (const category of categories) {
    if (!category.parentId) continue
    const siblings = childrenByParent.get(category.parentId) ?? []
    siblings.push(category.id)
    childrenByParent.set(category.parentId, siblings)
  }

  const result = new Set<string>()
  const stack = [categoryId]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (result.has(current)) continue
    result.add(current)
    stack.push(...(childrenByParent.get(current) ?? []))
  }
  return result
}
