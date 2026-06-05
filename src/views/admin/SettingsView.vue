<template>
  <div class="module-view">

    <!-- Header -->
    <div class="mv-header animate-in">
      <div class="mv-title-wrap">
        <div class="mv-icon icon-purple">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2"/>
          </svg>
        </div>
        <div>
          <h1 class="mv-title">Configuration</h1>
          <p class="mv-sub">Gestion des données par module</p>
        </div>
      </div>
      <div class="mv-actions">
        <button class="btn-fetch btn-purple" @click="loadTab" :disabled="loading">
          <svg v-if="loading" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Actualiser
        </button>
      </div>
    </div>

    <!-- Onglets -->
    <div class="filter-tabs animate-in">
      <button class="tab" :class="{ active: activeTab === 'tickets'  }" @click="setTab('tickets')">
        🎫 Tickets &amp; Relations
      </button>
      <button class="tab" :class="{ active: activeTab === 'assets'   }" @click="setTab('assets')">
        🖥 Parc informatique
      </button>
      <button class="tab" :class="{ active: activeTab === 'reservations' }" @click="setTab('reservations')">
        📅 Réservations
      </button>
    </div>

    <!-- ─── TICKETS ──────────────────────────────────────────────────────────── -->
    <template v-if="activeTab === 'tickets'">

      <!-- Tickets -->
      <section class="cfg-section animate-in">
        <div class="cfg-section-header">
          <div class="cfg-section-title">
            <span class="cfg-dot orange" />
            Tickets
          </div>
          <span class="cfg-count">{{ tickets.length }} entrée{{ tickets.length > 1 ? 's' : '' }}</span>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Titre</th><th>Type</th><th>Statut</th>
                <th>Priorité</th><th>Date création</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="6"><div class="tbl-loading"><div v-for="n in 4" :key="n" class="skeleton-row"/></div></td></tr>
              <tr v-else-if="tickets.length === 0"><td colspan="6" class="tbl-empty">Aucun ticket</td></tr>
              <tr v-else v-for="t in tickets" :key="t.id">
                <td><span class="mono">#{{ t.id }}</span></td>
                <td class="td-title">{{ t.title }}</td>
                <td><span class="badge" :class="t.type === 1 ? 'badge-orange' : 'badge-blue'">{{ t.type === 1 ? 'Incident' : 'Demande' }}</span></td>
                <td><span class="badge" :class="statusBadge(t.status)">{{ t.statusLabel }}</span></td>
                <td><span class="prio-chip" :class="prioBg(t.priority)">{{ t.priorityLabel }}</span></td>
                <td class="td-date">{{ fmtDate(t.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Catégories ITIL -->
      <section class="cfg-section animate-in">
        <div class="cfg-section-header">
          <div class="cfg-section-title"><span class="cfg-dot blue"/>Catégories ITIL</div>
          <span class="cfg-count">{{ itilCategories.length }} entrée{{ itilCategories.length > 1 ? 's' : '' }}</span>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>ID</th><th>Nom</th><th>Complètename</th></tr></thead>
            <tbody>
              <tr v-if="loading"><td colspan="3"><div class="tbl-loading"><div v-for="n in 3" :key="n" class="skeleton-row"/></div></td></tr>
              <tr v-else-if="itilCategories.length === 0"><td colspan="3" class="tbl-empty">Aucune catégorie</td></tr>
              <tr v-else v-for="c in itilCategories" :key="c.id">
                <td><span class="mono">{{ c.id }}</span></td>
                <td>{{ c.name }}</td>
                <td class="td-muted">{{ c.completename }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </template>

    <!-- ─── PARC INFORMATIQUE ────────────────────────────────────────────────── -->
    <template v-if="activeTab === 'assets'">
      <section v-for="grp in assetGroups" :key="grp.label" class="cfg-section animate-in">
        <div class="cfg-section-header">
          <div class="cfg-section-title"><span class="cfg-dot blue"/>{{ grp.label }}</div>
          <span class="cfg-count">{{ grp.items.length }} entrée{{ grp.items.length > 1 ? 's' : '' }}</span>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>ID</th><th>Nom</th><th>N° Série</th><th>Entité</th><th>Utilisateur</th><th>Statut</th></tr></thead>
            <tbody>
              <tr v-if="loading"><td colspan="6"><div class="tbl-loading"><div v-for="n in 3" :key="n" class="skeleton-row"/></div></td></tr>
              <tr v-else-if="grp.items.length === 0"><td colspan="6" class="tbl-empty">Aucun élément</td></tr>
              <tr v-else v-for="a in grp.items" :key="a.id">
                <td><span class="mono">{{ a.id }}</span></td>
                <td class="td-title">{{ a.name }}</td>
                <td class="td-muted mono">{{ a.serial || '—' }}</td>
                <td class="td-muted">{{ a.entityId ?? '—' }}</td>
                <td class="td-muted">{{ a.userId ?? '—' }}</td>
                <td><span class="badge badge-gray">{{ a.statusLabel }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- ─── RÉSERVATIONS ─────────────────────────────────────────────────────── -->
    <template v-if="activeTab === 'reservations'">

      <!-- Articles réservables -->
      <section class="cfg-section animate-in">
        <div class="cfg-section-header">
          <div class="cfg-section-title"><span class="cfg-dot cyan"/>Articles réservables</div>
          <span class="cfg-count">{{ reservationItems.length }} entrée{{ reservationItems.length > 1 ? 's' : '' }}</span>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>ID</th><th>Nom</th><th>Commentaire</th><th>Actif</th></tr></thead>
            <tbody>
              <tr v-if="loading"><td colspan="4"><div class="tbl-loading"><div v-for="n in 3" :key="n" class="skeleton-row"/></div></td></tr>
              <tr v-else-if="reservationItems.length === 0"><td colspan="4" class="tbl-empty">Aucun article réservable</td></tr>
              <tr v-else v-for="r in reservationItems" :key="r.id">
                <td><span class="mono">{{ r.id }}</span></td>
                <td class="td-title">{{ r.name || r.itemtype + ' #' + r.items_id }}</td>
                <td class="td-muted">{{ r.comment || '—' }}</td>
                <td><span class="badge" :class="r.is_active ? 'badge-green' : 'badge-gray'">{{ r.is_active ? 'Actif' : 'Inactif' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Réservations -->
      <section class="cfg-section animate-in">
        <div class="cfg-section-header">
          <div class="cfg-section-title"><span class="cfg-dot purple"/>Réservations planifiées</div>
          <span class="cfg-count">{{ reservations.length }} entrée{{ reservations.length > 1 ? 's' : '' }}</span>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>ID</th><th>Article</th><th>Début</th><th>Fin</th><th>Utilisateur</th><th>Commentaire</th></tr></thead>
            <tbody>
              <tr v-if="loading"><td colspan="6"><div class="tbl-loading"><div v-for="n in 3" :key="n" class="skeleton-row"/></div></td></tr>
              <tr v-else-if="reservations.length === 0"><td colspan="6" class="tbl-empty">Aucune réservation</td></tr>
              <tr v-else v-for="r in reservations" :key="r.id">
                <td><span class="mono">{{ r.id }}</span></td>
                <td class="td-muted">Item #{{ r.reservationitems_id }}</td>
                <td>{{ fmtDate(r.begin) }}</td>
                <td>{{ fmtDate(r.end) }}</td>
                <td class="td-muted">{{ r.users_id ?? '—' }}</td>
                <td class="td-muted">{{ r.comment || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </template>

    <!-- Erreur API -->
    <div v-if="apiError" class="cfg-error">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ apiError }}
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchAllTickets, fetchAllComputers, fetchAllMonitors, fetchAllPrinters } from '@/services/api'
import glpiClient from '@/services/api/glpiClient'
import type { Ticket } from '@/models/Ticket'
import type { Asset } from '@/models/Asset'

const activeTab = ref<'tickets' | 'assets' | 'reservations'>('tickets')
const loading   = ref(false)
const apiError  = ref('')

/* ─── Données tickets ─────────────────────────────────────────────────────── */
const tickets        = ref<Ticket[]>([])
const itilCategories = ref<{ id: number; name: string; completename: string }[]>([])

/* ─── Données parc ────────────────────────────────────────────────────────── */
const computers = ref<Asset[]>([])
const monitors  = ref<Asset[]>([])
const printers  = ref<Asset[]>([])

const assetGroups = computed(() => [
  { label: 'Ordinateurs',  items: computers.value },
  { label: 'Écrans',       items: monitors.value  },
  { label: 'Imprimantes',  items: printers.value  },
])

/* ─── Données réservations ────────────────────────────────────────────────── */
const reservationItems = ref<{ id: number; name?: string; itemtype: string; items_id: number; comment?: string; is_active: number }[]>([])
const reservations     = ref<{ id: number; reservationitems_id: number; begin: string; end: string; users_id?: number; comment?: string }[]>([])

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function fmtDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function statusBadge(s: number) {
  if (s === 1) return 'badge-blue'
  if (s === 2 || s === 3) return 'badge-orange'
  if (s === 5 || s === 6) return 'badge-green'
  return 'badge-gray'
}
function prioBg(p: number) {
  if (p >= 5) return 'prio-major'
  if (p === 4) return 'prio-high'
  if (p === 3) return 'prio-medium'
  return 'prio-low'
}

/* ─── Chargement par onglet ───────────────────────────────────────────────── */
async function loadTab() {
  loading.value  = true
  apiError.value = ''
  try {
    if (activeTab.value === 'tickets') {
      const [t, cats] = await Promise.all([
        fetchAllTickets(),
        glpiClient.get('/ITILCategory').then(r => r.data).catch(() => []),
      ])
      tickets.value        = t
      itilCategories.value = Array.isArray(cats) ? cats : []

    } else if (activeTab.value === 'assets') {
      const [c, m, p] = await Promise.all([fetchAllComputers(), fetchAllMonitors(), fetchAllPrinters()])
      computers.value = c
      monitors.value  = m
      printers.value  = p

    } else {
      const [items, resa] = await Promise.all([
        glpiClient.get('/ReservationItem').then(r => r.data).catch(() => []),
        glpiClient.get('/Reservation').then(r => r.data).catch(() => []),
      ])
      reservationItems.value = Array.isArray(items) ? items : []
      reservations.value     = Array.isArray(resa)  ? resa  : []
    }
  } catch (e: unknown) {
    apiError.value = e instanceof Error ? e.message : 'Erreur API'
  } finally {
    loading.value = false
  }
}

function setTab(tab: typeof activeTab.value) {
  activeTab.value = tab
  loadTab()
}

onMounted(loadTab)
</script>

<style scoped>
@import '../../styles/SettingsView.css';
</style>
