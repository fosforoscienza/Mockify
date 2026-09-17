import { useEffect, useState } from 'react'

/**
 * Rilevamento di una nuova versione pubblicata.
 *
 * L'app è statica: una scheda lasciata aperta continua a usare il bundle con
 * cui è partita. Si confronta l'identificativo compilato nel bundle con quello
 * servito da /version.json, aggiornato a ogni deploy.
 */
const MANIFEST = '/version.json'
const INTERVAL = 5 * 60 * 1000
const MIN_GAP = 60 * 1000

let forced = false
const forcedListeners = new Set<() => void>()

/** Usato quando un chunk non si carica più: è il segno di un deploy nuovo. */
export function markUpdateAvailable() {
  forced = true
  forcedListeners.forEach((l) => l())
}

async function fetchBuildId(signal?: AbortSignal) {
  const res = await fetch(`${MANIFEST}?t=${Date.now()}`, { cache: 'no-store', signal })
  if (!res.ok) return null
  const data = (await res.json()) as { build?: string }
  return typeof data.build === 'string' ? data.build : null
}

export function useUpdateAvailable() {
  const [available, setAvailable] = useState(forced)

  useEffect(() => {
    const listener = () => setAvailable(true)
    forcedListeners.add(listener)
    return () => {
      forcedListeners.delete(listener)
    }
  }, [])

  useEffect(() => {
    let stop = false
    let last = 0
    const controller = new AbortController()

    const check = async () => {
      if (stop || document.visibilityState === 'hidden') return
      const now = Date.now()
      if (now - last < MIN_GAP) return
      last = now
      try {
        const build = await fetchBuildId(controller.signal)
        // in sviluppo il manifest non esiste: nessun confronto possibile
        if (!stop && build && build !== __BUILD_ID__) setAvailable(true)
      } catch {
        // rete assente o offline: si riproverà al prossimo giro
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }

    const timer = window.setInterval(() => void check(), INTERVAL)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.setTimeout(() => void check(), 4000)

    return () => {
      stop = true
      controller.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  return available
}

export const buildId = () => __BUILD_ID__
