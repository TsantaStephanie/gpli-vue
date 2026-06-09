<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { createTicket, associateItemToTicket } from '@/services/api/ticketService'
import { GetAssets, type Asset } from '@/services/assets/assetsService'

const router = useRouter()
const route  = useRoute()

// ── Formulaire ──────────────────────────────────────────────────
const form = ref({
  name:     '',
  content:  '',
  type:     1 as 1 | 2,
  priority: 3,
})

// ── Assets ─────────────────────────────────────────────────────
const allAssets      = ref<Asset[]>([])
const selectedAssets = ref<Set<string>>(new Set())
const assetSearch    = ref('')
const showAssets     = ref(false)
const loadingAssets  = ref(false)

const filteredAssets = computed(() => {
  const t = assetSearch.value.trim().toLowerCase()
  if (!t) return allAssets.value
  return allAssets.value.filter(a =>
    a.name.toLowerCase().includes(t) ||
    a.serial?.toLowerCase().includes(t)
  )
})

function toggleAsset(asset: Asset) {
  const key = `${asset.type}-${asset.id}`
  if (selectedAssets.value.has(key)) selectedAssets.value.delete(key)
  else selectedAssets.value.add(key)
}

const selectedCount = computed(() => selectedAssets.value.size)

// ── Pré-sélection depuis la query (?itemtype=Computer&itemId=5) ─
onMounted(async () => {
  loadingAssets.value = true
  try {
    allAssets.value = await GetAssets()
    const { itemtype, itemId } = route.query
    if (itemtype && itemId) {
      const key = `${itemtype}-${itemId}`
      selectedAssets.value.add(key)
      showAssets.value = true
    }
  } catch (e) {
    console.error(e)
  } finally {
    loadingAssets.value = false
  }
})

// ── Soumission ──────────────────────────────────────────────────
const submitting = ref(false)
const error      = ref('')

const canSubmit = computed(() =>
  form.value.name.trim().length > 0 && form.value.content.trim().length > 0
)

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  error.value = ''
  try {
    const res = await createTicket({
      name:     form.value.name.trim(),
      content:  form.value.content.trim(),
      type:     form.value.type,
      priority: form.value.priority,
    })

    const ticketId = res.id
    if (selectedAssets.value.size > 0) {
      await Promise.allSettled(
        Array.from(selectedAssets.value).map(key => {
          const [itemtype, idStr] = key.split('-')
          return associateItemToTicket(ticketId, itemtype, parseInt(idStr, 10))
        })
      )
    }

    router.push('/front/tickets')
  } catch (e: any) {
    error.value = e.message || 'Erreur lors de la création du ticket.'
  } finally {
    submitting.value = false
  }
}

// ── Helpers ──────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  Computer: 'PC', Monitor: 'MON', Printer: 'IMP',
  Phone: 'TÉL', NetworkEquipment: 'NET',
}
function assetShort(type: string) { return TYPE_LABELS[type] ?? type.slice(0, 3).toUpperCase() }

const PRIORITY_OPTIONS = [
  { value: 1, label: 'Très basse' },
  { value: 2, label: 'Basse'      },
  { value: 3, label: 'Moyenne'    },
  { value: 4, label: 'Haute'      },
  { value: 5, label: 'Très haute' },
  { value: 6, label: 'Majeure'    },
]
</script>

