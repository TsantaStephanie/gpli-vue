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
  <div class="create-page">

    <!-- ── Breadcrumb ────────────────────────────────────────── -->
    <button class="back-btn" @click="router.back()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
      </svg>
      Retour
    </button>

    <!-- ── Titre ─────────────────────────────────────────────── -->
    <div class="page-head">
      <h1 class="page-title">Nouvelle demande</h1>
      <p class="page-sub">Signalez un incident ou faites une demande de service</p>
    </div>

    <!-- ── Erreur ────────────────────────────────────────────── -->
    <div v-if="error" class="alert-error">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {{ error }}
    </div>

    <!-- ── Sections ──────────────────────────────────────────── -->
    <div class="form-sections">

      <!-- Type -->
      <section class="f-section">
        <p class="f-label">Type de demande</p>
        <div class="type-row">
          <button class="type-card" :class="{ active: form.type === 1, 'tc-red': form.type === 1 }" @click="form.type = 1">
            <span class="tc-icon red">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </span>
            <span class="tc-body">
              <strong>Incident</strong>
              <small>Quelque chose ne fonctionne plus</small>
            </span>
            <span class="tc-check" v-if="form.type === 1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          </button>

          <button class="type-card" :class="{ active: form.type === 2, 'tc-blue': form.type === 2 }" @click="form.type = 2">
            <span class="tc-icon blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
              </svg>
            </span>
            <span class="tc-body">
              <strong>Demande</strong>
              <small>Une nouvelle ressource ou service</small>
            </span>
            <span class="tc-check" v-if="form.type === 2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          </button>
        </div>
      </section>

      <div class="f-divider"></div>

      <!-- Titre -->
      <section class="f-section">
        <label class="f-label" for="f-title">
          Titre <span class="req">*</span>
        </label>
        <input
          id="f-title"
          v-model="form.name"
          type="text"
          class="f-input"
          placeholder="Résumez votre demande en une phrase…"
        />
      </section>

      <!-- Description -->
      <section class="f-section">
        <label class="f-label" for="f-desc">
          Description <span class="req">*</span>
        </label>
        <textarea
          id="f-desc"
          v-model="form.content"
          class="f-input f-textarea"
          rows="6"
          placeholder="Décrivez le problème : que s'est-il passé, depuis quand, quel impact sur votre travail…"
        ></textarea>
      </section>

      <div class="f-divider"></div>

      <!-- Priorité -->
      <section class="f-section">
        <p class="f-label">Priorité</p>
        <div class="prio-row">
          <button
            v-for="p in PRIORITY_OPTIONS" :key="p.value"
            class="prio-btn"
            :class="[`p${p.value}`, { active: form.priority === p.value }]"
            @click="form.priority = p.value"
          >{{ p.label }}</button>
        </div>
      </section>

      <div class="f-divider"></div>

      <!-- Matériel -->
      <section class="f-section">
        <button class="assets-header" @click="showAssets = !showAssets" type="button">
          <span class="f-label" style="margin:0; pointer-events:none">
            Matériel concerné
            <span v-if="selectedCount" class="sel-badge">{{ selectedCount }}</span>
          </span>
          <svg class="chevron-ico" :class="{ open: showAssets }" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div v-if="showAssets" class="assets-body">
          <div class="assets-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input v-model="assetSearch" type="text" placeholder="Chercher un équipement…" />
          </div>
          <div v-if="loadingAssets" class="assets-msg">Chargement…</div>
          <div v-else class="assets-list">
            <label
              v-for="asset in filteredAssets"
              :key="`${asset.type}-${asset.id}`"
              class="asset-row"
              :class="{ checked: selectedAssets.has(`${asset.type}-${asset.id}`) }"
            >
              <input type="checkbox" :checked="selectedAssets.has(`${asset.type}-${asset.id}`)" @change="toggleAsset(asset)" />
              <span class="a-tag">{{ assetShort(asset.type) }}</span>
              <div class="a-info">
                <span class="a-name">{{ asset.name }}</span>
                <span class="a-sub">{{ asset.locationName && asset.locationName !== '-' ? asset.locationName : `#${asset.id}` }}</span>
              </div>
            </label>
            <div v-if="!filteredAssets.length" class="assets-msg">Aucun équipement trouvé</div>
          </div>
        </div>
      </section>

    </div>

    <!-- ── Actions ───────────────────────────────────────────── -->
    <div class="form-actions">
      <button class="btn-cancel" @click="router.push('/front/tickets')" :disabled="submitting">
        Annuler
      </button>
      <button class="btn-submit" @click="submit" :disabled="!canSubmit || submitting">
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
.create-page {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding-bottom: 3rem;
}

