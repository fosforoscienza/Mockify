import { useSyncExternalStore } from 'react'

/**
 * Quante grafiche sono caricate ma non ancora esportate. Serve all'avviso di
 * aggiornamento: ricaricare la pagina cancella il lavoro, quindi il messaggio
 * cambia tono quando c'è qualcosa da perdere.
 */
let count = 0
const listeners = new Set<() => void>()

export function setUnsavedCount(value: number) {
  if (value === count) return
  count = value
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useUnsavedCount() {
  return useSyncExternalStore(
    subscribe,
    () => count,
    () => 0,
  )
}