<template>
  <div class="portal-page">

    <!-- ── Hero ─────────────────────────────────────────────── -->
    <div class="create-hero">
      <button class="btn-back" @click="router.push('/front/tickets')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Mes tickets
      </button>
      <div class="hero-text">
        <h1>Nouvelle demande</h1>
        <p>Signalez un incident ou faites une demande</p>
      </div>
    </div>

    <!-- ── Erreur ────────────────────────────────────────────── -->
    <div v-if="error" class="alert-error">{{ error }}</div>

    <!-- ── Formulaire ────────────────────────────────────────── -->
    <div class="form-card">

      <!-- Type -->
      <div class="field-group">
        <label class="field-label">Type de demande</label>
        <div class="type-toggle">
          <button
            class="type-btn" :class="{ active: form.type === 1 }"
            @click="form.type = 1"
          >
            <span class="type-icon icon-red">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </span>
            <span class="type-info">
              <strong>Incident</strong>
              <small>Quelque chose ne fonctionne plus</small>
            </span>
          </button>
          <button
            class="type-btn" :class="{ active: form.type === 2 }"
            @click="form.type = 2"
          >
            <span class="type-icon icon-blue">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
              </svg>
            </span>
            <span class="type-info">
              <strong>Demande</strong>
              <small>Une nouvelle ressource ou service</small>
            </span>
          </button>
        </div>
      </div>

      <!-- Priorité -->
      <div class="field-group">
        <label class="field-label">Priorité</label>
        <div class="priority-pills">
          <button
            v-for="p in PRIORITY_OPTIONS" :key="p.value"
            class="prio-pill" :class="[`prio-${p.value}`, { active: form.priority === p.value }]"
            @click="form.priority = p.value"
          >{{ p.label }}</button>
        </div>
      </div>

      <!-- Titre -->
      <div class="field-group">
        <label class="field-label" for="ticket-title">
          Titre <span class="required">*</span>
        </label>
        <input
          id="ticket-title"
          v-model="form.name"
          type="text"
          class="field-input"
          placeholder="Décrivez brièvement votre problème…"
          :class="{ 'input-filled': form.name.trim() }"
        />
      </div>

      <!-- Description -->
      <div class="field-group">
        <label class="field-label" for="ticket-desc">
          Description <span class="required">*</span>
        </label>
        <textarea
          id="ticket-desc"
          v-model="form.content"
          class="field-input"
          rows="5"
          placeholder="Décrivez le problème en détail : que s'est-il passé, depuis quand, quel impact…"
          :class="{ 'input-filled': form.content.trim() }"
        ></textarea>
      </div>

      <!-- Matériel concerné (accordéon) -->
      <div class="field-group">
        <button class="assets-toggle" @click="showAssets = !showAssets" type="button">
          <span>
            Matériel concerné
            <span v-if="selectedCount" class="selected-badge">{{ selectedCount }} sélectionné{{ selectedCount > 1 ? 's' : '' }}</span>
          </span>
          <svg :class="{ rotated: showAssets }" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div v-if="showAssets" class="assets-panel">
          <div class="assets-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              v-model="assetSearch"
              type="text"
              placeholder="Chercher un équipement…"
            />
          </div>

          <div v-if="loadingAssets" class="assets-loading">Chargement…</div>
          <div v-else class="assets-list">
            <label
              v-for="asset in filteredAssets"
              :key="`${asset.type}-${asset.id}`"
              class="asset-row"
              :class="{ checked: selectedAssets.has(`${asset.type}-${asset.id}`) }"
            >
              <input
                type="checkbox"
                :checked="selectedAssets.has(`${asset.type}-${asset.id}`)"
                @change="toggleAsset(asset)"
              />
              <span class="a-badge">{{ assetShort(asset.type) }}</span>
              <div class="a-info">
                <span class="a-name">{{ asset.name }}</span>
                <span class="a-sub">{{ asset.locationName && asset.locationName !== '-' ? asset.locationName : `#${asset.id}` }}</span>
              </div>
            </label>
            <div v-if="!filteredAssets.length" class="assets-empty">Aucun équipement trouvé</div>
          </div>
        </div>
      </div>

    </div>

    <!-- ── Actions ────────────────────────────────────────────── -->
    <div class="form-actions">
      <button class="btn-ghost" @click="router.push('/front/tickets')" :disabled="submitting">
        Annuler
      </button>
      <button
        class="btn-submit"
        @click="submit"
        :disabled="!canSubmit || submitting"
      >
        <svg v-if="submitting" class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        {{ submitting ? 'Envoi en cours…' : 'Envoyer la demande' }}
      </button>
    </div>

  </div>
</template>

<style scoped>
/* ── Page ──────────────────────────────────────────────────── */
.portal-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 2rem;
  max-width: 680px;
}

