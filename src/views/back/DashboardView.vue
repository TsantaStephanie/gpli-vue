<template>
  <div class="dashboard animate-in">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="dash-header">
      <div>
        <h1 class="dash-title">Tableau de bord</h1>
        <p class="dash-subtitle">Vue d'ensemble de l'infrastructure GLPI</p>
      </div>
      <button class="btn-refresh" @click="refreshAll" :disabled="loading">
        <svg :class="{ 'spin-icon': loading }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        {{ loading ? 'Chargement…' : 'Actualiser' }}
      </button>
    </div>

    <!-- ── Bento grid ──────────────────────────────────────────── -->
    <div class="bento">

      <!-- ── Metric tiles (row 1) ─────────────────────────────── -->
      <div class="bento-card b-metric b-blue">
        <div class="metric-content">
          <div>
            <p class="metric-lbl">Actifs total</p>
            <p class="metric-val">{{ stats?.assets.total ?? '—' }}</p>
            <p class="metric-hint">Parc informatique</p>
          </div>
          <div class="metric-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
        </div>
      </div>

      <div class="bento-card b-metric b-orange">
        <div class="metric-content">
          <div>
            <p class="metric-lbl">Tickets total</p>
            <p class="metric-val">{{ stats?.tickets.total ?? '—' }}</p>
            <p class="metric-hint">Tous statuts</p>
          </div>
          <div class="metric-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
          </div>
        </div>
      </div>

      <div class="bento-card b-metric b-red">
        <div class="metric-content">
          <div>
            <p class="metric-lbl">Tickets ouverts</p>
            <p class="metric-val">{{ stats?.tickets.openCount ?? '—' }}</p>
            <p class="metric-hint">En cours de traitement</p>
          </div>
          <div class="metric-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
        </div>
      </div>

      <div class="bento-card b-metric b-green">
        <div class="metric-content">
          <div>
            <p class="metric-lbl">Tickets résolus</p>
            <p class="metric-val">{{ stats?.tickets.byStatus[5] ?? '—' }}</p>
            <p class="metric-hint">Statut résolu</p>
          </div>
          <div class="metric-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
      </div>

      <!-- ── Asset types bar chart (2 cols × 2 rows) ─────────── -->
      <div class="bento-card b-types">
        <div class="bcard-head">
          <h3>Parc par type</h3>
          <span class="bcard-pill blue">{{ stats?.assets.total ?? 0 }} éléments</span>
        </div>
        <div v-if="loading" class="bcard-loading"><div class="spinner"></div></div>
        <div v-else-if="stats" class="bar-list">
          <div v-for="(count, type) in sortedAssetTypes" :key="type" class="bar-row">
            <span class="bar-lbl">{{ getAssetTypeLabel(String(type)) }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :class="'bar-' + getTypeColorKey(String(type))"
                :style="{ width: pct(Number(count), stats.assets.total) + '%' }"
              ></div>
            </div>
            <span class="bar-meta">
              <strong>{{ count }}</strong>
              <em>{{ pct(Number(count), stats.assets.total) }}%</em>
            </span>
          </div>
        </div>

        <div class="bcard-divider"></div>

        <div class="bcard-head">
          <h3>Statut du parc</h3>
        </div>
        <div v-if="stats" class="spill-list">
          <template v-for="(count, status) in sortedAssetStatuses" :key="status">
            <div v-if="Number(count) > 0" class="spill" :class="'spill-' + getAssetStatusKey(String(status))">
              <span class="spill-num">{{ count }}</span>
              <span class="spill-lbl">{{ getAssetStatusLabel(String(status)) }}</span>
            </div>
          </template>
        </div>
      </div>

      <!-- ── Ticket pipeline (1 col) ──────────────────────────── -->
      <div class="bento-card b-pipeline">
        <div class="bcard-head">
          <h3>Pipeline tickets</h3>
        </div>
        <div v-if="stats" class="pipeline">
          <template v-for="sid in [1,2,3,4,5,6]" :key="sid">
            <div v-if="(stats.tickets.byStatus[sid] || 0) > 0" class="pipe-row" :class="'pipe-' + sid">
              <span class="pipe-dot"></span>
              <span class="pipe-lbl">{{ getStatusLabel(sid) }}</span>
              <div class="pipe-track">
                <div class="pipe-fill" :style="{ width: pct(stats.tickets.byStatus[sid] || 0, stats.tickets.total) + '%' }"></div>
              </div>
              <span class="pipe-num">{{ stats.tickets.byStatus[sid] || 0 }}</span>
            </div>
          </template>
        </div>
        <div v-else class="bcard-loading"><div class="spinner"></div></div>
      </div>

      <!-- ── Ticket type + donut (1 col) ──────────────────────── -->
      <div class="bento-card b-tktypes">
        <div class="bcard-head"><h3>Types tickets</h3></div>
        <div class="type-split">
          <div class="type-block type-red">
            <span class="type-num">{{ stats?.tickets.byType[1] ?? 0 }}</span>
            <span class="type-lbl">Incidents</span>
          </div>
          <div class="type-sep"></div>
          <div class="type-block type-blue">
            <span class="type-num">{{ stats?.tickets.byType[2] ?? 0 }}</span>
            <span class="type-lbl">Demandes</span>
          </div>
        </div>
        <!-- <div class="bcard-divider"></div>
        <div class="bcard-head"><h3>Tickets ouverts</h3></div> -->
        <!-- <div class="ratio-wrap">
          <div
            class="ratio-ring"
            :style="{ '--pct': pct(stats?.tickets.openCount ?? 0, stats?.tickets.total) }"
          >
            <div class="ratio-inner">
              <span class="ratio-num">{{ pct(stats?.tickets.openCount ?? 0, stats?.tickets.total) }}<span class="ratio-unit">%</span></span>
              <span class="ratio-sub">ouverts</span>
            </div>
          </div>
          <div class="ratio-legend">
            <p><strong>{{ stats?.tickets.openCount ?? 0 }}</strong> ouverts</p>
            <p class="muted">{{ (stats?.tickets.total ?? 0) - (stats?.tickets.openCount ?? 0) }} fermés/résolus</p>
          </div>
        </div> -->
      </div>

       <div class="bento-card b-feed">
        <div class="bcard-head">
          <h3>Derniers tickets créés</h3>
          <span class="bcard-pill gray">{{ recentTickets.length }} résultats</span>
        </div>
        <div v-if="loadingTickets" class="bcard-loading"><div class="spinner"></div></div>
        <div v-else-if="recentTickets.length" class="feed">
          <div v-for="ticket in recentTickets" :key="ticket.id" class="feed-row">
            <span class="feed-tag" :class="ticket.type === 1 ? 'badge-red' : 'badge-blue'">
              {{ ticket.type === 1 ? 'INC' : 'DEM' }}
            </span>
            <span class="feed-name">#{{ ticket.id }} {{ ticket.title }}</span>
            <span class="feed-status" :class="getTicketStatusClass(ticket.status)">{{ ticket.statusLabel }}</span>
          </div>
        </div>
        <div v-else class="bcard-empty">Aucun ticket</div>
      </div>

      <!-- ── Recent assets feed (2 cols) ─────────────────────── -->
      <div class="bento-card b-feed">
        <div class="bcard-head">
          <h3>Derniers actifs ajoutés</h3>
          <span class="bcard-pill gray">{{ recentAssets.length }} résultats</span>
        </div>
        <div v-if="loadingAssets" class="bcard-loading"><div class="spinner"></div></div>
        <div v-else-if="recentAssets.length" class="feed">
          <div v-for="asset in recentAssets" :key="asset.id" class="feed-row">
            <span class="feed-tag" :class="getAssetBadgeClass(asset.type)">
              {{ getTypeShort(asset.type) }}
            </span>
            <span class="feed-name">#{{ asset.id }} &mdash; {{ asset.name }}</span>
            <span class="feed-status" :class="getAssetStatusBadgeClass(asset.status)">{{ asset.status }}</span>
          </div>
        </div>
        <div v-else class="bcard-empty">Aucun actif</div>
      </div>

      <!-- ── Recent tickets feed (2 cols) ────────────────────── -->
     

    </div>

    <!-- ── Error banner ────────────────────────────────────────── -->
    <div class="api-banner animate-in" v-if="apiError">
      <div class="api-banner-content">
        <div class="api-banner-title">⚠ Erreur de connexion</div>
        <div class="api-banner-msg">{{ apiError }}</div>
      </div>
      <button class="btn-outline-sm" @click="refreshAll">Réessayer</button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getDashboardStats, TICKET_STATUS_LABELS, ASSET_TYPE_LABELS, type DashboardStats } from '@/services/api/dashboardService'
