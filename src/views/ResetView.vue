<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { resetService } from '@/services/api/resetService'
import { deleteAllTicketCosts } from '@/services/api/ticketCostService'

type ItemStatus = 'pending' | 'processing' | 'done' | 'error'

interface ResetResult {
  itemtype: string
  success: boolean
  count: number
  message?: string
  error?: any
}

const ITEM_LABELS: Record<string, string> = {
  Computer:         'Ordinateurs',
  Monitor:          'Moniteurs',
  Printer:          'Imprimantes',
  Phone:            'Téléphones',
  NetworkEquipment: 'Équipements réseau',
  Peripheral:       'Périphériques',
  Software:         'Logiciels',
  Ticket:           'Tickets',
  Problem:          'Problèmes',
  Change:           'Changements',
  SLA:              'SLA',
  ITILCategory:     'Catégories ITIL',
  Location:         'Localisations',
  Budget:           'Budgets',
  Document:         'Documents',
  TicketCostSQLite: 'Coûts tickets (SQLite)',
}

const ITEM_GROUPS = [
  { label: 'Parc',      keys: ['Computer','Monitor','Printer','Phone','NetworkEquipment','Peripheral'] },
  { label: 'ITIL',      keys: ['Ticket','Problem','Change'] },
  { label: 'Logiciels', keys: ['Software'] },
  { label: 'Référentiels', keys: ['SLA','ITILCategory','Location','Budget','Document'] },
  { label: 'SQLite',       keys: ['TicketCostSQLite'] },
]

const state      = ref<'idle' | 'confirm' | 'resetting' | 'done'>('idle')
const checked    = ref(false)
const results    = ref<ResetResult[]>([])
const liveStatus = reactive<Record<string, { status: ItemStatus; count: number }>>({})

const allItemtypes = Object.keys(ITEM_LABELS)

const successCount = computed(() => results.value.filter(r => r.success).length)
const errorCount   = computed(() => results.value.filter(r => !r.success).length)
const totalDeleted = computed(() => results.value.reduce((s, r) => s + (r.count ?? 0), 0))

const currentItem = computed(() =>
  allItemtypes.find(k => liveStatus[k]?.status === 'processing') ?? null
)

function goConfirm() { state.value = 'confirm'; checked.value = false }
function cancel()    { state.value = 'idle' }
function restart()   {
  state.value = 'idle'
  results.value = []
  allItemtypes.forEach(k => delete liveStatus[k])
}

async function run() {
  state.value = 'resetting'
  results.value = []
  allItemtypes.forEach(k => { liveStatus[k] = { status: 'pending', count: 0 } })

  // 1. Reset GLPI
  const res = await resetService.resetDatabase((itemtype, status, count) => {
    liveStatus[itemtype] = { status, count }
  })
  results.value = res as ResetResult[]

  // 2. Reset SQLite (ticket_cost)
  liveStatus['TicketCostSQLite'] = { status: 'processing', count: 0 }
  try {
    await deleteAllTicketCosts()
    liveStatus['TicketCostSQLite'] = { status: 'done', count: 1 }
    results.value.push({ itemtype: 'TicketCostSQLite', success: true, count: 1 })
    console.log('[Reset] SQLite ticket_cost vidé')
  } catch (e: any) {
    liveStatus['TicketCostSQLite'] = { status: 'error', count: 0 }
    results.value.push({ itemtype: 'TicketCostSQLite', success: false, count: 0, error: e })
    console.error('[Reset] Erreur SQLite :', e)
  }

  state.value = 'done'
}
</script>

