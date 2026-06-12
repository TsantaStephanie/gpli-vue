<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  getAllTicketCosts,
  fetchGlpiTicketCosts,
  computeCostReport,
  type TicketCostRecord,
  type CostSource,
} from '@/services/api/ticketCostService'
import { fetchTicketItems } from '@/services/api/ticketService'

const loading        = ref(true)
const error          = ref('')
const records        = ref<TicketCostRecord[]>([])
const glpiRecordsRaw = ref<TicketCostRecord[]>([])

const activeTab = ref<'all' | CostSource>('all')

const ITEM_TYPE_LABELS: Record<string, string> = {
  Computer:         'Ordinateur',
  Monitor:          'Écran',
  Printer:          'Imprimante',
  Phone:            'Téléphone',
  NetworkEquipment: 'Équipement réseau',
  Peripheral:       'Périphérique',
}
const TYPE_COLORS: Record<string, string> = {
  Computer:         '#6366f1',
  Monitor:          '#0ea5e9',
  Printer:          '#f59e0b',
  Phone:            '#10b981',
  NetworkEquipment: '#8b5cf6',
  Peripheral:       '#ec4899',
}
const TYPE_ICONS: Record<string, string> = {
  Computer:         'M20 3H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7v2H8v2h8v-2h-3v-2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 14H4V5h16v12z',
  Monitor:          'M21 2H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7l-2 3v1h8v-1l-2-3h7a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm0 14H3V4h18v12z',
  Printer:          'M18 3H6v4H3a1 1 0 0 0-1 1v9h4v4h12v-4h4V8a1 1 0 0 0-1-1h-3V3zm-2 16H8v-5h8v5zm2-5v1h-1v-1h1zm2 0h-1v1h1v2h-2v1H6v-1H4v-2h1v-1H4V9h16v5z',
  Phone:            'M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z',
  NetworkEquipment: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93s3.05-7.44 7-7.93v15.86zm2 0V4.07c3.94.49 7 3.85 7 7.93s-3.05 7.44-7 7.93z',
  Peripheral:       'M7 16h10V8H7v8zm2-6h6v4H9v-4zM3 4v16h18V4H3zm16 14H5V6h14v12z',
}

function typeLabel(t: string) { return ITEM_TYPE_LABELS[t] ?? t }
function typeColor(t: string) { return TYPE_COLORS[t] ?? '#64748b' }
function typeIcon(t: string)  { return TYPE_ICONS[t] ?? TYPE_ICONS.Peripheral }

const allRecords    = computed(() => [...glpiRecordsRaw.value, ...records.value])
const kanbanRecords = computed(() => records.value)

const activeRecords = computed(() =>
  activeTab.value === 'all'  ? allRecords.value :
  activeTab.value === 'glpi' ? glpiRecordsRaw.value :
                               kanbanRecords.value
)

// Rapport principal (entrées par type)
const report = computed(() => computeCostReport(activeRecords.value))

// Table ticketId → itemTypes à partir de TOUS les records (GLPI est la source la plus fiable)
const ticketItemTypes = computed(() => {
  const map = new Map<number, string[]>()
  for (const r of allRecords.value) {
    if (map.has(r.ticketId)) continue
    let types: string[] = []
    try { types = JSON.parse(r.itemTypes || '[]') } catch {}
    if (types.length) map.set(r.ticketId, types)
  }
  return map
})

// Agrège fixedCost par type pour un ensemble de records.
// Si un record n'a pas d'itemTypes, on cherche les types depuis ticketItemTypes (cross-ref GLPI).
const FALLBACK_TYPE = 'Non catégorisé'

function sumByType(recs: TicketCostRecord[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of recs) {
    let types: string[] = []
    try { types = JSON.parse(r.itemTypes || '[]') } catch {}
    if (!types.length) types = ticketItemTypes.value.get(r.ticketId) ?? []
    // Si toujours pas de types, rattacher à "Non catégorisé"
    if (!types.length) types = [FALLBACK_TYPE]
    const costPerItem = r.fixedCost / types.length
    for (const t of types) {
      map.set(t, Math.round(((map.get(t) ?? 0) + costPerItem) * 100) / 100)
    }
  }
  return map
}

// source null/undefined = ancien record kanban (avant le champ source)
const kanbanByType = computed(() => sumByType(records.value.filter(r => !r.source || r.source === 'kanban')))
const reopenByType = computed(() => sumByType(records.value.filter(r => r.source === 'reopen')))
const glpiByType   = computed(() => sumByType(glpiRecordsRaw.value))

const totalGlpi   = computed(() => glpiRecordsRaw.value.reduce((s, r) => s + r.fixedCost, 0))
const totalKanban = computed(() => kanbanRecords.value.reduce((s, r) => s + r.fixedCost, 0))
const totalAll    = computed(() => allRecords.value.reduce((s, r) => s + r.fixedCost, 0))

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}
function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function sourceLabel(s: CostSource | string) {
  if (s === 'glpi')   return 'GLPI'
  if (s === 'reopen') return 'Réouverture'
  return 'Kanban'
}
function sourceClass(s: CostSource | string) {
  if (s === 'glpi')   return 'src-glpi'
  if (s === 'reopen') return 'src-reopen'
  return 'src-kanban'
}

