import Dexie, { type Table } from 'dexie'

// Une observation loggée : un point sur la carte, horodaté et attribué.
export interface Observation {
  id: string
  /** Point tapé sur la carte [lng, lat]. */
  point: [number, number]
  /** Nom de l'ingénieur en charge. */
  observateur: string
  /** Horodatage ISO 8601 (date + heure). */
  loggedAt: string
  note: string
}

// Métadonnées d'une zone téléchargée pour l'offline.
export interface OfflineArea {
  id: string
  label: string
  bbox: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
  minZoom: number
  maxZoom: number
  layerIds: string[]
  tileCount: number
  createdAt: string
}

class FieldDB extends Dexie {
  observations!: Table<Observation, string>
  offlineAreas!: Table<OfflineArea, string>

  constructor() {
    super('field-annotator')
    // v1 : schéma initial (avec parcellaire cadastral).
    this.version(1).stores({
      observations: 'id, parcelleId, observateur, loggedAt',
      parcelles: 'id',
      offlineAreas: 'id, createdAt',
    })
    // v2 : suppression du parcellaire — observations = points seuls.
    this.version(2).stores({
      observations: 'id, observateur, loggedAt',
      parcelles: null,
      offlineAreas: 'id, createdAt',
    })
  }
}

export const db = new FieldDB()
