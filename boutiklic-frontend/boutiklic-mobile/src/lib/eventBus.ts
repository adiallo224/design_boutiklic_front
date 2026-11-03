import mitt from 'mitt'

/** Remplace les CustomEvent sur `window` (inexistant en RN) — mêmes noms d'événements que le web. */
export const emitter = mitt<Record<string, undefined>>()
