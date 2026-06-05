<template>
  <div class="module-view">

    <!-- Header -->
    <div class="mv-header animate-in">
      <div class="mv-title-wrap">
        <div class="mv-icon" style="background:#fef2f2;color:#dc2626;border-color:#fecaca">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </div>
        <div>
          <h1 class="mv-title">Réinitialisation des données</h1>
          <p class="mv-sub">Suppression définitive de toutes les données via l'API</p>
        </div>
      </div>
    </div>

    <!-- Card centrale -->
    <div class="reset-card animate-in">

      <!-- Avertissement -->
      <div class="reset-warning">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>Cette action supprime <strong>définitivement</strong> toutes les données ci-dessous. Elle est <strong>irréversible</strong>.</span>
      </div>

      <!-- Ce qui sera supprimé -->
      <div class="reset-scope">
        <p class="reset-scope-title">Données concernées</p>
        <div class="reset-scope-list">
          <div v-for="item in allItems" :key="item.key" class="reset-scope-item">
            <div class="scope-icon" :class="item.colorClass">
              <span v-html="item.icon" />
            </div>
            <div class="scope-info">
              <span class="scope-name">{{ item.label }}</span>
              <span class="scope-desc">{{ item.desc }}</span>
            </div>
            <!-- État individuel -->
            <div class="scope-status">
              <svg v-if="states[item.key]?.done" class="status-ok" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <svg v-else-if="running" class="spin-icon status-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Barre de progression globale -->
      <div v-if="running || done" class="reset-progress-wrap">
        <div class="progress-bar-global">
          <div class="progress-fill-global" :style="{ width: globalPct + '%' }" />
        </div>
        <div class="progress-info">
          <span class="progress-step">{{ currentStep }}</span>
          <span class="progress-pct">{{ globalPct }}%</span>
        </div>
      </div>

      <!-- Résultat final -->
      <div v-if="done && !running" class="reset-done">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        {{ totalDeleted }} enregistrement{{ totalDeleted > 1 ? 's' : '' }} supprimé{{ totalDeleted > 1 ? 's' : '' }} avec succès
      </div>

      <!-- Bouton unique -->
      <button class="btn-reset-all" :disabled="running" @click="showModal = true">
        <svg v-if="running" class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
        </svg>
        {{ running ? 'Réinitialisation en cours...' : 'Réinitialiser toutes les données' }}
      </button>

    </div>
  </div>

  <!-- Modal confirmation -->
  <Teleport to="body">
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-box">
        <div class="modal-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3 class="modal-title">Confirmer la réinitialisation</h3>
        <p class="modal-msg">
          Toutes les données (tickets, parc informatique, réservations) seront
          <strong>définitivement supprimées</strong> de GLPI. Cette action ne peut pas être annulée.
        </p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showModal = false">Annuler</button>
          <button class="btn-confirm" @click="doResetAll">Supprimer définitivement</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import {
  resetTickets, resetTicketFollowups, resetTicketSolutions,
  resetComputers, resetMonitors, resetPrinters, resetNetworkEquipment,
  resetReservations, resetReservationItems,
} from '@/services/api/resetService'

const showModal    = ref(false)
const running      = ref(false)
const done         = ref(false)
const currentStep  = ref('')
const totalDeleted = ref(0)

const states = reactive<Record<string, { done: boolean }>>({})

/* ─── Liste complète des ressources ──────────────────────────────────────── */
const allItems = [
  {
    key: 'tickets',   label: 'Tickets',             desc: 'Incidents et demandes',
    colorClass: 'icon-orange',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    fn: resetTickets,
  },
  {
    key: 'followups', label: 'Suivis & Solutions',  desc: 'Followups et solutions des tickets',
    colorClass: 'icon-orange',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    fn: async (cb: (d: number, t: number) => void) => {
      const r1 = await resetTicketFollowups(cb)
      const r2 = await resetTicketSolutions(cb)
      return { deleted: r1.deleted + r2.deleted, errors: [...r1.errors, ...r2.errors] }
    },
  },
  {
    key: 'computers', label: 'Ordinateurs',         desc: 'Postes de travail et serveurs',
    colorClass: 'icon-blue',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    fn: resetComputers,
  },
  {
    key: 'monitors',  label: 'Écrans & Imprimantes', desc: 'Moniteurs, imprimantes, équipements réseau',
    colorClass: 'icon-blue',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/></svg>`,
    fn: async (cb: (d: number, t: number) => void) => {
      const r1 = await resetMonitors(cb)
      const r2 = await resetPrinters(cb)
      const r3 = await resetNetworkEquipment(cb)
      return { deleted: r1.deleted + r2.deleted + r3.deleted, errors: [...r1.errors, ...r2.errors, ...r3.errors] }
    },
  },
  {
    key: 'reservations', label: 'Réservations',     desc: 'Réservations et articles réservables',
    colorClass: 'icon-cyan',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    fn: async (cb: (d: number, t: number) => void) => {
      const r1 = await resetReservations(cb)
      const r2 = await resetReservationItems(cb)
      return { deleted: r1.deleted + r2.deleted, errors: [...r1.errors, ...r2.errors] }
    },
  },
]

const completedCount = computed(() => Object.values(states).filter(s => s.done).length)
const globalPct      = computed(() => Math.round(completedCount.value / allItems.length * 100))

/* ─── Reset global ────────────────────────────────────────────────────────── */
async function doResetAll() {
  showModal.value    = false
  running.value      = true
  done.value         = false
  totalDeleted.value = 0
  Object.keys(states).forEach(k => delete states[k])

  for (const item of allItems) {
    currentStep.value = `Suppression : ${item.label}…`
    try {
      const result = await item.fn(() => {})
      totalDeleted.value += result.deleted
    } catch { /* continue */ }
    states[item.key] = { done: true }
  }

  currentStep.value = 'Terminé'
  running.value     = false
  done.value        = true
}
</script>

<style scoped>
@import '../../styles/ResetView.css';
</style>