/* ── Breadcrumb ────────────────────────────────────────────── */
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: .375rem;
  font-size: .8125rem;
  font-weight: 500;
  color: #94a3b8;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  width: fit-content;
  transition: color .15s;
}
.back-btn:hover { color: #334155; }

/* ── Titre page ────────────────────────────────────────────── */
.page-head { display: flex; flex-direction: column; gap: .375rem; }

.page-title {
  font-size: 1.875rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -.04em;
  margin: 0;
  line-height: 1.15;
}

.page-sub {
  font-size: .9375rem;
  color: #64748b;
  margin: 0;
  font-weight: 400;
}

/* ── Erreur ────────────────────────────────────────────────── */
.alert-error {
  display: flex;
  align-items: center;
  gap: .5rem;
  background: #fef2f2;
  border-left: 3px solid #ef4444;
  border-radius: 8px;
  color: #b91c1c;
  padding: .75rem 1rem;
  font-size: .875rem;
}

/* ── Sections ──────────────────────────────────────────────── */
.form-sections {
  background: #fff;
  border: 1px solid #e8edf2;
  border-radius: 18px;
  overflow: hidden;
}

.f-section {
  padding: 1.5rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: .875rem;
}

.f-divider {
  height: 1px;
  background: #f1f5f9;
  margin: 0;
}

.f-label {
  font-size: .6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: #94a3b8;
  margin: 0;
}

.req { color: #ef4444; }

/* ── Inputs ────────────────────────────────────────────────── */
.f-input {
  width: 100%;
  border: 1.5px solid #e8edf2;
  border-radius: 10px;
  padding: .875rem 1.125rem;
  font-size: .9375rem;
  color: #0f172a;
  background: #fafafa;
  outline: none;
  transition: border-color .15s, background .15s, box-shadow .15s;
  box-sizing: border-box;
  font-family: inherit;
  line-height: 1.5;
}
.f-input:focus {
  background: #fff;
  border-color: #94a3b8;
  box-shadow: 0 0 0 3px rgba(148,163,184,.12);
}
.f-input::placeholder { color: #cbd5e1; }
.f-textarea { resize: vertical; min-height: 140px; }

/* ── Type ──────────────────────────────────────────────────── */
.type-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .75rem;
}

.type-card {
  display: flex;
  align-items: center;
  gap: .875rem;
  padding: 1rem 1.125rem;
  border: 1.5px solid #e8edf2;
  border-radius: 12px;
  background: #fafafa;
  cursor: pointer;
  text-align: left;
  transition: border-color .15s, background .15s, box-shadow .15s;
  position: relative;
}
.type-card:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}
.type-card.active {
  background: #fff;
  box-shadow: 0 0 0 1.5px currentColor;
}
.type-card.tc-red  { border-color: #fca5a5; color: #ef4444; box-shadow: 0 0 0 1.5px #fca5a5; }
.type-card.tc-blue { border-color: #93c5fd; color: #3b82f6; box-shadow: 0 0 0 1.5px #93c5fd; }

.tc-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.tc-icon.red  { background: #fee2e2; color: #ef4444; }
.tc-icon.blue { background: #dbeafe; color: #3b82f6; }

.tc-body {
  display: flex;
  flex-direction: column;
  gap: .2rem;
  flex: 1;
}
.tc-body strong { font-size: .9375rem; font-weight: 700; color: #0f172a; }
.tc-body small  { font-size: .75rem; color: #64748b; font-weight: 400; }

.tc-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.tc-check svg { stroke: #fff; }

/* ── Priorité ──────────────────────────────────────────────── */
.prio-row {
  display: flex;
  gap: .375rem;
  flex-wrap: wrap;
}

.prio-btn {
  padding: .5rem 1rem;
  border-radius: 8px;
  border: 1.5px solid #e8edf2;
  background: #fafafa;
  font-size: .8125rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all .15s;
  letter-spacing: .01em;
}
.prio-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }

.p1.active, .p2.active { background: #f0fdf4; border-color: #86efac; color: #15803d; }
.p3.active              { background: #eff6ff; border-color: #93c5fd; color: #1d4ed8; }
.p4.active              { background: #fff7ed; border-color: #fdba74; color: #c2410c; }
.p5.active, .p6.active  { background: #fef2f2; border-color: #fca5a5; color: #b91c1c; }

/* ── Matériel ──────────────────────────────────────────────── */
.assets-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  width: 100%;
}

.chevron-ico {
  color: #cbd5e1;
  transition: transform .2s;
  flex-shrink: 0;
}
.chevron-ico.open { transform: rotate(180deg); color: #64748b; }

.assets-body {
  border: 1.5px solid #e8edf2;
  border-radius: 10px;
  overflow: hidden;
  margin-top: .25rem;
}

.assets-search {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .625rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  color: #cbd5e1;
}
.assets-search input {
  border: none;
  outline: none;
  font-size: .8125rem;
  color: #0f172a;
  background: transparent;
  flex: 1;
}
.assets-search input::placeholder { color: #cbd5e1; }

.assets-list { max-height: 240px; overflow-y: auto; }

.assets-msg {
  padding: 1.25rem;
  text-align: center;
  font-size: .875rem;
  color: #94a3b8;
}

.asset-row {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .625rem 1rem;
  cursor: pointer;
  transition: background .1s;
  border-bottom: 1px solid #f8fafc;
}
.asset-row:hover   { background: #f8fafc; }
.asset-row.checked { background: #f0f9ff; }

.asset-row input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: #3b82f6;
  cursor: pointer;
  flex-shrink: 0;
}

.a-tag {
  font-size: .6rem;
  font-weight: 800;
  background: #f1f5f9;
  color: #475569;
  padding: .15rem .4rem;
  border-radius: 4px;
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
  gap: .75rem;
}

.btn-cancel {
  padding: .75rem 1.5rem;
  border: 1.5px solid #e8edf2;
  background: #fff;
  border-radius: 10px;
  font-size: .9375rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: border-color .15s, color .15s;
}
.btn-cancel:hover:not(:disabled) { border-color: #cbd5e1; color: #334155; }
.btn-cancel:disabled { opacity: .4; cursor: not-allowed; }

.btn-submit {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .5rem;
  padding: .75rem 1.5rem;
  background: #0f172a;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: .9375rem;
  cursor: pointer;
  transition: background .15s, transform .1s;
}
.btn-submit:hover:not(:disabled) { background: #1e293b; transform: translateY(-1px); }
.btn-submit:disabled { opacity: .4; cursor: not-allowed; transform: none; }

.sel-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: #3b82f6;
  color: #fff;
  font-size: .625rem;
  font-weight: 800;
  border-radius: 50%;
  margin-left: .375rem;
  vertical-align: middle;
}

.spin { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Responsive ────────────────────────────────────────────── */
@media (max-width: 520px) {
  .f-section { padding: 1.25rem; }
  .type-row  { grid-template-columns: 1fr; }
  .form-actions { flex-direction: column-reverse; }
  .btn-cancel, .btn-submit { width: 100%; }
}
</style>
