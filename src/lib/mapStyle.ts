import type { StyleSpecification } from 'maplibre-gl'
import { RASTER_LAYERS, BASEMAP_PLAN } from '../config/layers'

const ALL_LAYERS = [BASEMAP_PLAN, ...RASTER_LAYERS]

/**
 * Style de base : un fond gris, toutes les couches raster (masquées par défaut),
 * puis les points d'observation au-dessus.
 */
export function buildStyle(visibleIds: string[]): StyleSpecification {
  const sources: StyleSpecification['sources'] = {
    observations: {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    },
  }

  for (const l of ALL_LAYERS) {
    sources[l.id] = {
      type: 'raster',
      tiles: l.tiles,
      tileSize: l.tileSize,
      minzoom: l.minzoom,
      maxzoom: l.maxzoom,
      attribution: l.attribution,
    }
  }

  const rasterLayers = ALL_LAYERS.map((l) => ({
    id: `layer-${l.id}`,
    type: 'raster' as const,
    source: l.id,
    layout: {
      visibility: (visibleIds.includes(l.id) ? 'visible' : 'none') as
        | 'visible'
        | 'none',
    },
  }))

  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources,
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#1e293b' } },
      ...rasterLayers,
      // Points d'observation loggés
      {
        id: 'obs-point',
        type: 'circle',
        source: 'observations',
        paint: {
          'circle-radius': 7,
          'circle-color': '#14b8a6',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      },
      // Halo sur l'observation sélectionnée
      {
        id: 'obs-point-selected',
        type: 'circle',
        source: 'observations',
        filter: ['==', ['get', 'selected'], true],
        paint: {
          'circle-radius': 11,
          'circle-color': 'rgba(245, 158, 11, 0)',
          'circle-stroke-color': '#f59e0b',
          'circle-stroke-width': 3,
        },
      },
    ],
  }
}