/* ── Hero ──────────────────────────────────────────────────── */
.create-hero {
  display: flex;
  flex-direction: column;
  gap: .75rem;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: .375rem;
  font-size: .8125rem;
  font-weight: 500;
  color: #64748b;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color .15s;
}
.btn-back:hover { color: #3b82f6; }

.hero-text h1 {
  font-size: 1.625rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -.03em;
  margin: 0;
}
.hero-text p {
  font-size: .875rem;
  color: #64748b;
  margin: .25rem 0 0;
}

/* ── Alerte ────────────────────────────────────────────────── */
.alert-error {
  background: #fef2f2;
  border: 1px solid rgba(239,68,68,.2);
  border-left: 3px solid #ef4444;
  border-radius: 8px;
  color: #b91c1c;
  padding: .75rem 1rem;
  font-size: .875rem;
}

/* ── Carte formulaire ──────────────────────────────────────── */
.form-card {
  background: #fff;
  border: 1px solid #e8edf2;
  border-radius: 16px;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Champs ────────────────────────────────────────────────── */
.field-group {
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

.field-label {
  font-size: .8125rem;
  font-weight: 600;
  color: #334155;
  letter-spacing: .01em;
}

.required { color: #ef4444; }

.field-input {
  width: 100%;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: .625rem .875rem;
  font-size: .9375rem;
  color: #0f172a;
  background: #f8fafc;
  outline: none;
  transition: border-color .15s, background .15s, box-shadow .15s;
  box-sizing: border-box;
  resize: vertical;
  font-family: inherit;
}
.field-input:focus,
.field-input.input-filled {
  background: #fff;
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(59,130,246,.1);
}
.field-input::placeholder { color: #94a3b8; }

/* ── Type toggle ───────────────────────────────────────────── */
.type-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .625rem;
}

.type-btn {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .875rem 1rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  cursor: pointer;
  text-align: left;
  transition: all .15s;
}
.type-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }
.type-btn.active { background: #fff; border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }

.type-icon {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-red  { background: #fee2e2; color: #b91c1c; }
.icon-blue { background: #dbeafe; color: #1d4ed8; }

.type-info { display: flex; flex-direction: column; gap: .125rem; }
.type-info strong { font-size: .9375rem; font-weight: 700; color: #0f172a; }
.type-info small  { font-size: .75rem; color: #64748b; }

/* ── Priorité ──────────────────────────────────────────────── */
.priority-pills {
  display: flex;
  gap: .375rem;
  flex-wrap: wrap;
}

.prio-pill {
  padding: .375rem .875rem;
  border-radius: 8px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  font-size: .8125rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all .15s;
}
.prio-pill:hover { background: #f1f5f9; }
.prio-1.active, .prio-2.active { background: #dcfce7; border-color: #86efac; color: #15803d; }
.prio-3.active                  { background: #dbeafe; border-color: #93c5fd; color: #1d4ed8; }
.prio-4.active                  { background: #ffedd5; border-color: #fdba74; color: #c2410c; }
.prio-5.active, .prio-6.active  { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }

/* ── Matériel (accordéon) ──────────────────────────────────── */
.assets-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: .75rem 1rem;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: .9rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: background .15s;
}
.assets-toggle:hover { background: #f1f5f9; }
.assets-toggle svg { transition: transform .2s; }
.assets-toggle svg.rotated { transform: rotate(180deg); }

.selected-badge {
  display: inline-block;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: .6875rem;
  font-weight: 700;
  padding: .15rem .5rem;
  border-radius: 100px;
  margin-left: .5rem;
}

.assets-panel {
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  margin-top: .25rem;
}

.assets-search {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .625rem .875rem;
  border-bottom: 1px solid #f1f5f9;
  color: #94a3b8;
}
.assets-search input {
  border: none;
  outline: none;
  font-size: .8125rem;
  color: #0f172a;
  background: transparent;
  flex: 1;
}
.assets-search input::placeholder { color: #94a3b8; }

.assets-list {
  max-height: 240px;
  overflow-y: auto;
}

.assets-loading,
.assets-empty {
  padding: 1.5rem;
  text-align: center;
  font-size: .875rem;
  color: #94a3b8;
}

.asset-row {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .625rem .875rem;
  cursor: pointer;
  transition: background .1s;
  border-bottom: 1px solid #f8fafc;
}
.asset-row:hover   { background: #f8fafc; }
.asset-row.checked { background: #eff6ff; }

.asset-row input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: #3b82f6;
  cursor: pointer;
  flex-shrink: 0;
}

.a-badge {
  font-size: .6rem;
  font-weight: 800;
  background: #e2e8f0;
  color: #475569;
  padding: .15rem .4rem;
  border-radius: 5px;
  text-transform: uppercase;
  letter-spacing: .04em;
  flex-shrink: 0;
}

.a-info { display: flex; flex-direction: column; gap: .1rem; min-width: 0; }
.a-name { font-size: .875rem; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.a-sub  { font-size: .75rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Actions ───────────────────────────────────────────────── */
.form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: .75rem;
}

.btn-ghost {
  padding: .625rem 1.25rem;
  border: 1px solid #e2e8f0;
  background: none;
  border-radius: 10px;
  font-size: .9rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: background .15s;
}
.btn-ghost:hover:not(:disabled) { background: #f8fafc; }
.btn-ghost:disabled { opacity: .5; cursor: not-allowed; }

.btn-submit {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  padding: .625rem 1.5rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: .9rem;
  cursor: pointer;
  transition: background .15s, box-shadow .15s, transform .1s;
}
.btn-submit:hover:not(:disabled) { background: #2563eb; box-shadow: 0 4px 12px rgba(59,130,246,.35); transform: translateY(-1px); }
.btn-submit:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }

.spin { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Responsive ────────────────────────────────────────────── */
@media (max-width: 520px) {
  .form-card { padding: 1.25rem; }
  .type-toggle { grid-template-columns: 1fr; }
  .form-actions { flex-direction: column-reverse; }
  .btn-ghost, .btn-submit { width: 100%; justify-content: center; }
}
</style>