import { fetchAllTickets } from '@/services/api/ticketService'
import { fetchAllAssets, getAssetStatusById } from '@/services/api/assetService'

const loading      = ref(false)
const loadingAssets  = ref(false)
const loadingTickets = ref(false)
const apiError     = ref('')
const stats        = ref<DashboardStats | null>(null)
const recentAssets  = ref<any[]>([])
const recentTickets = ref<any[]>([])

// ── Computed ────────────────────────────────────────────────────
const sortedAssetTypes = computed(() => {
  if (!stats.value) return {}
  const entries = Object.entries(stats.value.assets.byType)
  entries.sort((a, b) => Number(b[1]) - Number(a[1]))
  return Object.fromEntries(entries)
})

const sortedAssetStatuses = computed(() => {
  if (!stats.value) return {}
  const order = ['En production', 'En stock', 'En maintenance', 'En panne', 'Réformé']
  const entries = Object.entries(stats.value.assets.byStatus)
  entries.sort((a, b) => {
    const ia = order.indexOf(a[0]), ib = order.indexOf(b[0])
    if (ia === -1 && ib === -1) return a[0].localeCompare(b[0])
    if (ia === -1) return 1; if (ib === -1) return -1
    return ia - ib
  })
  return Object.fromEntries(entries)
})

