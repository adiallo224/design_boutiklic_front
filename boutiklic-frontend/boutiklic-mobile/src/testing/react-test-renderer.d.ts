// Types minimaux de react-test-renderer (le package est là via jest-expo, mais pas @types/react-test-renderer — et on
// n'ajoute pas de dépendance pour des tests de fumée). Ne déclare que ce que src/testing/renderHelpers.ts utilise.
declare module 'react-test-renderer' {
  import type { ReactElement } from 'react'

  export interface ReactTestInstance {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props: Record<string, any>
    children: (ReactTestInstance | string)[]
    findAll(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[]
    findAllByType(type: unknown): ReactTestInstance[]
  }

  export interface ReactTestRenderer {
    root: ReactTestInstance
    unmount(): void
  }

  export function create(element: ReactElement): ReactTestRenderer
  export function act(callback: () => void | Promise<void>): Promise<void>
}
