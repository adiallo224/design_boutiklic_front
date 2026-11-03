import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'

/**
 * Utilitaires de test de fumée des écrans React Native (react-test-renderer) : lire le texte affiché, trouver un
 * bouton par son libellé, saisir dans un champ. Les `jest.mock` (React, runtime NativeWind, i18n, icônes…) doivent
 * rester en tête de CHAQUE fichier de test — jest ne les hisse que là — cf. Labels.test.tsx.
 */

const texts = (node: ReactTestInstance | string): string[] =>
  typeof node === 'string' ? [node] : node.children.flatMap((child) => texts(child as ReactTestInstance | string))

export const textOf = (node: ReactTestInstance): string => texts(node).join('')
export const allText = (renderer: ReactTestRenderer): string => textOf(renderer.root)

/** Bouton (élément avec `onPress`) dont le texte contient `label` — le plus imbriqué. Lève avec le texte affiché si absent. */
export function pressable(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const found = renderer.root.findAll((n) => typeof n.props.onPress === 'function' && textOf(n).includes(label))
  if (found.length === 0) throw new Error(`Aucun bouton « ${label} » — texte affiché : ${allText(renderer).slice(0, 500)}`)
  return found[found.length - 1]
}

export const flush = () =>
  act(async () => {
    await new Promise((resolve) => setImmediate(resolve))
  })

export async function press(renderer: ReactTestRenderer, label: string): Promise<void> {
  await act(async () => {
    pressable(renderer, label).props.onPress()
  })
}

/** Saisit `text` dans le n-ième champ de saisie (`TextInput`) de l'écran. */
export async function typeInto(renderer: ReactTestRenderer, inputs: ReactTestInstance[], index: number, text: string): Promise<void> {
  await act(async () => {
    inputs[index].props.onChangeText(text)
  })
  void renderer
}
