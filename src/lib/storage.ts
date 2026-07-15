// Stockage persistant : demande au navigateur de ne PAS évincer automatiquement
// les données du site sous pression d'espace. Essentiel pour un usage terrain où
// les observations et les tuiles offline ne doivent pas disparaître.

export interface StorageStatus {
  persisted: boolean
  supported: boolean
  usageBytes: number | null
  quotaBytes: number | null
}

/** Demande le stockage persistant (idempotent). Renvoie l'état résultant. */
export async function requestPersistentStorage(): Promise<StorageStatus> {
  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.storage &&
    typeof navigator.storage.persist === 'function'

  if (!supported) {
    return { persisted: false, supported: false, usageBytes: null, quotaBytes: null }
  }

  let persisted = await navigator.storage.persisted()
  if (!persisted) {
    persisted = await navigator.storage.persist()
  }
  return { ...(await getStorageEstimate()), persisted, supported: true }
}

export async function getStorageEstimate(): Promise<StorageStatus> {
  const supported =
    typeof navigator !== 'undefined' && !!navigator.storage
  let persisted = false
  let usageBytes: number | null = null
  let quotaBytes: number | null = null

  if (supported) {
    if (typeof navigator.storage.persisted === 'function') {
      persisted = await navigator.storage.persisted()
    }
    if (typeof navigator.storage.estimate === 'function') {
      const est = await navigator.storage.estimate()
      usageBytes = est.usage ?? null
      quotaBytes = est.quota ?? null
    }
  }
  return { persisted, supported, usageBytes, quotaBytes }
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} o`
  const units = ['Ko', 'Mo', 'Go']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}