// ── Helpers ─────────────────────────────────────────────────────
function pct(count: number, total: number | undefined): number {
  if (!total) return 0
  return Math.round((count / total) * 100)
}

function getAssetTypeLabel(type: string): string  { return ASSET_TYPE_LABELS[type] || type }
function getStatusLabel(sid: number): string       { return TICKET_STATUS_LABELS[sid] || 'Inconnu' }

function getTypeColorKey(type: string): string {
  return ({ Computer:'blue', Monitor:'green', Printer:'orange', Phone:'purple', NetworkEquipment:'cyan' })[type] || 'gray'
}

function getTypeShort(type: string): string {
  return ({ Computer:'PC', Monitor:'MON', Printer:'IMP', Phone:'TÉL', NetworkEquipment:'NET' })[type] || type.slice(0,3).toUpperCase()
}

function getAssetStatusKey(status: string): string {
  return ({ 'En production':'green','En stock':'yellow','En maintenance':'orange','En panne':'red','Réformé':'gray' })[status] || 'gray'
}

function getAssetStatusLabel(s: string): string    { return s }
function getAssetBadgeClass(type: string): string  {
  return ({ Computer:'badge-blue', Monitor:'badge-green', Printer:'badge-orange', Phone:'badge-purple', NetworkEquipment:'badge-cyan' })[type] || 'badge-gray'
}
function getAssetStatusBadgeClass(s: string): string {
  return ({ 'En production':'status-production','En stock':'status-stock','En maintenance':'status-maintenance','En panne':'status-panne','Réformé':'status-reformed' })[s] || 'status-default'
}
function getTicketStatusClass(status: number): string {
  return ({ 1:'status-new',2:'status-progress',3:'status-planned',4:'status-pending',5:'status-solved',6:'status-closed' })[status] || 'status-default'
}
function getPriorityLabel(priority: number): string {
  return ({ 1:'Très basse',2:'Basse',3:'Moyenne',4:'Haute',5:'Très haute',6:'Majeure' })[priority] || 'Moyenne'
}

// ── Data loading ─────────────────────────────────────────────────
async function refreshAll() {
  loading.value = true; apiError.value = ''
  loadingAssets.value = true; loadingTickets.value = true
  try {
    stats.value = await getDashboardStats()

    const allAssets = await fetchAllAssets()
    const assetsWithStatus = await Promise.all(
      allAssets.map(async (a) => ({ ...a, status: await getAssetStatusById(a.itemtype, a.id) }))
    )
    recentAssets.value = assetsWithStatus
      .sort((a, b) => (b.id||0) - (a.id||0))
      .slice(0, 10)
      .map(a => ({ id: a.id, name: a.name, type: a.itemtype, status: a.status }))

    const allTickets = await fetchAllTickets()
    recentTickets.value = allTickets
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(t => ({
        id: t.id, title: t.title, type: t.type, status: t.status,
        statusLabel: getStatusLabel(t.status),
        priority: t.priority, priorityLabel: getPriorityLabel(t.priority),
        date: new Date(t.createdAt).toLocaleDateString('fr-FR')
      }))
  } catch (e: any) {
    apiError.value = e.message || 'Erreur de connexion à GLPI'
  } finally {
    loading.value = false; loadingAssets.value = false; loadingTickets.value = false
  }
}

onMounted(refreshAll)
</script>

<style scoped>
@import '@/styles/tsanta/DashboardView.css';
</style>
