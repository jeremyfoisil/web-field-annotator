import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, type OfflineArea } from '../lib/db'
import {
  downloadArea,
  type DownloadOptions,
  type DownloadProgress,
} from '../lib/offline'

export const useOffline = defineStore('offline', () => {
  const areas = ref<OfflineArea[]>([])
  const progress = ref<DownloadProgress | null>(null)
  const running = ref(false)
  let controller: AbortController | null = null

  async function loadAreas() {
    areas.value = await db.offlineAreas.orderBy('createdAt').reverse().toArray()
  }

  async function download(opts: DownloadOptions) {
    if (running.value) return
    running.value = true
    controller = new AbortController()
    try {
      await downloadArea(opts, (p) => (progress.value = p), controller.signal)
      await loadAreas()
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        progress.value = {
          phase: 'error',
          tilesDone: 0,
          tilesTotal: 0,
          message: `Erreur : ${(e as Error).message}`,
        }
      } else {
        progress.value = null
      }
    } finally {
      running.value = false
      controller = null
    }
  }

  function cancel() {
    controller?.abort()
  }

  async function removeArea(id: string) {
    await db.offlineAreas.delete(id)
    await loadAreas()
  }

  return { areas, progress, running, loadAreas, download, cancel, removeArea }
})
