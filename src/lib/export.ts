import type { Observation } from './db'
import type { Feature, FeatureCollection } from 'geojson'

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

export function exportGeoJSON(observations: Observation[]) {
  const features: Feature[] = observations.map((o) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: o.point },
    properties: {
      id: o.id,
      observateur: o.observateur,
      loggedAt: o.loggedAt,
      parcelleId: o.parcelleId,
      note: o.note,
      lng: o.point[0],
      lat: o.point[1],
    },
  }))
  const fc: FeatureCollection = { type: 'FeatureCollection', features }
  download(`observations-${stamp()}.geojson`, JSON.stringify(fc, null, 2), 'application/geo+json')
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportCSV(observations: Observation[]) {
  const headers = ['id', 'observateur', 'loggedAt', 'parcelleId', 'note', 'lng', 'lat']
  const rows = observations.map((o) =>
    [o.id, o.observateur, o.loggedAt, o.parcelleId, o.note, o.point[0], o.point[1]]
      .map(csvCell)
      .join(';'),
  )
  const csv = [headers.join(';'), ...rows].join('\r\n')
  download(`observations-${stamp()}.csv`, csv, 'text/csv;charset=utf-8')
}
