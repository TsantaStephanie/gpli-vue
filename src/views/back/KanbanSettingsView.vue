<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getKanbanSettings, saveKanbanSettings, type KanbanSetting } from '@/services/api/kanbanSettingsService'

const COLUMNS = [
  { id: 'new',      frLabel: 'Nouveau',  defaultColor: '#3b82f6', defaultMg: 'Vaovao'    },
  { id: 'progress', frLabel: 'En cours', defaultColor: '#f59e0b', defaultMg: 'Efa manao' },
  { id: 'done',     frLabel: 'Terminé',  defaultColor: '#22c55e', defaultMg: 'Vita'      },
]

const settings = ref<Record<string, KanbanSetting>>({})
const loading  = ref(true)
const saving   = ref(false)
const saved    = ref(false)
const error    = ref('')

onMounted(async () => {
  try {
    const data = await getKanbanSettings()
    const map: Record<string, KanbanSetting> = {}
    // initialiser avec défauts
    COLUMNS.forEach(c => {
      map[c.id] = { columnId: c.id, color: c.defaultColor, labelMg: c.defaultMg }
    })
    // écraser avec valeurs stockées
    data.forEach(s => { map[s.columnId] = { ...s } })
    settings.value = map
  } catch (e: any) {
    error.value = 'Impossible de charger les paramètres.'
  } finally {
    loading.value = false
  }
})

async function save() {
  saving.value = true
  error.value  = ''
  saved.value  = false
  try {
    await saveKanbanSettings(Object.values(settings.value))
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch {
    error.value = 'Erreur lors de la sauvegarde.'
  } finally {
    saving.value = false
  }
}

function reset() {
  COLUMNS.forEach(c => {
    settings.value[c.id] = { columnId: c.id, color: c.defaultColor, labelMg: c.defaultMg }
  })
}
</script>

<template>
  <div class="ks-page">

    <!-- En-tête -->
    <div class="ks-head">
      <div>
        <h1 class="ks-title">Paramètres Kanban</h1>
        <p class="ks-sub">Personnalisez les couleurs et les noms malgaches des colonnes</p>
      </div>
    </div>

    <!-- Erreur -->
    <div v-if="error" class="ks-alert">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {{ error }}
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="ks-grid">
      <div v-for="n in 3" :key="n" class="ks-skeleton"></div>
    </div>

    <!-- Cartes paramètres -->
    <div v-else class="ks-grid">
      <div
        v-for="col in COLUMNS" :key="col.id"
        class="ks-card"
        :style="{ borderTopColor: settings[col.id]?.color }"
      >
        <!-- Indicateur couleur -->
        <div class="ks-color-row">
          <div class="ks-dot" :style="{ background: settings[col.id]?.color }"></div>
          <span class="ks-col-name">{{ col.frLabel }}</span>
        </div>

        <!-- Couleur -->
        <div class="ks-field">
          <label class="ks-label">Couleur</label>
          <div class="color-input-wrap">
            <input
              type="color"
              v-model="settings[col.id].color"
              class="color-picker"
            />
            <input
              type="text"
              v-model="settings[col.id].color"
              class="color-text"
              placeholder="#3b82f6"
              maxlength="7"
            />
          </div>
          <div class="color-preview" :style="{ background: settings[col.id]?.color + '22' }">
            <span :style="{ color: settings[col.id]?.color, fontWeight: 700 }">
              Aperçu — {{ col.frLabel }}
            </span>
          </div>
        </div>

        <!-- Label malgache -->
        <div class="ks-field">
          <label class="ks-label">Nom en malgache</label>
          <input
            type="text"
            v-model="settings[col.id].labelMg"
            class="ks-input"
            :placeholder="col.defaultMg"
          />
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div v-if="!loading" class="ks-actions">
      <button class="btn-reset" @click="reset" :disabled="saving">
        Réinitialiser
      </button>
      <div class="actions-right">
        <Transition name="fade">
          <span v-if="saved" class="saved-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Sauvegardé
          </span>
        </Transition>
        <button class="btn-save" @click="save" :disabled="saving">
          <svg v-if="saving" class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          {{ saving ? 'Sauvegarde…' : 'Sauvegarder' }}
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.ks-page {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding-bottom: 3rem;
  max-width: 860px;
}

/* ── En-tête ────────────────────────────────────────────────── */
.ks-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; }

