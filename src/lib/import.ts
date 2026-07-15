import type { Observation } from './db'
import { newId } from './uuid'
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'

export interface ImportResult {
  observations: Observation[]
  skipped: number // features illisibles / sans géométrie exploitable
}

/** Aplatit récursivement les positions d'une géométrie pour un point moyen de repli. */
function collectPositions(geom: Geometry, out: Position[]) {
  if (geom.type === 'GeometryCollection') {
    geom.geometries.forEach((g) => collectPositions(g, out))
    return
  }
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
      out.push(c as Position)
    } else if (Array.isArray(c)) {
      c.forEach(walk)
    }
  }
  walk((geom as { coordinates: unknown }).coordinates)
}

/** Point représentatif [lng, lat] d'une feature (centroïde simple pour les surfaces). */
function representativePoint(f: Feature): [number, number] | null {
  const props = (f.properties ?? {}) as Record<string, unknown>
  if (typeof props.lng === 'number' && typeof props.lat === 'number') {
    return [props.lng, props.lat]
  }
  if (!f.geometry) return null
  if (f.geometry.type === 'Point') {
    const c = f.geometry.coordinates
    return [c[0], c[1]]
  }
  const positions: Position[] = []
  collectPositions(f.geometry, positions)
  if (!positions.length) return null
  const sum = positions.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
  return [sum[0] / positions.length, sum[1] / positions.length]
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length ? v : null
}

/**
 * Convertit un texte GeoJSON en observations (points). Reconnaît les propriétés
 * produites par l'export de l'app ; les champs manquants sont complétés par les
 * valeurs par défaut fournies. Toute géométrie est ramenée à un point représentatif.
 */
export function parseObservationsFromGeoJSON(
  text: string,
  defaults: { observateur: string; loggedAt: string },
): ImportResult {
  const data = JSON.parse(text) as FeatureCollection | Feature
  const features: Feature[] =
    data.type === 'FeatureCollection'
      ? data.features
      : data.type === 'Feature'
        ? [data]
        : []

  const observations: Observation[] = []
  let skipped = 0

  for (const f of features) {
    const point = representativePoint(f)
    if (!point) {
      skipped++
      continue
    }
    const p = (f.properties ?? {}) as Record<string, unknown>
    observations.push({
      id: str(p.id) ?? newId(),
      point,
      observateur: str(p.observateur) ?? defaults.observateur,
      loggedAt: str(p.loggedAt) ?? defaults.loggedAt,
      note: str(p.note) ?? '',
    })
  }

  return { observations, skipped }
}
