// Maths de tuiles (schéma XYZ / Web Mercator "PM"/EPSG:3857).

export interface TileCoord {
  z: number
  x: number
  y: number
}

export function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z)
}

export function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z,
  )
}

/** Énumère toutes les tuiles couvrant une bbox sur une plage de zoom. */
export function tilesInBbox(
  bbox: [number, number, number, number],
  minZoom: number,
  maxZoom: number,
): TileCoord[] {
  const [minLng, minLat, maxLng, maxLat] = bbox
  const tiles: TileCoord[] = []
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lngToTileX(minLng, z)
    const xMax = lngToTileX(maxLng, z)
    // latitude : y augmente vers le sud → maxLat donne le y min
    const yMin = latToTileY(maxLat, z)
    const yMax = latToTileY(minLat, z)
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ z, x, y })
      }
    }
  }
  return tiles
}

/** Remplace les placeholders {z}/{x}/{y} d'un template XYZ. */
export function fillTemplate(template: string, t: TileCoord): string {
  return template
    .replace('{z}', String(t.z))
    .replace('{x}', String(t.x))
    .replace('{y}', String(t.y))
}

/** Estimation grossière du poids (Mo) pour une plage de zoom donnée. */
export function estimateSizeMB(tileCount: number, avgKB = 25): number {
  return (tileCount * avgKB) / 1024
}