.ks-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -.03em;
  margin: 0;
}

.ks-sub {
  font-size: .875rem;
  color: #64748b;
  margin: .25rem 0 0;
}

/* ── Erreur ─────────────────────────────────────────────────── */
.ks-alert {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .75rem 1rem;
  background: #fef2f2;
  border-left: 3px solid #ef4444;
  border-radius: 8px;
  font-size: .875rem;
  color: #b91c1c;
}

/* ── Grille 3 colonnes ──────────────────────────────────────── */
.ks-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.ks-skeleton {
  height: 240px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e8edf2 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 14px;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ── Carte ──────────────────────────────────────────────────── */
.ks-card {
  background: #fff;
  border: 1px solid #e8edf2;
  border-top: 3px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  transition: border-top-color .2s;
}

.ks-color-row {
  display: flex;
  align-items: center;
  gap: .625rem;
}

.ks-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background .2s;
}

.ks-col-name {
  font-size: .9375rem;
  font-weight: 700;
  color: #0f172a;
}

/* ── Champ ──────────────────────────────────────────────────── */
.ks-field {
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

.ks-label {
  font-size: .6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: #94a3b8;
}

/* ── Color picker ───────────────────────────────────────────── */
.color-input-wrap {
  display: flex;
  align-items: center;
  gap: .5rem;
  border: 1.5px solid #e8edf2;
  border-radius: 9px;
  padding: .375rem .625rem;
  background: #fafafa;
  transition: border-color .15s;
}
.color-input-wrap:focus-within { border-color: #94a3b8; background: #fff; }

.color-picker {
  width: 28px;
  height: 28px;
  border: none;
  padding: 0;
  background: none;
  cursor: pointer;
  border-radius: 6px;
  flex-shrink: 0;
}
.color-picker::-webkit-color-swatch-wrapper { padding: 0; }
.color-picker::-webkit-color-swatch { border-radius: 5px; border: none; }

.color-text {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: .875rem;
  font-family: 'Courier New', monospace;
  color: #334155;
  font-weight: 600;
}

.color-preview {
  padding: .5rem .75rem;
  border-radius: 8px;
  font-size: .8125rem;
  transition: background .2s;
}

/* ── Input texte ─────────────────────────────────────────────── */
.ks-input {
  border: 1.5px solid #e8edf2;
  border-radius: 9px;
  padding: .625rem .875rem;
  font-size: .9375rem;
  color: #0f172a;
  background: #fafafa;
  outline: none;
  transition: border-color .15s, background .15s;
  font-family: inherit;
}
.ks-input:focus { border-color: #94a3b8; background: #fff; }
.ks-input::placeholder { color: #cbd5e1; }

/* ── Actions ────────────────────────────────────────────────── */
.ks-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.actions-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-reset {
  padding: .6rem 1.25rem;
  border: 1.5px solid #e8edf2;
  background: #fff;
  border-radius: 9px;
  font-size: .875rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: border-color .15s, color .15s;
}
.btn-reset:hover:not(:disabled) { border-color: #cbd5e1; color: #334155; }
.btn-reset:disabled { opacity: .4; cursor: not-allowed; }

.btn-save {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: .6rem 1.5rem;
  background: #0f172a;
  color: #fff;
  border: none;
  border-radius: 9px;
  font-size: .875rem;
  font-weight: 700;
  cursor: pointer;
  transition: background .15s, transform .1s;
}
.btn-save:hover:not(:disabled) { background: #1e293b; transform: translateY(-1px); }
.btn-save:disabled { opacity: .4; cursor: not-allowed; transform: none; }

.saved-badge {
  display: inline-flex;
  align-items: center;
  gap: .375rem;
  font-size: .8125rem;
  font-weight: 600;
  color: #16a34a;
}

.spin { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Fade transition ────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: opacity .3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ── Responsive ─────────────────────────────────────────────── */
@media (max-width: 768px) {
  .ks-grid { grid-template-columns: 1fr; }
}
</style>
