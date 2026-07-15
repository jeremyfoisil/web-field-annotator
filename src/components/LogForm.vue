<script setup lang="ts">
import { ref } from 'vue'
import { useSettings } from '../stores/settings'
import { useObservations } from '../stores/observations'

const props = defineProps<{ point: [number, number] }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const settings = useSettings()
const observations = useObservations()

const note = ref('')
const saving = ref(false)
const error = ref<string | null>(null)

async function save() {
  error.value = null
  if (!settings.observateur.trim()) {
    error.value = "Renseignez le nom de l'ingénieur en charge."
    return
  }
  saving.value = true
  try {
    await observations.logAtPoint(
      props.point,
      settings.observateur.trim(),
      note.value.trim(),
    )
    emit('saved')
  } catch (e) {
    error.value = `Enregistrement impossible : ${(e as Error).message}`
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <h2>Logger une observation</h2>

      <div class="coords-card">
        <div class="badge">Position</div>
        <div class="coords">{{ point[1].toFixed(5) }}, {{ point[0].toFixed(5) }}</div>
      </div>

      <label class="field">
        <span>Ingénieur en charge</span>
        <input v-model="settings.observateur" type="text" placeholder="Nom Prénom" />
      </label>

      <label class="field">
        <span>Note (optionnel)</span>
        <textarea v-model="note" rows="2" placeholder="Observation…"></textarea>
      </label>

      <p class="hint">Horodatage automatique à l'enregistrement.</p>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button class="btn ghost" @click="emit('close')">Annuler</button>
        <button class="btn primary" :disabled="saving" @click="save">
          {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 50;
}
.sheet {
  background: var(--panel);
  width: min(560px, 100%);
  border-radius: 16px 16px 0 0;
  padding: 20px 18px calc(18px + env(safe-area-inset-bottom));
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.4);
}
@media (min-width: 720px) {
  .overlay { align-items: center; }
  .sheet { border-radius: 16px; }
}
h2 { margin: 0 0 14px; font-size: 1.1rem; }
.coords-card {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 14px;
}
.badge {
  display: inline-block;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--accent);
  margin-bottom: 6px;
}
.coords { font-family: ui-monospace, monospace; font-size: 0.95rem; }
.field { display: block; margin-bottom: 12px; }
.field > span { display: block; font-size: 0.85rem; color: var(--muted); margin-bottom: 5px; }
input, textarea {
  width: 100%;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 11px 12px;
  color: var(--text);
  font: inherit;
}
.hint { font-size: 0.78rem; color: var(--muted); margin: 4px 0 14px; }
.error {
  font-size: 0.82rem; color: #fca5a5;
  background: rgba(239, 68, 68, 0.12); border: 1px solid #b91c1c;
  border-radius: 8px; padding: 8px 10px; margin: 0 0 12px;
}
.actions { display: flex; gap: 10px; }
.actions .btn { flex: 1; }
</style>
