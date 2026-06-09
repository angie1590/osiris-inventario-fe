import type { Category } from '@/types/api'

/**
 * Build the full hierarchical path for a category, e.g.
 * "Tecnología / Computadoras / Laptops". Returns "—" if not found.
 */
export function buildCategoryPath(
  categories: Category[],
  id: number | null | undefined,
  sep = ' / ',
): string {
  if (id == null) return '—'
  let current = categories.find((c) => c.id === id)
  if (!current) return '—'
  const parts: string[] = []
  const seen = new Set<number>()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    parts.unshift(current.name)
    const parentId: number | null = current.parent_id
    current = parentId ? categories.find((c) => c.id === parentId) : undefined
  }
  return parts.join(sep)
}

/** Return a category plus all its descendants (for scoping a selector to one
 * branch). The root is re-parented to null so a TreeSelector — which only renders
 * from roots — shows the whole subtree. */
export function subtreeOf(categories: Category[], rootId: number): Category[] {
  const out: Category[] = []
  const root = categories.find((c) => c.id === rootId)
  if (!root) return out
  const collect = (id: number, isRoot: boolean) => {
    const node = categories.find((c) => c.id === id)
    if (node) out.push(isRoot ? { ...node, parent_id: null } : node)
    for (const child of categories.filter((c) => c.parent_id === id)) collect(child.id, false)
  }
  collect(rootId, true)
  return out
}
