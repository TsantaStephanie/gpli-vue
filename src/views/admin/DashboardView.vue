<template>
  <div class="dashboard">

    <!-- ─── Header ──────────────────────────────────────────────────────────── -->
    <div class="dash-header animate-in">
      <div>
        <h1 class="dash-title">Tableau de bord</h1>
        <p class="dash-subtitle">{{ dateLabel }}</p>
      </div>
      <button class="btn-primary" @click="refreshAll" :disabled="loading">
        <svg v-if="loading" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        {{ loading ? 'Chargement...' : 'Actualiser' }}
      </button>
    </div>

    <!-- ─── Erreur API ───────────────────────────────────────────────────────── -->
    <div v-if="apiError" class="error-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>{{ apiError }}</span>
    </div>

    <!-- ─── KPI Cards ────────────────────────────────────────────────────────── -->
    <div class="kpi-grid">
      <div
        v-for="(card, i) in kpiCards"
        :key="card.label"
        class="kpi-card animate-in"
        :style="{ animationDelay: `${i * 60}ms` }"
        :class="card.colorClass"
        @click="$router.push(card.route)"
      >
        <!-- Décor de fond -->
        <div class="kpi-bg-circle" />

        <div class="kpi-header">
          <div class="kpi-icon-wrap"><span v-html="card.icon" /></div>
          <span class="kpi-label">{{ card.label }}</span>
        </div>

        <div class="kpi-value">
          <span v-if="loading" class="skeleton-val skeleton-dark" />
          <span v-else>{{ card.value.toLocaleString('fr-FR') }}<small v-if="card.unit" class="kpi-unit">{{ card.unit }}</small></span>
        </div>

        <div class="kpi-sub">
          <span v-if="loading" class="skeleton-sm skeleton-dark" />
          <span v-else>{{ card.sub }}</span>
        </div>

        <div class="kpi-bar">
          <div class="kpi-bar-fill" :style="{ width: (loading ? 0 : card.fillPct) + '%' }" />
        </div>
      </div>
    </div>

    <!-- ─── Row 2 ─────────────────────────────────────────────────────────────── -->
    <div class="dash-row">

      <!-- Répartition des incidents -->
      <section class="card animate-in" style="animation-delay:240ms">
        <div class="card-header">
          <h3>Répartition des incidents</h3>
          <RouterLink to="/tickets" class="card-link">Voir tout →</RouterLink>
        </div>

        <div class="distrib-section">
          <p class="distrib-label">Par statut</p>
          <div class="distrib-list">
            <div v-for="s in statusDistrib" :key="s.label" class="distrib-row">
              <span class="distrib-dot" :style="{ background: s.color }" />
              <span class="distrib-name">{{ s.label }}</span>
              <div class="distrib-track">
                <div class="distrib-fill" :style="{ width: (loading ? 0 : s.pct) + '%', background: s.color }" />
              </div>
              <span class="distrib-count">
                <span v-if="loading" class="skeleton-sm" />
                <span v-else>{{ s.count }}</span>
              </span>
            </div>
          </div>
        </div>

        <div class="distrib-section" style="margin-top: 18px">
          <p class="distrib-label">Par priorité</p>
          <div class="distrib-list">
            <div v-for="p in priorityDistrib" :key="p.label" class="distrib-row">
              <span class="distrib-dot" :style="{ background: p.color }" />
              <span class="distrib-name">{{ p.label }}</span>
              <div class="distrib-track">
                <div class="distrib-fill" :style="{ width: (loading ? 0 : p.pct) + '%', background: p.color }" />
              </div>
              <span class="distrib-count">
                <span v-if="loading" class="skeleton-sm" />
                <span v-else>{{ p.count }}</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Incidents récents -->
      <section class="card animate-in" style="animation-delay:300ms">
        <div class="card-header">
          <h3>Incidents récents</h3>
          <RouterLink to="/tickets" class="card-link">Voir tout →</RouterLink>
        </div>
        <div class="ticket-list">
          <div v-if="loading" class="ticket-loading">
            <div v-for="n in 5" :key="n" class="skeleton-row" />
          </div>
          <template v-else>
            <div v-for="t in recentTickets" :key="t.id" class="ticket-row">
              <div class="ticket-prio-dot" :class="prioClass(t.priority)" />
              <div class="ticket-info">
                <div class="ticket-title">{{ t.title }}</div>
                <div class="ticket-meta">#{{ t.id }} · {{ formatDate(t.createdAt) }}</div>
              </div>
              <span class="badge" :class="statusBadgeClass(t.status)">{{ t.statusLabel }}</span>
            </div>
            <div v-if="recentTickets.length === 0" class="empty-state">
              Aucun incident trouvé
            </div>
          </template>
        </div>
      </section>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  fetchAllComputers, fetchAllMonitors, fetchAllPrinters,
  fetchAllTickets,
  fetchAllUsers,
} from '@/services/api'
import type { Ticket } from '@/models/Ticket'

const loading  = ref(false)
const apiError = ref('')

const dateLabel = computed(() =>
  new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)

