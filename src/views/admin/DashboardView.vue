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
    <div v-if="apiError" class="error-banner animate-in">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {{ apiError }}
    </div>

    <!-- ─── Les 2 cartes ─────────────────────────────────────────────────────── -->
    <div class="dash-cards animate-in">

      <!-- Carte 1 : Éléments du parc -->
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-icon icon-blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div>
            <h2 class="stat-card-title">Éléments du parc</h2>
            <p class="stat-card-sub">Total des équipements inventoriés</p>
          </div>
        </div>

        <div class="stat-total">
          <span v-if="loading" class="skeleton-total" />
          <span v-else>{{ totalAssets.toLocaleString('fr-FR') }}</span>
          <span class="stat-total-label">éléments</span>
        </div>

        <div class="stat-divider" />

        <div class="stat-rows">
          <div v-for="row in assetRows" :key="row.label" class="stat-row">
            <div class="stat-row-left">
              <span class="stat-row-dot" :style="{ background: row.color }" />
              <span class="stat-row-label">{{ row.label }}</span>
            </div>
            <div class="stat-row-bar-wrap">
              <div class="stat-row-bar">
                <div
                  class="stat-row-fill"
                  :style="{ width: (loading ? 0 : row.pct) + '%', background: row.color }"
                />
              </div>
            </div>
            <span class="stat-row-count">
              <span v-if="loading" class="skeleton-count" />
              <span v-else>{{ row.count.toLocaleString('fr-FR') }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Carte 2 : Tickets -->
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-icon icon-orange">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
            </svg>
          </div>
          <div>
            <h2 class="stat-card-title">Tickets</h2>
            <p class="stat-card-sub">Total des tickets enregistrés</p>
          </div>
        </div>

        <div class="stat-total">
          <span v-if="loading" class="skeleton-total" />
          <span v-else>{{ totalTickets.toLocaleString('fr-FR') }}</span>
          <span class="stat-total-label">tickets</span>
        </div>

        <div class="stat-divider" />

        <div class="stat-rows">
          <div v-for="row in ticketRows" :key="row.label" class="stat-row">
            <div class="stat-row-left">
              <span class="stat-row-dot" :style="{ background: row.color }" />
              <span class="stat-row-label">{{ row.label }}</span>
            </div>
            <div class="stat-row-bar-wrap">
              <div class="stat-row-bar">
                <div
                  class="stat-row-fill"
                  :style="{ width: (loading ? 0 : row.pct) + '%', background: row.color }"
                />
              </div>
            </div>
            <span class="stat-row-count">
              <span v-if="loading" class="skeleton-count" />
              <span v-else>{{ row.count.toLocaleString('fr-FR') }}</span>
            </span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import glpiClient from '@/services/api/glpiClient'
import { fetchAllTickets } from '@/services/api'
import { GLPI_ENDPOINTS } from '@/constants/glpi'

const loading  = ref(false)
const apiError = ref('')

const dateLabel = computed(() =>
  new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
)

/* ─── Comptages assets ────────────────────────────────────────────────────── */
const counts = ref({
  computers:        0,
  monitors:         0,
  printers:         0,
  networkEquipment: 0,
  phones:           0,
  software:         0,
})

const totalAssets = computed(() =>
  Object.values(counts.value).reduce((a, b) => a + b, 0)
)

const assetRows = computed(() => {
  const max = Math.max(...Object.values(counts.value), 1)
  return [
    { label: 'Ordinateurs',         count: counts.value.computers,        color: '#2563eb', pct: Math.round(counts.value.computers        / max * 100) },
    { label: 'Écrans',              count: counts.value.monitors,         color: '#0891b2', pct: Math.round(counts.value.monitors         / max * 100) },
    { label: 'Imprimantes',         count: counts.value.printers,         color: '#7c3aed', pct: Math.round(counts.value.printers         / max * 100) },
    { label: 'Équipements réseau',  count: counts.value.networkEquipment, color: '#16a34a', pct: Math.round(counts.value.networkEquipment / max * 100) },
    { label: 'Téléphones',          count: counts.value.phones,           color: '#d97706', pct: Math.round(counts.value.phones           / max * 100) },
    { label: 'Logiciels',           count: counts.value.software,         color: '#dc2626', pct: Math.round(counts.value.software         / max * 100) },
  ]
})

/* ─── Comptages tickets ───────────────────────────────────────────────────── */
const totalTickets   = ref(0)
const countIncidents = ref(0)
const countDemandes  = ref(0)

const ticketRows = computed(() => {
  const max = Math.max(countIncidents.value, countDemandes.value, 1)
  return [
    { label: 'Incidents', count: countIncidents.value, color: '#f97316', pct: Math.round(countIncidents.value / max * 100) },
    { label: 'Demandes',  count: countDemandes.value,  color: '#2563eb', pct: Math.round(countDemandes.value  / max * 100) },
  ]
})

/* ─── Helper : compte rapide via Content-Range ────────────────────────────── */
async function countItems(endpoint: string): Promise<number> {
  try {
    const { headers } = await glpiClient.get(endpoint, {
      params: { range: '0-0' },
    })
    const range = headers['content-range'] as string | undefined
    if (range) {
      const match = range.match(/\/(\d+)/)
      if (match) return parseInt(match[1], 10)
    }
    return 0
  } catch {
    return 0
  }
}

/* ─── Fetch ───────────────────────────────────────────────────────────────── */
async function refreshAll() {
  loading.value  = true
  apiError.value = ''

  try {
    // Tous les comptages assets en parallèle (lecture du header uniquement)
    const [computers, monitors, printers, network, phones, software] = await Promise.all([
      countItems(GLPI_ENDPOINTS.COMPUTER),
      countItems(GLPI_ENDPOINTS.MONITOR),
      countItems(GLPI_ENDPOINTS.PRINTER),
      countItems(GLPI_ENDPOINTS.NETWORK_EQUIPMENT),
      countItems(GLPI_ENDPOINTS.PHONE),
      countItems(GLPI_ENDPOINTS.SOFTWARE),
    ])

    counts.value = { computers, monitors, printers, networkEquipment: network, phones, software }

    // Tickets : fetch complet pour grouper par type
    const tickets = await fetchAllTickets()
    const nonDeleted = tickets.filter(t => !t.isDeleted)
    totalTickets.value   = nonDeleted.length
    countIncidents.value = nonDeleted.filter(t => t.type === 1).length
    countDemandes.value  = nonDeleted.filter(t => t.type === 2).length

  } catch (e: unknown) {
    apiError.value = e instanceof Error ? e.message : 'Erreur lors du chargement'
  } finally {
    loading.value = false
  }
}

onMounted(refreshAll)
</script>

<style scoped>
@import '../../styles/DashboardView.css';
</style>
