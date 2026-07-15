<script setup lang="ts">
import { ref } from 'vue'
import { useObservations } from '../stores/observations'
import { useSettings } from '../stores/settings'
import { exportGeoJSON, exportCSV } from '../lib/export'

const emit = defineEmits<{ 'open-download': [] }>()
const observations = useObservations()
const settings = useSettings()

const fileInput = ref<HTMLInputElement | null>(null)
const importMsg = ref<string | null>(null)

function pickFile() {
  importMsg.value = null
  fileInput.value?.click()
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // permet de réimporter le même fichier
  if (!file) return
  try {
    const text = await file.text()
    const r = await observations.importFromGeoJSON(text, settings.observateur.trim())
    const parts = [`${r.added} ajoutée(s)`]
    if (r.duplicates) parts.push(`${r.duplicates} doublon(s) ignoré(s)`)
    if (r.skipped) parts.push(`${r.skipped} sans géométrie`)
    importMsg.value = parts.join(' · ')
  } catch (err) {
    importMsg.value = `Import impossible : ${(err as Error).message}`
  }
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function title(o: { point: [number, number] }): string {
  return `${o.point[1].toFixed(5)}, ${o.point[0].toFixed(5)}`
}
</script>

<template>
  <aside class="sidebar">
    <div class="sb-head">
      <div>
        <h2>Observations loggées</h2>
        <span class="count">{{ observations.items.length }} observation(s)</span>
      </div>
    </div>

    <div class="tools">
      <button class="btn primary offline-btn" @click="emit('open-download')">
        ⭳ Télécharger la carto hors ligne
      </button>
      <div class="export-row">
        <button
          class="btn ghost small"
          :disabled="!observations.items.length"
          @click="exportGeoJSON(observations.items)"
        >Export GeoJSON</button>
        <button
          class="btn ghost small"
          :disabled="!observations.items.length"
          @click="exportCSV(observations.items)"
        >Export CSV</button>
        <button class="btn ghost small" @click="pickFile">Importer GeoJSON</button>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept=".geojson,.json,application/geo+json,application/json"
        hidden
        @change="onFile"
      />
      <p v-if="importMsg" class="import-msg">{{ importMsg }}</p>
    </div>

    <ul class="list">
      <li
        v-for="o in observations.sorted"
        :key="o.id"
        :class="{ active: o.id === observations.selectedId }"
        @click="observations.select(o.id)"
      >
        <div class="row-main">
          <span class="row-title">{{ title(o) }}</span>
          <button
            class="del"
            title="Supprimer"
            @click.stop="observations.remove(o.id)"
          >×</button>
        </div>
        <div class="row-meta">
          <span>{{ o.observateur }}</span>
          <span>{{ fmt(o.loggedAt) }}</span>
        </div>
        <div v-if="o.note" class="row-note">{{ o.note }}</div>
      </li>
      <li v-if="!observations.items.length" class="empty">
        Aucune observation. Touchez la carte pour en logguer une.
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel);
  border-left: 1px solid var(--border);
  min-height: 0;
}
.sb-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--border);
}
h2 { margin: 0; font-size: 1rem; }
.count { font-size: 0.78rem; color: var(--muted); }
.tools { padding: 10px 14px; border-bottom: 1px solid var(--border); }
.offline-btn { width: 100%; margin-bottom: 10px; }
.export-row { display: flex; flex-wrap: wrap; gap: 8px; }
.export-row .btn { flex: 1 1 auto; white-space: nowrap; }
.import-msg { margin: 8px 0 0; font-size: 0.78rem; color: var(--accent); }
.list { list-style: none; margin: 0; padding: 8px; overflow-y: auto; flex: 1; min-height: 0; }
.list li {
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
}
.list li:hover { background: var(--panel-2); }
.list li.active { background: var(--panel-2); border-color: var(--accent); }
.row-main { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.row-title { font-weight: 600; font-size: 0.9rem; }
.del {
  background: none; border: none; color: var(--muted);
  font-size: 1.3rem; line-height: 1; cursor: pointer; padding: 0 4px;
}
.del:hover { color: #f87171; }
.row-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; color: var(--muted); font-size: 0.78rem; margin-top: 4px; }
.row-note { font-size: 0.82rem; margin-top: 5px; color: var(--text); opacity: 0.85; }
.empty { color: var(--muted); font-size: 0.85rem; text-align: center; padding: 30px 16px; cursor: default; }
.empty:hover { background: none; }
</style>
