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
      try {
        // Le service worker (CacheFirst) intercepte et met en cache la réponse.
        await fetch(url, { signal, mode: 'cors' })
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e
        // tuile hors couverture / erreur réseau ponctuelle → on continue
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
