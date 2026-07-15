import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { RASTER_LAYERS } from '../config/layers'

const LS_OBSERVATEUR = 'fa.observateur'
const LS_LAYERS = 'fa.activeLayers'

export const useSettings = defineStore('settings', () => {
  const observateur = ref<string>(localStorage.getItem(LS_OBSERVATEUR) ?? '')

  const stored = localStorage.getItem(LS_LAYERS)
  const activeLayerIds = ref<string[]>(
    stored
      ? (JSON.parse(stored) as string[])
      : RASTER_LAYERS.filter((l) => l.visibleByDefault).map((l) => l.id),
  )

  watch(observateur, (v) => localStorage.setItem(LS_OBSERVATEUR, v))
  watch(
    activeLayerIds,
    (v) => localStorage.setItem(LS_LAYERS, JSON.stringify(v)),
    { deep: true },
  )

  function toggleLayer(id: string) {
    const i = activeLayerIds.value.indexOf(id)
    if (i === -1) activeLayerIds.value.push(id)
    else activeLayerIds.value.splice(i, 1)
  }

  return { observateur, activeLayerIds, toggleLayer }
})