async function load() {
  loading.value = true
  error.value   = ''
  try {
    const [sqlite, glpi] = await Promise.allSettled([
      getAllTicketCosts(),
      fetchGlpiTicketCosts(),
    ])
    const rawSqlite      = sqlite.status === 'fulfilled' ? sqlite.value : []
    glpiRecordsRaw.value = glpi.status   === 'fulfilled' ? glpi.value   : []
    if (sqlite.status === 'rejected') error.value = 'SQLite indisponible : ' + sqlite.reason?.message
    if (glpi.status   === 'rejected') console.warn('[GLPI costs]', glpi.reason?.message)

    // Enrichir les records SQLite qui n'ont pas d'itemTypes
    // en allant chercher les actifs directement dans GLPI (Item_Ticket)
    const noTypes = rawSqlite.filter(r => {
      try { return JSON.parse(r.itemTypes || '[]').length === 0 } catch { return true }
    })
    const uniqueIds = [...new Set(noTypes.map(r => r.ticketId))]
    const typeCache = new Map<number, string[]>()
    await Promise.all(uniqueIds.map(async id => {
      try {
        const items = await fetchTicketItems(id)
        const types = (items || []).map((i: any) => i.itemtype).filter(Boolean)
        if (types.length) typeCache.set(id, types)
      } catch {}
    }))

    records.value = rawSqlite.map(r => {
      const cached = typeCache.get(r.ticketId)
      if (!cached) return r
      let existing: string[] = []
      try { existing = JSON.parse(r.itemTypes || '[]') } catch {}
      if (existing.length) return r
      return { ...r, itemTypes: JSON.stringify(cached), itemCount: cached.length }
    })
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="cost-page">

    <!-- ── En-tête ──────────────────────────────────────────────── -->
    <div class="cost-header">
      <div>
        <h1 class="cost-title">Rapport des coûts</h1>
        <p class="cost-sub">Coûts distribués par type d'actif</p>
      </div>
      <button class="btn-refresh" @click="load" :disabled="loading">
        <svg :class="{ spin: loading }" width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        Actualiser
      </button>
    </div>

    <div v-if="error" class="load-error">{{ error }}</div>

    <template v-if="loading">
      <div class="skeleton-grid">
        <div v-for="n in 3" :key="n" class="skel-card"></div>
      </div>
    </template>

    <template v-else-if="allRecords.length === 0">
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        <p>Aucun coût enregistré.</p>
        <span>Les coûts apparaissent après un import CSV ou lors de la fermeture d'un ticket Kanban.</span>
      </div>
    </template>

    <template v-else>

      <div class="tabs">
        <button
          v-for="tab in [{ key: 'all', label: 'Tous les coûts' }]"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = (tab.key as any)"
        >
          {{ tab.label }}
          <span class="tab-count">{{ allRecords.length }}</span>
        </button>
      </div>

      <div v-if="activeRecords.length === 0" class="tab-empty">
        Aucun coût pour cette source.
      </div>

      <div v-else class="type-grid">
        <div
          v-for="group in report"
          :key="group.itemType"
          class="type-card"
          :style="{ '--type-color': typeColor(group.itemType) }"
        >
          <!-- En-tête carte -->
          <div class="type-card-head">
            <div class="type-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path :d="typeIcon(group.itemType)" />
              </svg>
            </div>
            <div class="type-info">
              <span class="type-name">{{ typeLabel(group.itemType) }}</span>
              <span class="type-meta">
                {{ group.ticketCount }} ticket(s) · {{ group.entries.length }} entrée(s)
              </span>
            </div>
            <div class="type-total">{{ fmt(group.totalCost) }} Ar</div>
          </div>

          <!-- Détail des coûts par source -->
          <div class="cost-breakdown">
            <div class="breakdown-row">
              <span class="breakdown-label">Super coût</span>
              <span class="breakdown-val">{{ fmt(kanbanByType.get(group.itemType) ?? 0) }} Ar</span>
            </div>
            <div class="breakdown-row breakdown-reopen">
              <span class="breakdown-label">Coût réouverture</span>
              <span class="breakdown-val">{{ fmt(reopenByType.get(group.itemType) ?? 0) }} Ar</span>
            </div>
            <div class="breakdown-row">
              <span class="breakdown-label">Coût GLPI</span>
              <span class="breakdown-val">{{ fmt(glpiByType.get(group.itemType) ?? 0) }} Ar</span>
            </div>
          </div>

          <!-- Entrées tickets -->
          <div class="type-entries">
            <div
              v-for="entry in group.entries"
              :key="entry.recordId + '-' + entry.ticketId"
              class="entry-row"
            >
              <span class="entry-id">#{{ entry.ticketId }}</span>
              <span class="entry-title">{{ entry.ticketTitle }}</span>
              <span class="entry-source" :class="sourceClass(entry.source)">
                {{ sourceLabel(entry.source) }}
              </span>
              <span class="entry-date">{{ fmtDate(entry.date) }}</span>
              <span class="entry-cost">{{ fmt(entry.allocatedCost) }} Ar</span>
            </div>
          </div>

        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.cost-page { display: flex; flex-direction: column; gap: 1.5rem; padding-bottom: 2rem; }

.cost-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.cost-title  { font-size: 1.625rem; font-weight: 800; color: #0f172a; letter-spacing: -.03em; margin: 0; }
.cost-sub    { font-size: .875rem; color: #64748b; margin: .25rem 0 0; }
.btn-refresh {
  display: inline-flex; align-items: center; gap: .4rem;
  padding: .45rem 1rem; border: 1px solid #e2e8f0; border-radius: 8px;
  background: #fff; font-size: .8125rem; font-weight: 500; color: #475569;
  cursor: pointer; transition: background .15s;
}
.btn-refresh:hover    { background: #f8fafc; }
.btn-refresh:disabled { opacity: .5; cursor: not-allowed; }
.spin { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.load-error { padding: .875rem 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; font-size: .875rem; color: #dc2626; }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: .75rem; padding: 4rem 2rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; text-align: center; }
.empty-state p    { margin: 0; font-weight: 600; color: #334155; }
.empty-state span { font-size: .875rem; color: #94a3b8; }

.skeleton-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.skel-card { height: 120px; background: #f1f5f9; border-radius: 14px; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

.tabs { display: flex; gap: .5rem; flex-wrap: wrap; }
.tab-btn {
  display: inline-flex; align-items: center; gap: .4rem;
  padding: .45rem 1rem; border: 1px solid #e2e8f0; border-radius: 8px;
  background: #fff; font-size: .8125rem; font-weight: 500; color: #64748b;
  cursor: pointer; transition: all .15s;
}
.tab-btn:hover  { background: #f8fafc; border-color: #cbd5e1; }
.tab-btn.active { background: #0f172a; border-color: #0f172a; color: #fff; }
.tab-count { font-size: .6875rem; font-weight: 700; background: #f1f5f9; color: #64748b; padding: .1rem .45rem; border-radius: 10px; }
.tab-btn.active .tab-count { background: #ffffff22; color: #fff; }

.tab-empty { padding: 2rem; text-align: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; font-size: .875rem; color: #94a3b8; }

.type-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1rem; }

.type-card { background: #fff; border: 1px solid #e2e8f0; border-top: 3px solid var(--type-color, #64748b); border-radius: 14px; overflow: hidden; }

.type-card-head { display: flex; align-items: center; gap: .875rem; padding: 1.125rem 1.25rem; border-bottom: 1px solid #f1f5f9; }
.type-icon-wrap { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--type-color, #64748b) 12%, transparent); color: var(--type-color, #64748b); flex-shrink: 0; }
.type-info  { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .15rem; }
.type-name  { font-size: .9375rem; font-weight: 700; color: #0f172a; }
.type-meta  { font-size: .75rem; color: #94a3b8; }

.type-total  { font-size: 1.125rem; font-weight: 800; color: var(--type-color, #64748b); white-space: nowrap; flex-shrink: 0; }

.cost-breakdown { border-bottom: 1px solid #f1f5f9; padding: .4rem 1.25rem; background: #fafafa; }
.breakdown-row  { display: flex; justify-content: space-between; align-items: center; padding: .2rem 0; font-size: .78rem; }
.breakdown-label { color: #64748b; }
.breakdown-val   { font-weight: 600; color: #334155; }
.breakdown-reopen .breakdown-label { color: #b45309; font-weight: 600; }
.breakdown-reopen .breakdown-val   { color: #b45309; }

.type-entries { padding: .5rem 0; }
.entry-row {
  display: grid;
  grid-template-columns: 3rem 1fr auto auto auto;
  align-items: center;
  gap: .5rem .75rem;
  padding: .5rem 1.25rem;
  font-size: .8125rem;
  border-bottom: 1px solid #f8fafc;
  transition: background .1s;
}
.entry-row:last-child { border-bottom: none; }
.entry-row:hover      { background: #f8fafc; }

.entry-id    { font-family: monospace; font-size: .75rem; color: #94a3b8; }
.entry-title { color: #334155; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.entry-source { font-size: .6rem; font-weight: 700; padding: .15rem .45rem; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
.src-glpi   { background: #fef9c3; color: #92400e; }
.src-kanban { background: #ede9fe; color: #4c1d95; }
.src-reopen { background: #fef3c7; color: #b45309; }
.entry-date  { color: #94a3b8; font-size: .75rem; white-space: nowrap; }
.entry-cost  { font-weight: 700; color: var(--type-color, #0f172a); white-space: nowrap; }

@media (max-width: 768px) {
  .type-grid { grid-template-columns: 1fr; }
  .entry-row { grid-template-columns: 2.5rem 1fr auto auto; }
  .entry-date { display: none; }
}
</style>
