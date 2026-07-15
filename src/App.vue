<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import MapView from './components/MapView.vue'
import Sidebar from './components/Sidebar.vue'
import LogForm from './components/LogForm.vue'
import DownloadManager from './components/DownloadManager.vue'
import { RASTER_LAYERS } from './config/layers'
import { useSettings } from './stores/settings'
import { useObservations } from './stores/observations'
import { useOffline } from './stores/offline'
import { requestPersistentStorage } from './lib/storage'

const settings = useSettings()
const observations = useObservations()
const offline = useOffline()

// Respecte le chemin de base (GitHub Pages projet).
const logoUrl = import.meta.env.BASE_URL + 'kermap-logo-white.svg'

const mapRef = ref<InstanceType<typeof MapView> | null>(null)
const pendingPoint = ref<[number, number] | null>(null)
const showDownload = ref(false)
const showSidebar = ref(false)
const online = ref(navigator.onLine)

const dlBbox = ref<[number, number, number, number] | null>(null)

function onOnline() { online.value = true }
function onOffline() { online.value = false }

onMounted(async () => {
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  // Demande un stockage persistant pour éviter l'éviction des données terrain.
  requestPersistentStorage().catch(() => {})
  await observations.loadAll()
  await offline.loadAreas()
})

onBeforeUnmount(() => {
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
})

function onPick(lngLat: [number, number]) {
  pendingPoint.value = lngLat
}

function closeLog() {
  pendingPoint.value = null
  mapRef.value?.clearPending()
}

function onSaved() {
  // On ne force pas l'ouverture du volet (gênant sur mobile) : on ferme juste
  // le formulaire et on laisse le volet dans l'état choisi par l'utilisateur.
  closeLog()
}

function closeDownload() {
  showDownload.value = false
  mapRef.value?.clearEmprise()
}

function openDownload() {
  dlBbox.value = mapRef.value?.getBounds() ?? null
  showDownload.value = true
}

// La zone active à télécharger = le cadrage courant (pas de détourage dédié) ;
// on met seulement à jour les bornes pour recalculer dimensions et poids.
function onBounds(bbox: [number, number, number, number]) {
  if (!showDownload.value) return
  dlBbox.value = bbox
}

// Affiche (ou masque) le contour d'une zone enregistrée et y cadre la carte.
function onShowArea(bbox: [number, number, number, number] | null) {
  if (bbox) {
    mapRef.value?.showEmprise(bbox)
    mapRef.value?.fitBbox(bbox)
  } else {
    mapRef.value?.clearEmprise()
  }
}

function toggleSidebar() {
  if (showDownload.value) {
    // On quitte le mode téléchargement pour revenir à la liste d'observations.
    closeDownload()
    showSidebar.value = true
    return
  }
  showSidebar.value = !showSidebar.value
}
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <img class="logo" :src="logoUrl" alt="Kermap" />
        <span class="product">Field Annotator</span>
      </div>

      <div class="observer">
        <input
          v-model="settings.observateur"
          type="text"
          placeholder="Ingénieur en charge"
          aria-label="Ingénieur en charge"
        />
      </div>

      <div class="topbar-right">
        <div class="layer-toggles">
          <button
            v-for="l in RASTER_LAYERS"
            :key="l.id"
            class="chip"
            :class="{ on: settings.activeLayerIds.includes(l.id) }"
            @click="settings.toggleLayer(l.id)"
          >{{ l.label }}</button>
        </div>
        <span class="net" :class="online ? 'up' : 'down'">
          {{ online ? 'En ligne' : 'Hors ligne' }}
        </span>
        <button class="chip" @click="toggleSidebar">
          ☰ {{ observations.items.length }}
        </button>
      </div>
    </header>

    <main class="content">
      <div class="map-wrap">
        <MapView ref="mapRef" @pick="onPick" @boundschange="onBounds" />
      </div>
      <div class="sidebar-wrap" :class="{ open: showSidebar || showDownload, download: showDownload }">
        <DownloadManager
          v-if="showDownload"
          :bbox="dlBbox"
          @close="closeDownload"
          @show-area="onShowArea"
        />
        <Sidebar v-else @open-download="openDownload" />
      </div>
    </main>

    <LogForm
      v-if="pendingPoint"
      :point="pendingPoint"
      @close="closeLog"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100dvh; }
.topbar {
  display: flex; align-items: center; gap: 14px;
  padding: 8px 14px calc(8px);
  padding-top: calc(8px + env(safe-area-inset-top));
  background: var(--panel); border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.brand { display: flex; align-items: center; gap: 12px; }
.logo { height: 22px; width: auto; display: block; }
.product {
  font-weight: 600; font-size: 0.9rem; color: var(--text);
  padding-left: 12px; border-left: 1px solid var(--border); line-height: 1.1;
}
.observer { flex: 1; min-width: 140px; }
.observer input {
  width: 100%; max-width: 260px;
  background: var(--panel-2); border: 1px solid var(--border);
  border-radius: 999px; padding: 8px 14px; color: var(--text); font: inherit; font-size: 0.85rem;
}
.topbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.layer-toggles { display: flex; gap: 6px; }
.chip {
  background: var(--panel-2); border: 1px solid var(--border); color: var(--text);
  border-radius: 999px; padding: 6px 12px; font-size: 0.8rem; cursor: pointer;
}
.chip.on { background: var(--accent); border-color: var(--accent); color: #04211d; font-weight: 600; }
.net { font-size: 0.75rem; padding: 4px 10px; border-radius: 999px; }
.net.up { color: #34d399; background: rgba(16, 185, 129, 0.12); }
.net.down { color: #fbbf24; background: rgba(245, 158, 11, 0.12); }

.content { position: relative; flex: 1; display: flex; min-height: 0; }
.map-wrap { position: relative; flex: 1; min-width: 0; }

.sidebar-wrap { width: 340px; flex-shrink: 0; }
@media (max-width: 860px) {
  .sidebar-wrap {
    position: absolute; inset: 0 0 0 auto; width: min(85vw, 340px);
    transform: translateX(100%); transition: transform 0.25s ease; z-index: 20;
    box-shadow: -8px 0 30px rgba(0, 0, 0, 0.35);
  }
  .sidebar-wrap.open { transform: translateX(0); }
  /* En mode téléchargement : bottom-sheet, le haut de la carte reste visible
     et manipulable pour ajuster le cadrage (zoom/déplacement) en direct. */
  .sidebar-wrap.download {
    inset: auto 0 0 0; width: 100%; height: auto; max-height: 62vh;
    transform: translateY(100%);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.35);
  }
  .sidebar-wrap.download.open { transform: translateY(0); }
}
</style>