/* ─── KPI (alimentés par l'API) ───────────────────────────────────────────── */
const kpiCards = ref([
  {
    label: 'Actifs totaux',      value: 0, unit: '',  sub: '—',
    fillPct: 0, route: '/assets', colorClass: 'blue',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  },
  {
    label: 'Incidents ouverts',  value: 0, unit: '',  sub: '—',
    fillPct: 0, route: '/tickets', colorClass: 'orange',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2H9"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>`,
  },
  {
    label: 'Utilisateurs',       value: 0, unit: '',  sub: '—',
    fillPct: 0, route: '/users', colorClass: 'purple',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  },
  {
    label: 'Taux de résolution', value: 0, unit: '%', sub: '—',
    fillPct: 0, route: '/tickets', colorClass: 'cyan',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="20 6 9 17 4 12"/></svg>`,
  },
])

/* ─── Distributions (alimentées par l'API) ───────────────────────────────── */
const statusDistrib = ref([
  { label: 'Nouveau',    count: 0, pct: 0, color: '#3b82f6' },
  { label: 'En cours',   count: 0, pct: 0, color: '#f97316' },
  { label: 'En attente', count: 0, pct: 0, color: '#a855f7' },
  { label: 'Résolu',     count: 0, pct: 0, color: '#22c55e' },
])

const priorityDistrib = ref([
  { label: 'Haute',   count: 0, pct: 0, color: '#ef4444' },
  { label: 'Moyenne', count: 0, pct: 0, color: '#f97316' },
  { label: 'Basse',   count: 0, pct: 0, color: '#6b7280' },
])

/* ─── Tickets récents ─────────────────────────────────────────────────────── */
const recentTickets = ref<Ticket[]>([])

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function prioClass(p: number) {
  if (p >= 4) return 'prio-high'
  if (p === 3) return 'prio-medium'
  return 'prio-low'
}

function statusBadgeClass(s: number) {
  if (s === 1) return 'badge-blue'
  if (s === 2 || s === 3) return 'badge-orange'
  if (s === 5 || s === 6) return 'badge-green'
  return 'badge-gray'
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffH = Math.floor((now.getTime() - d.getTime()) / 3_600_000)
  if (diffH < 1)  return 'Il y a moins d\'1h'
  if (diffH < 24) return `Il y a ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'Hier'
  if (diffD < 7)  return `Il y a ${diffD} jours`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/* ─── Fetch API ───────────────────────────────────────────────────────────── */
async function refreshAll() {
  loading.value  = true
  apiError.value = ''

  try {
    const [computers, monitors, printers, allTickets, users] = await Promise.all([
      fetchAllComputers(),
      fetchAllMonitors(),
      fetchAllPrinters(),
      fetchAllTickets(),
      fetchAllUsers({ isActive: true }),
    ])

    /* ── Actifs ── */
    const totalAssets = computers.length + monitors.length + printers.length
    kpiCards.value[0].value   = totalAssets
    kpiCards.value[0].sub     = `${computers.length} PC · ${monitors.length} écrans · ${printers.length} imprimantes`
    kpiCards.value[0].fillPct = Math.min(100, Math.round(totalAssets / 3))

    /* ── Tickets ── */
    const nonDeleted  = allTickets.filter(t => !t.isDeleted)
    const openList    = nonDeleted.filter(t => t.status !== 5 && t.status !== 6)
    const resolvedCnt = nonDeleted.filter(t => t.status === 5 || t.status === 6).length
    const rate        = nonDeleted.length ? Math.round(resolvedCnt / nonDeleted.length * 100) : 0

    kpiCards.value[1].value   = openList.length
    kpiCards.value[1].sub     = `${openList.filter(t => t.priority >= 4).length} haute priorité · ${nonDeleted.length} total`
    kpiCards.value[1].fillPct = nonDeleted.length ? Math.round(openList.length / nonDeleted.length * 100) : 0

    kpiCards.value[3].value   = rate
    kpiCards.value[3].sub     = `${resolvedCnt} incidents clôturés sur ${nonDeleted.length}`
    kpiCards.value[3].fillPct = rate

    /* ── Utilisateurs ── */
    kpiCards.value[2].value   = users.length
    kpiCards.value[2].sub     = `${users.length} compte${users.length > 1 ? 's' : ''} actif${users.length > 1 ? 's' : ''}`
    kpiCards.value[2].fillPct = Math.min(100, users.length)

    /* ── Distribution par statut ── */
    const sMap: Record<number, number> = { 1: 0, 2: 0, 4: 0, 5: 0 }
    nonDeleted.forEach(t => {
      const key = t.status === 3 ? 2 : t.status  // planifié → en cours
      if (key in sMap) sMap[key]++
    })
    const sMax = Math.max(...Object.values(sMap), 1)
    statusDistrib.value[0].count = sMap[1]; statusDistrib.value[0].pct = Math.round(sMap[1] / sMax * 100)
    statusDistrib.value[1].count = sMap[2]; statusDistrib.value[1].pct = Math.round(sMap[2] / sMax * 100)
    statusDistrib.value[2].count = sMap[4]; statusDistrib.value[2].pct = Math.round(sMap[4] / sMax * 100)
    statusDistrib.value[3].count = sMap[5]; statusDistrib.value[3].pct = Math.round(sMap[5] / sMax * 100)

    /* ── Distribution par priorité (incidents ouverts uniquement) ── */
    const pHigh   = openList.filter(t => t.priority >= 4).length
    const pMedium = openList.filter(t => t.priority === 3).length
    const pLow    = openList.filter(t => t.priority <= 2).length
    const pMax    = Math.max(pHigh, pMedium, pLow, 1)
    priorityDistrib.value[0].count = pHigh;   priorityDistrib.value[0].pct = Math.round(pHigh   / pMax * 100)
    priorityDistrib.value[1].count = pMedium; priorityDistrib.value[1].pct = Math.round(pMedium / pMax * 100)
    priorityDistrib.value[2].count = pLow;    priorityDistrib.value[2].pct = Math.round(pLow    / pMax * 100)

    /* ── Tickets récents (5 derniers par date de création) ── */
    recentTickets.value = [...nonDeleted]
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 5)

  } catch (e: unknown) {
    apiError.value = e instanceof Error ? e.message : 'Erreur lors du chargement des données'
  } finally {
    loading.value = false
  }
}


onMounted(refreshAll)
</script>

<style scoped>
@import '../../styles/DashboardView.css';
</style>
