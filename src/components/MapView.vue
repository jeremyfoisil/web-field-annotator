<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildStyle } from '../lib/mapStyle'
import { RASTER_LAYERS, BASEMAP_PLAN, INITIAL_VIEW } from '../config/layers'
import { useSettings } from '../stores/settings'
import { useObservations } from '../stores/observations'
import type { FeatureCollection } from 'geojson'

const emit = defineEmits<{ pick: [lngLat: [number, number]] }>()

const settings = useSettings()
const observations = useObservations()

const container = ref<HTMLDivElement | null>(null)
const geoError = ref<string | null>(null)
let map: maplibregl.Map | null = null
let pendingMarker: maplibregl.Marker | null = null

const ALL_IDS = [BASEMAP_PLAN.id, ...RASTER_LAYERS.map((l) => l.id)]

// --- Orientation utilisateur (boussole du téléphone) -----------------------
let headingMarker: maplibregl.Marker | null = null
let orientationBound = false
let hasHeading = false

/** Élément SVG « faisceau » indiquant la direction regardée (pointe vers le nord à 0°). */
function makeHeadingElement(): HTMLElement {
  const el = document.createElement('div')
  el.style.width = '72px'
  el.style.height = '72px'
  el.style.opacity = '0' // masqué tant qu'on n'a pas de cap
  el.style.transition = 'opacity 0.2s'
  el.innerHTML = `
    <svg width="72" height="72" viewBox="0 0 72 72" style="display:block">
      <defs>
        <radialGradient id="fa-beam" cx="50%" cy="100%" r="75%">
          <stop offset="0%" stop-color="#1d9bf0" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#1d9bf0" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <path d="M36 36 L12 6 A38 38 0 0 1 60 6 Z" fill="url(#fa-beam)"/>
    </svg>`
  return el
}

/** Convertit un évènement d'orientation en cap boussole (degrés, sens horaire depuis le nord). */
function headingFromEvent(e: DeviceOrientationEvent): number | null {
  const webkit = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading
  if (typeof webkit === 'number' && !Number.isNaN(webkit)) {
    return webkit // iOS : déjà un cap boussole
  }
  if (e.absolute && typeof e.alpha === 'number') {
    const screenAngle =
      (typeof screen !== 'undefined' && screen.orientation?.angle) || 0
    return (360 - e.alpha + screenAngle + 360) % 360
  }
  return null
}

function onDeviceOrientation(e: DeviceOrientationEvent) {
  const heading = headingFromEvent(e)
  if (heading == null || !headingMarker) return
  headingMarker.setRotation(heading)
  if (!hasHeading) {
    hasHeading = true
    ;(headingMarker.getElement() as HTMLElement).style.opacity = '1'
  }
}

/** Active l'écoute de l'orientation (avec demande de permission iOS 13+). */
async function enableOrientation() {
  if (orientationBound) return
  const DOE = window.DeviceOrientationEvent as
    | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> })
    | undefined
  if (!DOE) return
  if (typeof DOE.requestPermission === 'function') {
    try {
      if ((await DOE.requestPermission()) !== 'granted') return
    } catch {
      return
    }
  }
  window.addEventListener('deviceorientationabsolute', onDeviceOrientation as EventListener, true)
  window.addEventListener('deviceorientation', onDeviceOrientation as EventListener, true)
  orientationBound = true
}

