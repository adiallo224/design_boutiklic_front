import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Les tests couvrent la logique pure (panier, clé d'idempotence, proxy, client de l'API, traductions): environnement Node, sans navigateur.
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@boutiklic/shared': path.resolve(__dirname, '../packages/shared/src/index.ts') } },
})
