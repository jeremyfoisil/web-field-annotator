import { RASTER_LAYERS, type RasterLayerConfig } from '../config/layers'
import { db, type OfflineArea } from './db'
import { tilesInBbox, fillTemplate, type TileCoord } from './tiles'
import { newId } from './uuid'

export interface DownloadProgress {
  phase: 'tiles' | 'done' | 'error'
  tilesDone: number
  tilesTotal: number
  message: string
}

/** Délai maximal par tuile : au-delà, on abandonne la requête et on passe. */
const TILE_TIMEOUT_MS = 15000

/**
 * fetch d'une tuile borné dans le temps. Sur réseau mobile/cellulaire, une
 * connexion peut « pendre » indéfiniment (ni résolue, ni rejetée) : sans timeout,
 * le worker resterait bloqué sur `await` et tout le téléchargement se figerait
 * avant la fin. On abandonne donc chaque requête après TILE_TIMEOUT_MS, tout en
 * respectant l'annulation globale (bouton « Annuler »).
 */
async function fetchTile(url: string, signal: AbortSignal): Promise<void> {
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  if (signal.aborted) ctrl.abort()
  else signal.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => ctrl.abort(), TILE_TIMEOUT_MS)
  try {
    // Le service worker (CacheFirst) intercepte et met en cache la réponse.
    await fetch(url, { signal: ctrl.signal, mode: 'cors' })
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  }
}

/** Télécharge (dans le cache SW) toutes les tuiles d'une couche pour une bbox. */
async function downloadLayerTiles(
  layer: RasterLayerConfig,
  tiles: TileCoord[],
  onTile: () => void,
  signal: AbortSignal,
  concurrency = 6,
): Promise<void> {
  let index = 0
  async function worker() {
    while (index < tiles.length) {
      if (signal.aborted) throw new DOMException('aborted', 'AbortError')
      const t = tiles[index++]
      const url = fillTemplate(layer.tiles[0], t)
      // Timeout / erreur réseau ponctuelle → une nouvelle tentative, puis on passe
      // à la tuile suivante (mieux vaut un trou qu'un téléchargement figé).
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await fetchTile(url, signal)
          break
        } catch {
          // Annulation utilisateur (signal global) → on remonte pour stopper.
          if (signal.aborted) throw new DOMException('aborted', 'AbortError')
          // sinon (timeout / hors couverture) → retente puis continue
        }
      }
      onTile()
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
}

export interface DownloadOptions {
  label: string
  bbox: [number, number, number, number]
  minZoom: number
  maxZoom: number
  layerIds: string[]
}

/** Orchestration complète du téléchargement des tuiles d'une zone offline. */
export async function downloadArea(
  opts: DownloadOptions,
  onProgress: (p: DownloadProgress) => void,
  signal: AbortSignal,
): Promise<OfflineArea> {
  const layers = RASTER_LAYERS.filter((l) => opts.layerIds.includes(l.id))

  // Construire la liste de tuiles (bornée par offlineMaxZoom de chaque couche)
  const perLayer = layers.map((l) => ({
    layer: l,
    tiles: tilesInBbox(
      opts.bbox,
      opts.minZoom,
      Math.min(opts.maxZoom, l.offlineMaxZoom),
    ),
  }))
  const tilesTotal = perLayer.reduce((s, p) => s + p.tiles.length, 0)

  let tilesDone = 0
  const emit = (extra: Partial<DownloadProgress>) =>
    onProgress({ phase: 'tiles', tilesDone, tilesTotal, message: '', ...extra })
  emit({ message: 'Téléchargement des tuiles…' })

  for (const { layer, tiles } of perLayer) {
    await downloadLayerTiles(
      layer,
      tiles,
      () => {
        tilesDone++
        if (tilesDone % 20 === 0 || tilesDone === tilesTotal) {
          emit({ message: `Tuiles ${layer.label}…` })
        }
      },
      signal,
    )
  }

  const area: OfflineArea = {
    id: newId(),
    label: opts.label,
    // Copies « plates » : bbox/layerIds proviennent de refs Vue (Proxy) →
    // IndexedDB ne peut pas cloner un Proxy.
    bbox: [opts.bbox[0], opts.bbox[1], opts.bbox[2], opts.bbox[3]],
    minZoom: opts.minZoom,
    maxZoom: opts.maxZoom,
    layerIds: [...opts.layerIds],
    tileCount: tilesTotal,
    createdAt: new Date().toISOString(),
  }
  await db.offlineAreas.put(area)

  onProgress({
    phase: 'done',
    tilesDone,
    tilesTotal,
    message: `Zone « ${opts.label} » disponible hors ligne.`,
  })
  return area
}
