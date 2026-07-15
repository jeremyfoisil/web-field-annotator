// Configuration des couches raster (fonds de carte).
//
// Ortho IGN : Géoplateforme WMTS public (pas de clé nécessaire).
// Nimbo : REMPLACER l'URL par le vrai endpoint XYZ/WMTS Kermap, et penser à
//         ajouter l'hôte dans vite.config.ts (runtimeCaching) pour le cache offline.

export interface RasterLayerConfig {
  id: string
  label: string
  /** URL template XYZ. Placeholders {x} {y} {z}. */
  tiles: string[]
  tileSize: number
  minzoom: number
  maxzoom: number
  attribution: string
  /** Zoom max réellement téléchargeable pour l'offline (limite le volume). */
  offlineMaxZoom: number
  /** Affichée par défaut au démarrage. */
  visibleByDefault: boolean
}

export const RASTER_LAYERS: RasterLayerConfig[] = [
  {
    id: 'ortho-ign',
    label: 'Ortho IGN',
    tiles: [
      'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    ],
    tileSize: 256,
    minzoom: 0,
    maxzoom: 19,
    attribution: '© IGN — Géoplateforme',
    offlineMaxZoom: 19,
    visibleByDefault: true,
  },
  {
    // PLACEHOLDER — remplacer par le vrai flux Nimbo (Kermap).
    id: 'nimbo',
    label: 'Nimbo',
    tiles: ['https://example.nimbo.invalid/tiles/{z}/{x}/{y}.png'],
    tileSize: 256,
    minzoom: 0,
    maxzoom: 18,
    attribution: '© Kermap — Nimbo',
    offlineMaxZoom: 18,
    visibleByDefault: false,
  },
]

// Fond « plan » léger (repères) — IGN plan v2, utile quand ortho non téléchargée.
export const BASEMAP_PLAN: RasterLayerConfig = {
  id: 'plan-ign',
  label: 'Plan IGN',
  tiles: [
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
  ],
  tileSize: 256,
  minzoom: 0,
  maxzoom: 19,
  attribution: '© IGN — Géoplateforme',
  offlineMaxZoom: 18,
  visibleByDefault: false,
}

// Vue initiale (France métropolitaine — centrée sur la Bretagne par défaut).
export const INITIAL_VIEW = {
  center: [-1.68, 48.11] as [number, number],
  zoom: 12,
}
