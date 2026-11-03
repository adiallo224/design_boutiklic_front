import { describe, expect, it } from 'vitest'
import type { CategoryResponse } from './categoriesApi'
import { buildCategoryTree } from './categoryTree'

const cat = (id: string, name: string, position: number, parentId: string | null = null): CategoryResponse => ({
  id,
  name,
  color: '#000000',
  icon: null,
  parentId,
  depth: parentId ? 2 : 1,
  position,
  taxCategoryId: null,
})

describe('buildCategoryTree', () => {
  it('ordonne les frères par position, puis par nom à position égale', () => {
    const tree = buildCategoryTree([
      cat('b', 'Boissons', 0),
      cat('a', 'Alimentation', 1),
      cat('c', 'Conserves', 1),
      cat('a2', 'Riz', 1, 'a'),
      cat('a1', 'Huiles', 0, 'a'),
    ])

    expect(tree.map((n) => n.category.id)).toEqual(['b', 'a', 'c'])
    expect(tree[1].children.map((n) => n.category.id)).toEqual(['a1', 'a2'])
  })
})
