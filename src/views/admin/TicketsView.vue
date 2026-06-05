<template>
  <div class="module-view animate-in">
    <div class="mv-header">
      <div class="mv-title-wrap">
        <div class="mv-icon icon-orange">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
        </div>
        <div>
          <h1 class="mv-title">Tickets</h1>
          <p class="mv-sub">Support & Helpdesk — <code>GET /Ticket</code></p>
        </div>
      </div>
      <div class="mv-actions">
        <div class="filter-tabs">
          <button v-for="s in statuses" :key="s.key" class="tab" :class="{ active: activeStatus === s.key }" @click="activeStatus = s.key">{{ s.label }}</button>
        </div>
        <button class="btn-fetch btn-orange" @click="load" :disabled="loading">
          <svg v-if="loading" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          {{ loading ? 'Chargement...' : 'Recharger' }}
        </button>
      </div>
    </div>

    <!-- Tableau des tickets -->
    <div v-if="tickets.length > 0" class="table-container">
      <table>
        <thead>
          <tr>
            <th>Titre</th>
            <th>Statut</th>
            <th>Dernière modification</th>
            <th>Date d'ouverture</th>
            <th>Priorité</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ticket in tickets" :key="ticket.id">
            <td class="ticket-title-cell">
              <span class="ticket-id">#{{ ticket.id }}</span>
              <span>{{ ticket.title }}</span>
            </td>
            <td><span :class="['badge', statusClass(ticket.status)]">{{ statusLabel(ticket.status) }}</span></td>
            <td>{{ formatDate(ticket.updatedAt) }}</td>
            <td>{{ formatDate(ticket.createdAt) }}</td>
            <td>
              <div class="priority-cell">
                <span :class="['priority-dot', priorityClass(ticket.priority)]"></span>
                {{ priorityLabel(ticket.priority) }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- État vide -->
    <div v-else class="empty-module">
      <div class="em-icon icon-orange">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <h2>{{ loading ? 'Chargement des tickets...' : 'Aucun ticket trouvé' }}</h2>
      <p v-if="!loading">Cliquez sur "Recharger" pour essayer à nouveau ou vérifiez les filtres.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchAllTickets } from '@/services/api/ticketService'
import type { Ticket, TicketStatus, TicketPriority } from '@/models/Ticket'

const loading = ref(false)
const tickets = ref<Ticket[]>([])
const activeStatus = ref('open')
const statuses = [
  { key: 'all',    label: 'Tous' },
  { key: 'open',   label: 'Ouverts' },
  { key: 'solved', label: 'Résolus' },
  { key: 'closed', label: 'Fermés' },
]

async function load() {
  loading.value = true
  try {
    // TODO: Ajouter la logique de filtre par statut
    tickets.value = await fetchAllTickets()
  } catch (error) {
    console.error("Erreur lors du chargement des tickets:", error)
    tickets.value = []
  } finally {
    loading.value = false
  }
}

// --- Fonctions d'aide à l'affichage ---

function formatDate(dateString: string): string {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  1: 'Nouveau',
  2: 'En cours',
  3: 'Planifié',
  4: 'En attente',
  5: 'Résolu',
  6: 'Fermé',
}
function statusLabel(status: TicketStatus): string {
  return STATUS_LABELS[status] ?? 'Inconnu'
}
function statusClass(status: TicketStatus): string {
  const a: Record<TicketStatus, string> = {
    1: 'badge-blue',
    2: 'badge-orange',
    3: 'badge-orange',
    4: 'badge-gray',
    5: 'badge-green',
    6: 'badge-gray',
  }
  return a[status] ?? 'badge-gray'
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  1: 'Très basse',
  2: 'Basse',
  3: 'Moyenne',
  4.1: 'Haute',
  5: 'Très haute',
  6: 'Majeure',
}
function priorityLabel(priority: TicketPriority): string {
  return PRIORITY_LABELS[priority] ?? '—'
}
function priorityClass(priority: TicketPriority): string {
  if (priority >= 5) return 'prio-high'
  if (priority >= 3) return 'prio-medium'
  return 'prio-low'
}


// Charger les tickets au montage du composant
onMounted(load)
</script>

<style scoped>
@import '../../styles/TicketsView.css';
</style>
