<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAllTicketCosts, computeCostReport, type TicketCostRecord } from '@/services/api/ticketCostService'

const loading = ref(true)
const error   = ref('')
const records = ref<TicketCostRecord[]>([])

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

function typeLabel(t: string)  { return ITEM_TYPE_LABELS[t] ?? t }
function typeColor(t: string)  { return TYPE_COLORS[t] ?? '#64748b' }

const report   = computed(() => computeCostReport(records.value))
const totalCost = computed(() => records.value.reduce((s, r) => s + r.fixedCost, 0))
const maxCost   = computed(() => Math.max(...report.value.map(r => r.totalCost), 1))

function pct(val: number) { return Math.round((val / maxCost.value) * 100) }

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function load() {
  loading.value = true
  error.value   = ''
  try {
    records.value = await getAllTicketCosts()
  } catch (e: any) {
    error.value = e.message || 'Impossible de charger les données.'
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
        <p class="cost-sub">Coûts par type d'actif — divisés proportionnellement</p>
      </div>
      <button class="btn-refresh" @click="load" :disabled="loading">
        <svg :class="{ spin: loading }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        Actualiser
      </button>
    </div>

    <!-- ── Erreur ─────────────────────────────────────────────────── -->
    <div v-if="error" class="load-error">{{ error }}</div>

    <!-- ── Skeleton ─────────────────────────────────────────────── -->
    <template v-if="loading">
      <div class="skeleton-grid">
        <div v-for="n in 3" :key="n" class="skel-card"></div>
      </div>
    </template>

    <template v-else-if="records.length === 0">
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
        <p>Aucun coût enregistré pour le moment.</p>
        <span>Les coûts apparaissent quand vous fermez un ticket dans le Kanban.</span>
      </div>
    </template>

    <template v-else>

      <!-- ── Métriques globales ─────────────────────────────────── -->
      <div class="metrics-row">
        <div class="metric-card">
          <p class="metric-label">Coût total</p>
          <p class="metric-val">{{ fmt(totalCost) }} <span class="metric-unit">Ar</span></p>
          <p class="metric-hint">{{ records.length }} ticket(s) clôturé(s)</p>
        </div>
        <div class="metric-card">
          <p class="metric-label">Types d'actifs</p>
          <p class="metric-val">{{ report.length }}</p>
          <p class="metric-hint">catégories concernées</p>
        </div>
        <div class="metric-card">
          <p class="metric-label">Coût moyen / ticket</p>
          <p class="metric-val">{{ fmt(totalCost / records.length) }} <span class="metric-unit">Ar</span></p>
          <p class="metric-hint">par clôture</p>
        </div>
      </div>

      <!-- ── Barres par type d'item ─────────────────────────────── -->
      <div class="section-card">
        <div class="section-head">
          <h2>Coût par type d'actif</h2>
          <span class="pill">{{ report.length }} types</span>
        </div>
        <div class="bar-list">
          <div v-for="row in report" :key="row.itemType" class="bar-row">
            <div class="bar-meta-left">
              <span class="type-dot" :style="{ background: typeColor(row.itemType) }"></span>
              <span class="type-name">{{ typeLabel(row.itemType) }}</span>
              <span class="ticket-badge">{{ row.ticketCount }} ticket(s)</span>
            </div>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ width: pct(row.totalCost) + '%', background: typeColor(row.itemType) }"
              ></div>
            </div>
            <span class="bar-amount">{{ fmt(row.totalCost) }} Ar</span>
          </div>
        </div>
      </div>

      <!-- ── Tableau détaillé ───────────────────────────────────── -->
      <div class="section-card">
        <div class="section-head">
          <h2>Détail des tickets</h2>
          <span class="pill">{{ records.length }} entrées</span>
        </div>
        <div class="table-wrap">
          <table class="cost-table">
            <thead>
              <tr>
                <th>#Ticket</th>
                <th>Titre</th>
                <th>Actifs liés</th>
                <th>Types</th>
                <th>Coût fixe</th>
                <th>Coût / actif</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in records" :key="r.id">
                <td class="cell-id">#{{ r.ticketId }}</td>
                <td class="cell-title">{{ r.ticketTitle }}</td>
                <td class="cell-center">{{ r.itemCount }}</td>
                <td>
                  <div class="type-chips">
                    <template v-for="(t, i) in (JSON.parse(r.itemTypes || '[]') as string[])" :key="i">
                      <span
                        class="type-chip"
                        :style="{ background: typeColor(t) + '18', color: typeColor(t), borderColor: typeColor(t) + '40' }"
                      >{{ typeLabel(t) }}</span>
                    </template>
                  </div>
                </td>
                <td class="cell-cost">{{ fmt(r.fixedCost) }} Ar</td>
                <td class="cell-cost-per">
                  {{ r.itemCount > 1 ? fmt(r.fixedCost / r.itemCount) + ' Ar' : '—' }}
                </td>
                <td class="cell-date">{{ fmtDate(r.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </template>

  </div>
</template>

<style scoped>
.cost-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 2rem;
}

/* ── Header ─────────────────────────────────────────────────── */
.cost-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.cost-title {
  font-size: 1.625rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -.03em;
  margin: 0;
}
.cost-sub {
  font-size: .875rem;
  color: #64748b;
  margin: .25rem 0 0;
}
.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: .45rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  font-size: .8125rem;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: background .15s;
}
.btn-refresh:hover { background: #f8fafc; }
.btn-refresh:disabled { opacity: .5; cursor: not-allowed; }
.spin { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Erreur / vide ──────────────────────────────────────────── */
.load-error {
  padding: .875rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  font-size: .875rem;
  color: #dc2626;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .75rem;
  padding: 4rem 2rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  text-align: center;
}
.empty-state p { margin: 0; font-weight: 600; color: #334155; }
.empty-state span { font-size: .875rem; color: #94a3b8; }

/* ── Skeletons ─────────────────────────────────────────────── */
.skeleton-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.skel-card { height: 100px; background: #f1f5f9; border-radius: 14px; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

/* ── Métriques ─────────────────────────────────────────────── */
.metrics-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
.metric-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.25rem 1.5rem;
}
.metric-label { font-size: .75rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 .25rem; }
.metric-val { font-size: 1.75rem; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -.02em; }
.metric-unit { font-size: 1rem; font-weight: 600; color: #64748b; }
.metric-hint { font-size: .75rem; color: #94a3b8; margin: .25rem 0 0; }

/* ── Section card ──────────────────────────────────────────── */
.section-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.5rem;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}
.section-head h2 { font-size: 1rem; font-weight: 700; color: #0f172a; margin: 0; }
.pill {
  font-size: .6875rem;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 20px;
  padding: .2rem .625rem;
}

/* ── Barres ─────────────────────────────────────────────────── */
.bar-list { display: flex; flex-direction: column; gap: .875rem; }
.bar-row { display: grid; grid-template-columns: 200px 1fr 130px; align-items: center; gap: 1rem; }
.bar-meta-left { display: flex; align-items: center; gap: .5rem; min-width: 0; }
.type-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.type-name { font-size: .875rem; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ticket-badge { font-size: .6875rem; color: #94a3b8; white-space: nowrap; flex-shrink: 0; }
.bar-track { background: #f1f5f9; border-radius: 100px; height: 10px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 100px; transition: width .4s ease; }
.bar-amount { font-size: .875rem; font-weight: 700; color: #1e293b; text-align: right; white-space: nowrap; }

/* ── Tableau ─────────────────────────────────────────────────── */
.table-wrap { overflow-x: auto; }
.cost-table { width: 100%; border-collapse: collapse; font-size: .8125rem; }
.cost-table th {
  text-align: left;
  padding: .625rem .875rem;
  font-size: .6875rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: .06em;
  border-bottom: 2px solid #f1f5f9;
  white-space: nowrap;
}
.cost-table td {
  padding: .75rem .875rem;
  border-bottom: 1px solid #f8fafc;
  color: #334155;
  vertical-align: middle;
}
.cost-table tbody tr:hover { background: #f8fafc; }
.cell-id { font-family: monospace; color: #94a3b8; font-size: .75rem; }
.cell-title { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.cell-center { text-align: center; color: #64748b; }
.cell-cost { font-weight: 700; color: #0f172a; white-space: nowrap; }
.cell-cost-per { color: #64748b; font-size: .75rem; white-space: nowrap; }
.cell-date { color: #94a3b8; white-space: nowrap; font-size: .75rem; }

.type-chips { display: flex; flex-wrap: wrap; gap: .25rem; }
.type-chip {
  display: inline-block;
  font-size: .6875rem;
  font-weight: 600;
  padding: .15rem .5rem;
  border-radius: 20px;
  border: 1px solid transparent;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .metrics-row { grid-template-columns: 1fr; }
  .bar-row { grid-template-columns: 1fr; gap: .5rem; }
  .bar-amount { text-align: left; }
}
</style>
