export const DEFAULT_CODE_GENERATION_CONCURRENCY = 3

export interface GenerateInternalCodesOptions<T> {
  ids: readonly string[]
  /** Appel serveur d'attribution d'un code interne pour un article (idempotent, cf. AssignInternalBarcodeUseCase). */
  assign: (id: string) => Promise<T>
  /** Un code vient d'être attribué. */
  onAssigned?: (id: string, result: T) => void
  /** L'article n'est plus « en cours » : succès, échec, ou jamais traité à cause d'un arrêt anticipé. */
  onSettled?: (id: string) => void
  concurrency?: number
}

export interface GenerateInternalCodesResult {
  generated: number
  /** Première erreur rencontrée (le lot s'arrête alors), sinon null. */
  failure: unknown | null
}

/**
 * Attribue des codes internes à plusieurs articles, `concurrency` requêtes à la fois (défaut 3). S'arrête à
 * la première erreur : typiquement une coupure réseau — le numéro vient du compteur du serveur, il n'existe pas
 * de génération hors ligne — donc inutile d'insister sur les articles restants. Les requêtes déjà parties
 * terminent normalement ; les articles jamais démarrés sont libérés via `onSettled`. Ne lève jamais.
 */
export async function generateInternalCodes<T>({
  ids,
  assign,
  onAssigned,
  onSettled,
  concurrency = DEFAULT_CODE_GENERATION_CONCURRENCY,
}: GenerateInternalCodesOptions<T>): Promise<GenerateInternalCodesResult> {
  const queue = [...ids]
  let generated = 0
  let failure: unknown | null = null
  let failed = false

  const worker = async () => {
    while (!failed) {
      const id = queue.shift()
      if (id === undefined) return
      try {
        const result = await assign(id)
        generated++
        onAssigned?.(id, result)
      } catch (error) {
        if (!failed) {
          failed = true
          failure = error
        }
      } finally {
        onSettled?.(id)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, ids.length || 1)) }, worker))

  // Articles laissés dans la file par l'arrêt anticipé.
  for (const id of queue.splice(0)) onSettled?.(id)
  return { generated, failure }
}
