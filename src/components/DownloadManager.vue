<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RASTER_LAYERS } from '../config/layers'
import { useSettings } from '../stores/settings'
import { useOffline } from '../stores/offline'
import { tilesInBbox, estimateSizeMB } from '../lib/tiles'
import {
  getStorageEstimate,
  requestPersistentStorage,
  formatBytes,
  type StorageStatus,
} from '../lib/storage'

const props = defineProps<{
  bbox: [number, number, number, number] | null
}>()
const emit = defineEmits<{
  close: []
  'show-area': [bbox: [number, number, number, number] | null]
}>()

const settings = useSettings()
const offline = useOffline()

// Volet rétractable (mobile) : clic sur le titre pour replier vers le bas.
const collapsed = ref(false)

// Zone enregistrée dont on affiche le contour sur la carte (clic sur sa ligne).
const shownAreaId = ref<string | null>(null)

function toggleArea(area: { id: string; bbox: [number, number, number, number] }) {
  if (shownAreaId.value === area.id) {
    shownAreaId.value = null
    emit('show-area', null)
  } else {
    shownAreaId.value = area.id
    emit('show-area', area.bbox)
  }
}

function deleteArea(id: string) {
  if (shownAreaId.value === id) {
    shownAreaId.value = null
    emit('show-area', null)
  }
  offline.removeArea(id)
}

const label = ref('')
const minZoom = 10
const maxZoom = 15
const selectedLayers = ref<string[]>([...settings.activeLayerIds])

const estimate = computed(() => {
  if (!props.bbox) return { tiles: 0, mb: 0 }
  let tiles = 0
  for (const l of RASTER_LAYERS.filter((x) => selectedLayers.value.includes(x.id))) {
    tiles += tilesInBbox(
      props.bbox,
      minZoom,
      Math.min(maxZoom, l.offlineMaxZoom),
    ).length
  }
  return { tiles, mb: estimateSizeMB(tiles) }
})

// Dimensions réelles de l'emprise (rectangle capturé à l'ouverture).
const emprise = computed(() => {
  if (!props.bbox) return null
  const [w, s, e, n] = props.bbox
  const midLat = (s + n) / 2
  const kmPerDegLat = 111.32
  const kmPerDegLng = 111.32 * Math.cos((midLat * Math.PI) / 180)
  const width = (e - w) * kmPerDegLng
  const height = (n - s) * kmPerDegLat
  return {
    width,
    height,
    area: width * height,
    centerLat: midLat,
    centerLng: (w + e) / 2,
  }
})

const pct = computed(() => {
  const p = offline.progress
  if (!p || !p.tilesTotal) return 0
  return Math.round((p.tilesDone / p.tilesTotal) * 100)
})

function toggle(id: string) {
  const i = selectedLayers.value.indexOf(id)
  if (i === -1) selectedLayers.value.push(id)
  else selectedLayers.value.splice(i, 1)
}

const storage = ref<StorageStatus | null>(null)
const persistMsg = ref<string | null>(null)
onMounted(async () => {
  storage.value = await getStorageEstimate()
})
async function enablePersist() {
  storage.value = await requestPersistentStorage()
  // Le navigateur peut refuser (persistance accordée selon l'usage du site).
  persistMsg.value = storage.value.persisted
    ? 'Stockage persistant activé.'
    : "Le navigateur a refusé la persistance pour l'instant (elle sera accordée automatiquement avec l'usage du site)."
}

async function start() {
  if (!props.bbox || !selectedLayers.value.length) return
  await offline.download({
    label: label.value.trim() || `Zone ${new Date().toLocaleDateString('fr-FR')}`,
    bbox: props.bbox,
    minZoom,
    maxZoom,
    layerIds: [...selectedLayers.value],
  })
}
</script>