<template>
  <div class="reset-view animate-in">

    <!-- ── Header ── -->
    <div class="mv-header">
      <div class="mv-title-wrap">
        <div class="mv-icon icon-red">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </div>
        <div>
          <h1 class="mv-title">Réinitialisation des données</h1>
          <p class="mv-sub">Suppression définitive de tous les éléments GLPI importés</p>
        </div>
      </div>
      <div class="mv-actions" v-if="state === 'done'">
        <button class="btn-secondary" @click="restart">Réinitialiser à nouveau</button>
      </div>
    </div>

    <!-- ── Idle : aperçu de ce qui sera supprimé ── -->
    <div v-if="state === 'idle'" class="idle-section">
      <div class="scope-card">
        <div class="scope-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Éléments qui seront supprimés de façon permanente</span>
        </div>
        <div class="scope-groups">
          <div v-for="group in ITEM_GROUPS" :key="group.label" class="scope-group">
            <p class="scope-group-label">{{ group.label }}</p>
            <div class="scope-tags">
              <span v-for="k in group.keys" :key="k" class="scope-tag">{{ ITEM_LABELS[k] }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="idle-action">
        <button class="btn-danger" @click="goConfirm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
          Réinitialiser les données
        </button>
        <p class="idle-hint">Cette action supprimera définitivement les données importées dans GLPI.</p>
      </div>
    </div>

    <!-- ── Confirmation ── -->
    <div v-if="state === 'confirm'" class="confirm-section">
      <div class="confirm-card">
        <div class="confirm-warning">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <p class="confirm-warning-title">Action irréversible</p>
            <p class="confirm-warning-sub">
              Tous les éléments listés seront supprimés définitivement de GLPI.<br>
              Il n'est pas possible d'annuler cette opération après confirmation.
            </p>
          </div>
        </div>

        <label class="confirm-check">
          <input type="checkbox" v-model="checked" />
          <span>Je comprends que cette action est irréversible et souhaite continuer</span>
        </label>

        <div class="confirm-actions">
          <button class="btn-secondary" @click="cancel">Annuler</button>
          <button class="btn-danger" :disabled="!checked" @click="run">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
            Confirmer la réinitialisation
          </button>
        </div>
      </div>
    </div>

    <!-- ── Progression live ── -->
    <div v-if="state === 'resetting'" class="progress-section">
      <div class="progress-header">
        <div class="progress-spinner"></div>
        <div>
          <p class="progress-title">Réinitialisation en cours…</p>
          <p class="progress-sub" v-if="currentItem">Traitement : {{ ITEM_LABELS[currentItem] }}</p>
        </div>
      </div>

      <div class="live-list">
        <div
          v-for="key in allItemtypes"
          :key="key"
          class="live-row"
          :class="liveStatus[key]?.status ?? 'pending'"
        >
          <div class="live-dot">
            <svg v-if="liveStatus[key]?.status === 'done'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>
            <svg v-else-if="liveStatus[key]?.status === 'error'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <div v-else-if="liveStatus[key]?.status === 'processing'" class="live-pulse"></div>
          </div>
          <span class="live-label">{{ ITEM_LABELS[key] }}</span>
          <span class="live-count" v-if="liveStatus[key]?.status === 'done' && liveStatus[key].count > 0">
            {{ liveStatus[key].count }} supprimé(s)
          </span>
          <span class="live-count empty" v-else-if="liveStatus[key]?.status === 'done'">Vide</span>
        </div>
      </div>
    </div>

    <!-- ── Résultats ── -->
    <div v-if="state === 'done'" class="results-section">

      <div class="result-banner" :class="errorCount === 0 ? 'banner-success' : 'banner-warning'">
        <svg v-if="errorCount === 0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span v-if="errorCount === 0">
          Réinitialisation terminée — {{ totalDeleted }} élément(s) supprimé(s) sur {{ successCount }} catégorie(s)
        </span>
        <span v-else>
          Réinitialisation partielle — {{ errorCount }} catégorie(s) en erreur
        </span>
      </div>

      <div class="result-timeline">
        <div
          v-for="(res, i) in results"
          :key="res.itemtype"
          class="tl-row"
          :class="res.success ? 'success' : 'error'"
        >
          <div class="tl-indicator">
            <div class="tl-dot">
              <svg v-if="res.success" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>
              <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <div v-if="i < results.length - 1" class="tl-line"></div>
          </div>
          <div class="tl-content">
            <div class="tl-header-row">
              <span class="tl-name">{{ ITEM_LABELS[res.itemtype] ?? res.itemtype }}</span>
              <span class="tl-badge" :class="res.success ? 'badge-success' : 'badge-error'">
                {{ res.success ? (res.count > 0 ? `${res.count} supprimé(s)` : 'Vide') : 'Erreur' }}
              </span>
            </div>
            <p v-if="!res.success" class="tl-error-msg">
              {{ res.error?.message ?? 'Erreur inconnue' }}
            </p>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.reset-view {
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Icon rouge dans le header ── */
.mv-icon.icon-red {
  background: rgba(239,68,68,.12);
  color: var(--c-danger);
}

/* ── Idle ── */
.idle-section { display: flex; flex-direction: column; gap: 1rem; }

.scope-card {
  background: var(--c-card);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.scope-header {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: .75rem 1rem;
  background: rgba(245,158,11,.06);
  border-bottom: 1px solid rgba(245,158,11,.18);
  font-size: .8125rem;
  font-weight: 500;
  color: #92400e;
}

.scope-groups {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: .875rem;
}

.scope-group-label {
  font-size: .7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--c-text-3);
  margin-bottom: .4rem;
}

.scope-tags { display: flex; flex-wrap: wrap; gap: .35rem; }

.scope-tag {
  font-size: .75rem;
  padding: .2rem .55rem;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 100px;
  color: var(--c-text-2);
}

.idle-action {
  display: flex;
  align-items: center;
  gap: .875rem;
  flex-wrap: wrap;
}

.idle-hint {
  font-size: .75rem;
  color: var(--c-text-3);
}

/* ── Confirm ── */
.confirm-section { display: flex; flex-direction: column; gap: 1rem; }

.confirm-card {
  background: var(--c-card);
  border: 1.5px solid rgba(239,68,68,.3);
  border-radius: var(--radius);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.confirm-warning {
  display: flex;
  gap: .875rem;
  align-items: flex-start;
  color: #dc2626;
}

.confirm-warning svg { flex-shrink: 0; margin-top: .1rem; }

.confirm-warning-title {
  font-size: .9375rem;
  font-weight: 700;
  margin-bottom: .3rem;
}

.confirm-warning-sub {
  font-size: .8125rem;
  color: #991b1b;
  line-height: 1.55;
}

.confirm-check {
  display: flex;
  align-items: center;
  gap: .625rem;
  font-size: .8125rem;
  color: var(--c-text-2);
  cursor: pointer;
  padding: .75rem 1rem;
  background: var(--c-bg);
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-border);
}

.confirm-check input { accent-color: var(--c-danger); width: 15px; height: 15px; flex-shrink: 0; }

.confirm-actions {
  display: flex;
  gap: .75rem;
  justify-content: flex-end;
}

/* ── Progress live ── */
.progress-section {
  background: var(--c-card);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: .875rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--c-border);
  background: var(--c-bg);
}

.progress-spinner {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2.5px solid var(--c-border);
  border-top-color: var(--c-danger);
  animation: spin .8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

.progress-title {
  font-size: .875rem;
  font-weight: 600;
  color: var(--c-text);
}

.progress-sub {
  font-size: .75rem;
  color: var(--c-text-3);
  margin-top: .125rem;
}

.live-list { padding: .5rem 0; }

.live-row {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .45rem 1.25rem;
  transition: background .15s;
}

.live-row.processing { background: rgba(59,130,246,.04); }
.live-row.done       { background: transparent; }
.live-row.error      { background: rgba(239,68,68,.04); }

.live-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.live-row.pending    .live-dot { background: var(--c-bg); border: 1.5px solid var(--c-border); }
.live-row.processing .live-dot { background: var(--c-primary); border: none; }
.live-row.done       .live-dot { background: var(--c-success); color: #fff; border: none; }
.live-row.error      .live-dot { background: var(--c-danger);  color: #fff; border: none; }

.live-pulse {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #fff;
  animation: pulse-ring 1s ease-in-out infinite;
}

@keyframes pulse-ring {
  0%,100% { opacity:1; transform:scale(1); }
  50%     { opacity:.6; transform:scale(1.35); }
}

.live-label {
  flex: 1;
  font-size: .8125rem;
  color: var(--c-text-2);
}

.live-row.processing .live-label { color: var(--c-text); font-weight: 500; }
.live-row.done       .live-label { color: var(--c-text-2); }

.live-count       { font-size: .75rem; color: var(--c-success); font-weight: 500; }
.live-count.empty { color: var(--c-text-3); font-weight: 400; }

/* ── Results banner ── */
.results-section { display: flex; flex-direction: column; gap: 1rem; }

.result-banner {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .875rem 1rem;
  border-radius: var(--radius);
  font-size: .875rem;
  font-weight: 500;
}

.banner-success { background: var(--c-success-lt); border: 1px solid rgba(34,197,94,.25);  color: #15803d; }
.banner-warning { background: var(--c-warning-lt); border: 1px solid rgba(245,158,11,.25); color: #92400e; }

/* ── Timeline résultats (réutilise les classes de ImportView) ── */
.result-timeline {
  background: var(--c-card);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: .875rem 1.25rem;
}

.tl-row           { display: flex; gap: 1rem; align-items: stretch; min-height: 48px; }
.tl-indicator     { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; padding-top: .2rem; }

.tl-dot {
  width: 26px; height: 26px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.tl-row.success .tl-dot { background: var(--c-success-lt); color: var(--c-success); border: 1.5px solid rgba(34,197,94,.4); }
.tl-row.error   .tl-dot { background: var(--c-danger-lt);  color: var(--c-danger);  border: 1.5px solid rgba(239,68,68,.35); }

.tl-line { width: 2px; flex: 1; background: var(--c-border); margin: .25rem 0; border-radius: 1px; }

.tl-content     { flex: 1; padding: .2rem 0 .625rem; display: flex; flex-direction: column; gap: .25rem; }
.tl-header-row  { display: flex; align-items: center; gap: .625rem; }
.tl-name        { font-size: .8125rem; font-weight: 600; color: var(--c-text); }

.tl-badge       { font-size: .6875rem; font-weight: 600; padding: .1rem .5rem; border-radius: 100px; }
.badge-success  { background: rgba(34,197,94,.12);  color: #15803d; }
.badge-error    { background: rgba(239,68,68,.12);  color: #dc2626; }

.tl-error-msg   { font-size: .75rem; color: var(--c-danger); }

/* ── Buttons ── */
.btn-danger {
  height: 38px;
  padding: 0 1.25rem;
  background: var(--c-danger);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-size: .875rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  cursor: pointer;
  transition: background .15s, box-shadow .15s;
  font-family: var(--font);
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
  box-shadow: 0 2px 10px rgba(239,68,68,.3);
}

.btn-danger:disabled { opacity: .4; cursor: not-allowed; }
</style>
