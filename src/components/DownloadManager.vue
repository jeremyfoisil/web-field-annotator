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
  currentZoom: number
}>()
const emit = defineEmits<{ close: [] }>()

const settings = useSettings()
const offline = useOffline()

const label = ref('')
const minZoom = ref(Math.max(10, props.currentZoom - 2))
const maxZoom = ref(Math.min(18, props.currentZoom + 3))
const selectedLayers = ref<string[]>([...settings.activeLayerIds])

const estimate = computed(() => {
  if (!props.bbox) return { tiles: 0, mb: 0 }
  let tiles = 0
  for (const l of RASTER_LAYERS.filter((x) => selectedLayers.value.includes(x.id))) {
    tiles += tilesInBbox(
      props.bbox,
      minZoom.value,
      Math.min(maxZoom.value, l.offlineMaxZoom),
    ).length
  }
  return { tiles, mb: estimateSizeMB(tiles) }
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
onMounted(async () => {
  storage.value = await getStorageEstimate()
})
async function enablePersist() {
  storage.value = await requestPersistentStorage()
}

async function start() {
  if (!props.bbox || !selectedLayers.value.length) return
  await offline.download({
    label: label.value.trim() || `Zone ${new Date().toLocaleDateString('fr-FR')}`,
    bbox: props.bbox,
    minZoom: minZoom.value,
    maxZoom: maxZoom.value,
    layerIds: [...selectedLayers.value],
  })
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-head">
        <h2>Zones hors ligne</h2>
        <button class="icon-btn" @click="emit('close')">×</button>
      </div>

      <div v-if="storage" class="storage" :class="{ warn: !storage.persisted }">
        <div class="storage-info">
          <span class="dot" :class="storage.persisted ? 'ok' : 'ko'"></span>
          <span v-if="storage.persisted">Stockage persistant activé</span>
          <span v-else-if="storage.supported">Stockage non persistant</span>
          <span v-else>Persistance non supportée</span>
          <span class="usage">
            {{ formatBytes(storage.usageBytes) }} / {{ formatBytes(storage.quotaBytes) }}
          </span>
        </div>
        <button
          v-if="storage.supported && !storage.persisted"
          class="btn small"
          @click="enablePersist"
        >Activer</button>
      </div>

      <section class="new-area">
        <p class="lead">
          Cadrez la carte sur la zone à consulter sur le terrain, puis téléchargez
          les tuiles de l'emprise visible.
        </p>

        <label class="field">
          <span>Nom de la zone</span>
          <input v-model="label" type="text" placeholder="ex. Site Rennes Nord" />
        </label>

        <div class="zoom-row">
          <label class="field">
            <span>Zoom min ({{ minZoom }})</span>
            <input v-model.number="minZoom" type="range" min="8" max="18" />
          </label>
          <label class="field">
            <span>Zoom max ({{ maxZoom }})</span>
            <input v-model.number="maxZoom" type="range" min="8" max="19" />
          </label>
        </div>

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

        <div class="estimate">
          ≈ {{ estimate.tiles.toLocaleString('fr-FR') }} tuiles ·
          ~{{ estimate.mb.toFixed(0) }} Mo
          <span v-if="estimate.tiles > 30000" class="warn">
            — volume élevé, réduisez le zoom max ou l'emprise.
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
          >Annuler le téléchargement</button>
          <button
            v-else
            class="btn primary"
            :disabled="!bbox || !selectedLayers.length"
            @click="start"
          >Télécharger la zone</button>
        </div>
      </section>

      <section v-if="offline.areas.length" class="areas">
        <h3>Zones enregistrées</h3>
        <ul>
          <li v-for="a in offline.areas" :key="a.id">
            <div>
              <div class="a-title">{{ a.label }}</div>
              <div class="a-meta">
                {{ a.tileCount.toLocaleString('fr-FR') }} tuiles ·
                z{{ a.minZoom }}–{{ a.maxZoom }}
              </div>
            </div>
            <button class="del" @click="offline.removeArea(a.id)">×</button>
          </li>
        </ul>
        <p class="note">
          Supprimer une zone efface ses métadonnées. Le cache de tuiles se purge
          automatiquement quand l'espace est nécessaire.
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(2, 6, 23, 0.6);
  display: flex; align-items: center; justify-content: center;
  padding: 12px;
}
.modal {
  background: var(--panel);
  width: min(560px, 100%);
  max-height: 90vh; overflow-y: auto;
  border-radius: 16px;
  border: 1px solid var(--border);
}
.modal-head {
  position: sticky; top: 0; background: var(--panel);
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px; border-bottom: 1px solid var(--border);
}
h2 { margin: 0; font-size: 1.1rem; }
.icon-btn { background: none; border: none; color: var(--muted); font-size: 1.6rem; line-height: 1; cursor: pointer; }
section { padding: 16px 18px; }
.storage {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin: 14px 18px 0; padding: 10px 12px;
  background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px;
}
.storage.warn { border-color: #b45309; }
.storage-info { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 0.82rem; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot.ok { background: #34d399; }
.dot.ko { background: #fbbf24; }
.usage { color: var(--muted); }
.lead, .note { font-size: 0.82rem; color: var(--muted); }
.lead { margin-top: 0; }
.field { display: block; margin-bottom: 12px; }
.field > span { display: block; font-size: 0.82rem; color: var(--muted); margin-bottom: 5px; }
input[type='text'] {
  width: 100%; background: var(--panel-2); border: 1px solid var(--border);
  border-radius: 10px; padding: 11px 12px; color: var(--text); font: inherit;
}
input[type='range'] { width: 100%; }
.zoom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
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
.areas { border-top: 1px solid var(--border); }
.areas h3 { margin: 0 0 10px; font-size: 0.95rem; }
.areas ul { list-style: none; margin: 0; padding: 0; }
.areas li { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
.a-title { font-weight: 600; font-size: 0.9rem; }
.a-meta { font-size: 0.78rem; color: var(--muted); margin-top: 2px; }
.del { background: none; border: none; color: var(--muted); font-size: 1.3rem; cursor: pointer; }
.del:hover { color: #f87171; }
</style>