<template>
  <aside class="dl-panel" :class="{ collapsed }">
    <div class="dl-head">
      <button class="back" @click="emit('close')" aria-label="Retour">←</button>
      <button
        class="title-toggle"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        <h2>Zone hors ligne</h2>
        <span class="chevron" aria-hidden="true">{{ collapsed ? '▲' : '▼' }}</span>
      </button>
    </div>

    <div class="dl-body">
      <div v-if="storage" class="storage" :class="{ warn: !storage.persisted }">
        <div class="storage-row">
          <div class="storage-info">
            <span class="dot" :class="storage.persisted ? 'ok' : 'ko'"></span>
            <span v-if="storage.persisted">Stockage persistant</span>
            <span v-else-if="storage.supported">Stockage non persistant</span>
            <span v-else>Persistance non supportée</span>
          </div>
          <button
            v-if="storage.supported && !storage.persisted"
            class="btn small"
            @click="enablePersist"
          >Activer</button>
        </div>
        <div class="usage">
          {{ formatBytes(storage.usageBytes) }} / {{ formatBytes(storage.quotaBytes) }}
        </div>
        <p v-if="persistMsg" class="persist-msg">{{ persistMsg }}</p>
      </div>

      <p class="lead">
        L'emprise suit le cadrage de la carte&nbsp;: zoomez ou déplacez-la pour
        l'ajuster, tout se recalcule en direct.
      </p>

      <div v-if="emprise" class="emprise-card">
        <span class="badge">Emprise à télécharger</span>
        <div class="emprise-dims">
          ≈ {{ emprise.width.toFixed(1) }} × {{ emprise.height.toFixed(1) }} km
          <span class="area">({{ emprise.area.toFixed(1) }} km²)</span>
        </div>
        <div class="emprise-center">
          centre {{ emprise.centerLat.toFixed(4) }}, {{ emprise.centerLng.toFixed(4) }}
        </div>
      </div>

      <label class="field">
        <span>Nom de la zone</span>
        <input v-model="label" type="text" placeholder="ex. Site Rennes Nord" />
      </label>

      <div class="layers">
        <span class="lbl">Couches :</span>
        <label v-for="l in RASTER_LAYERS" :key="l.id" class="chk">
          <input
            type="checkbox"
            :checked="selectedLayers.includes(l.id)"
            @change="toggle(l.id)"
          />
          {{ l.label }}
        </label>
      </div>

      <p class="zoom-note">Niveaux de zoom téléchargés : 10 → 15</p>

      <div class="estimate">
        ≈ {{ estimate.tiles.toLocaleString('fr-FR') }} tuiles ·
        ~{{ estimate.mb.toFixed(0) }} Mo
        <span v-if="estimate.tiles > 30000" class="warn">
          — volume élevé, resserrez le cadrage.
        </span>
      </div>

      <div v-if="offline.progress" class="progress">
        <div class="bar"><div class="fill" :style="{ width: pct + '%' }"></div></div>
        <div class="progress-txt">
          <span>{{ offline.progress.message }}</span>
          <span v-if="offline.progress.phase === 'tiles'">
            {{ offline.progress.tilesDone }}/{{ offline.progress.tilesTotal }}
          </span>
        </div>
      </div>

      <div class="actions">
        <button
          v-if="offline.running"
          class="btn ghost"
          @click="offline.cancel()"
        >Annuler</button>
        <button
          v-else
          class="btn primary"
          :disabled="!bbox || !selectedLayers.length"
          @click="start"
        >Télécharger</button>
      </div>

      <section v-if="offline.areas.length" class="areas">
        <h3>Zones enregistrées</h3>
        <ul>
          <li
            v-for="a in offline.areas"
            :key="a.id"
            :class="{ active: a.id === shownAreaId }"
            @click="toggleArea(a)"
          >
            <div>
              <div class="a-title">{{ a.label }}</div>
              <div class="a-meta">
                {{ a.tileCount.toLocaleString('fr-FR') }} tuiles ·
                z{{ a.minZoom }}–{{ a.maxZoom }}
              </div>
            </div>
            <button class="del" title="Supprimer" @click.stop="deleteArea(a.id)">×</button>
          </li>
        </ul>
        <p class="note">
          Touchez une zone pour afficher son contour sur la carte. Supprimer une
          zone efface ses métadonnées ; le cache de tuiles se purge automatiquement
          quand l'espace est nécessaire.
        </p>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.dl-panel {
  display: flex; flex-direction: column; height: 100%;
  background: var(--panel);
  border-left: 1px solid var(--border);
  min-height: 0;
}
.dl-head {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 14px 10px; border-bottom: 1px solid var(--border);
}
.back {
  background: none; border: none; color: var(--text);
  font-size: 1.3rem; line-height: 1; cursor: pointer; padding: 0 4px;
}
.title-toggle {
  flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  background: none; border: none; color: var(--text); cursor: pointer;
  padding: 0; text-align: left;
}
.title-toggle h2 { margin: 0; font-size: 1rem; }
/* Chevron : indicateur de repli, utile uniquement en bottom-sheet mobile. */
.chevron { font-size: 0.7rem; color: var(--muted); display: none; }
.dl-body { flex: 1; min-height: 0; overflow-y: auto; padding: 14px; }
.zoom-note { font-size: 0.78rem; color: var(--muted); margin: 0 0 10px; }
.emprise-card {
  background: var(--panel-2);
  border: 1px solid #b45309;
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 14px;
}
.emprise-card .badge {
  display: inline-block; font-size: 0.68rem; text-transform: uppercase;
  letter-spacing: 0.05em; color: #f59e0b;
}
.emprise-dims { font-size: 1rem; font-weight: 600; margin-top: 2px; }
.emprise-dims .area { color: var(--muted); font-weight: 400; font-size: 0.85rem; }
.emprise-center { font-family: ui-monospace, monospace; font-size: 0.8rem; color: var(--muted); margin-top: 3px; overflow-wrap: anywhere; }
.storage {
  margin: 0 0 12px; padding: 10px 12px;
  background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px;
}
.storage.warn { border-color: #b45309; }
.storage-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.storage-info { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot.ok { background: #34d399; }
.dot.ko { background: #fbbf24; }
.usage { color: var(--muted); font-size: 0.78rem; margin-top: 6px; }
.persist-msg { font-size: 0.76rem; color: var(--muted); margin: 8px 0 0; line-height: 1.35; }
.lead, .note { font-size: 0.82rem; color: var(--muted); }
.lead { margin-top: 0; }
.field { display: block; margin-bottom: 12px; }
.field > span { display: block; font-size: 0.82rem; color: var(--muted); margin-bottom: 5px; }
input[type='text'] {
  width: 100%; background: var(--panel-2); border: 1px solid var(--border);
  border-radius: 10px; padding: 11px 12px; color: var(--text); font: inherit;
}
.layers { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 6px 0 14px; }
.layers .lbl { font-size: 0.82rem; color: var(--muted); }
.chk { display: flex; align-items: center; gap: 6px; font-size: 0.88rem; }
.estimate { font-size: 0.85rem; margin-bottom: 14px; }
.estimate .warn { color: #f59e0b; }
.progress { margin-bottom: 14px; }
.bar { height: 8px; background: var(--panel-2); border-radius: 999px; overflow: hidden; }
.fill { height: 100%; background: var(--accent); transition: width 0.2s; }
.progress-txt { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--muted); margin-top: 5px; }
.actions .btn { width: 100%; }
.areas { border-top: 1px solid var(--border); margin-top: 6px; padding-top: 14px; }
.areas h3 { margin: 0 0 10px; font-size: 0.95rem; }
.areas ul { list-style: none; margin: 0; padding: 0; }
.areas li {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 8px; margin: 0 -8px; border-radius: 10px;
  border: 1px solid transparent; border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.areas li:hover { background: var(--panel-2); }
.areas li.active { background: var(--panel-2); border-color: var(--accent); }
.a-title { font-weight: 600; font-size: 0.9rem; }
.a-meta { font-size: 0.78rem; color: var(--muted); margin-top: 2px; }
.del { background: none; border: none; color: var(--muted); font-size: 1.3rem; cursor: pointer; }
.del:hover { color: #f87171; }

/* Bottom-sheet mobile : le titre replie/déplie le volet vers le bas, laissant
   la carte visible pour ajuster le cadrage. */
@media (max-width: 860px) {
  .chevron { display: inline; }
  .dl-panel.collapsed .dl-body { display: none; }
  .dl-panel.collapsed .dl-head { border-bottom: none; }
}
</style>