function setupHeading(geolocate: maplibregl.GeolocateControl) {
  // Le clic sur le bouton de géolocalisation est un geste utilisateur → on en
  // profite pour demander l'accès à la boussole (obligatoire sur iOS).
  const btn = map?.getContainer().querySelector('.maplibregl-ctrl-geolocate')
  btn?.addEventListener('click', () => void enableOrientation())

  geolocate.on('geolocate', (pos: GeolocationPosition) => {
    if (!map) return
    const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude]
    if (!headingMarker) {
      headingMarker = new maplibregl.Marker({
        element: makeHeadingElement(),
        rotationAlignment: 'map',
        pitchAlignment: 'map',
      })
    }
    headingMarker.setLngLat(lngLat).addTo(map)
    geoError.value = null
  })

  const hide = () => {
    headingMarker?.remove()
    hasHeading = false
  }
  geolocate.on('trackuserlocationend', hide)
  geolocate.on('error', (e: GeolocationPositionError) => {
    hide()
    if (e && e.code === 1) {
      geoError.value =
        "Localisation refusée. Autorise l'accès à la position pour ce site dans les réglages du navigateur."
    } else if (e && e.code === 3) {
      geoError.value = 'Localisation : délai dépassé. Réessaie à l\'extérieur / avec le GPS activé.'
    } else {
      geoError.value = 'Localisation indisponible sur cet appareil.'
    }
  })
}

function obsCollection(): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: observations.items.map((o) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: o.point },
      properties: { id: o.id, selected: o.id === observations.selectedId },
    })),
  }
}

function refreshObservations() {
  const src = map?.getSource('observations') as maplibregl.GeoJSONSource | undefined
  src?.setData(obsCollection())
}

function applyLayerVisibility() {
  if (!map) return
  for (const id of ALL_IDS) {
    const vis = settings.activeLayerIds.includes(id) ? 'visible' : 'none'
    if (map.getLayer(`layer-${id}`)) {
      map.setLayoutProperty(`layer-${id}`, 'visibility', vis)
    }
  }
}

onMounted(() => {
  if (!container.value) return
  map = new maplibregl.Map({
    container: container.value,
    style: buildStyle(settings.activeLayerIds),
    center: INITIAL_VIEW.center,
    zoom: INITIAL_VIEW.zoom,
    attributionControl: { compact: true },
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left')
  const geolocate = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
  })
  map.addControl(geolocate, 'top-left')
  setupHeading(geolocate)
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

  map.on('load', () => {
    refreshObservations()
    // Localisation automatique au démarrage (le bouton « cible » reste dispo).
    try {
      geolocate.trigger()
    } catch {
      /* certains navigateurs exigent une interaction : le bouton prend le relais */
    }
  })

  map.on('click', (e) => {
    const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat]
    setPending(lngLat)
    emit('pick', lngLat)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('deviceorientationabsolute', onDeviceOrientation as EventListener, true)
  window.removeEventListener('deviceorientation', onDeviceOrientation as EventListener, true)
  headingMarker?.remove()
  headingMarker = null
  map?.remove()
  map = null
})

function setPending(lngLat: [number, number] | null) {
  pendingMarker?.remove()
  pendingMarker = null
  if (lngLat && map) {
    pendingMarker = new maplibregl.Marker({ color: '#f59e0b' })
      .setLngLat(lngLat)
      .addTo(map)
  }
}

watch(() => settings.activeLayerIds, applyLayerVisibility, { deep: true })
watch(() => observations.items.slice(), refreshObservations, { deep: true })
watch(() => observations.selectedId, () => {
  refreshObservations()
  const sel = observations.items.find((o) => o.id === observations.selectedId)
  if (sel && map) {
    map.flyTo({ center: sel.point, zoom: Math.max(map.getZoom(), 16) })
  }
})

defineExpose({
  clearPending: () => setPending(null),
  getBounds: (): [number, number, number, number] | null => {
    if (!map) return null
    const b = map.getBounds()
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
  },
  getZoom: () => (map ? Math.round(map.getZoom()) : 12),
})
</script>

<template>
  <div ref="container" class="map-root"></div>
  <div v-if="geoError" class="geo-error" @click="geoError = null">
    {{ geoError }}
  </div>
</template>

<style scoped>
.map-root {
  position: absolute;
  inset: 0;
}
.geo-error {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  max-width: min(90%, 420px);
  background: rgba(180, 83, 9, 0.95);
  color: #fff;
  font-size: 0.82rem;
  padding: 10px 14px;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  z-index: 10;
  cursor: pointer;
}
</style>
