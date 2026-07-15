import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, type Observation } from '../lib/db'
import { parseObservationsFromGeoJSON } from '../lib/import'
import { newId } from '../lib/uuid'

export const useObservations = defineStore('observations', () => {
  const items = ref<Observation[]>([])
  const selectedId = ref<string | null>(null)

  const sorted = computed(() =>
    [...items.value].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)),
  )

  async function loadAll() {
    items.value = await db.observations.toArray()
  }

  /** Crée une observation (point) à partir d'un tap carte. */
  async function logAtPoint(
    lngLat: [number, number],
    observateur: string,
    note = '',
  ): Promise<Observation> {
    const obs: Observation = {
      id: newId(),
      // lngLat vient d'un ref Vue (Proxy) → tableau simple pour IndexedDB.
      point: [lngLat[0], lngLat[1]],
      observateur,
      loggedAt: new Date().toISOString(),
      note,
    }
    await db.observations.put(obs)
    items.value.push(obs)
    selectedId.value = obs.id
    return obs
  }

  async function update(id: string, patch: Partial<Observation>) {
    const idx = items.value.findIndex((o) => o.id === id)
    if (idx === -1) return
    const next = { ...items.value[idx], ...patch }
    await db.observations.put(JSON.parse(JSON.stringify(next)) as Observation)
    items.value[idx] = next
  }

  async function remove(id: string) {
    await db.observations.delete(id)
    items.value = items.value.filter((o) => o.id !== id)
    if (selectedId.value === id) selectedId.value = null
  }

  function select(id: string | null) {
    selectedId.value = id
  }

  /** Importe des observations depuis un texte GeoJSON. Dédoublonne par id. */
  async function importFromGeoJSON(
    text: string,
    defaultObservateur: string,
  ): Promise<{ added: number; duplicates: number; skipped: number }> {
    const { observations, skipped } = parseObservationsFromGeoJSON(text, {
      observateur: defaultObservateur,
      loggedAt: new Date().toISOString(),
    })
    const existing = new Set(items.value.map((o) => o.id))
    const toAdd = observations.filter((o) => !existing.has(o.id))
    const duplicates = observations.length - toAdd.length
    if (toAdd.length) {
      await db.observations.bulkPut(toAdd)
      items.value.push(...toAdd)
    }
    return { added: toAdd.length, duplicates, skipped }
  }

  return {
    items,
    selectedId,
    sorted,
    loadAll,
    logAtPoint,
    update,
    remove,
    select,
    importFromGeoJSON,
  }
})
