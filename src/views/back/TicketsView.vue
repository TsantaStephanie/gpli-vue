<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  fetchAllTickets, 
  fetchTicketItems,
  fetchTicketCosts,
  getTicketCostSummary,
  addTicketCost,
  type TicketCost,
  type TicketCostSummary
} from '@/services/api/ticketService'
import type { Ticket, TicketStatus } from '@/models/Ticket'

const router = useRouter()
const loading = ref(false)
const tickets = ref<Ticket[]>([])
const selectedTicket = ref<Ticket | null>(null)
const selectedTicketItems = ref<any[]>([])
const loadingItems = ref(false)

// Variables pour les coûts
const ticketCosts = ref<TicketCost[]>([])
const ticketCostSummary = ref<TicketCostSummary | null>(null)
const loadingCosts = ref(false)
const showCostsModal = ref(false)
const savingCost = ref(false)

// Nouveau coût
const newCost = ref({
  name: '',
  hours: 0,
  cost_time: 0,
  cost_fixed: 0,
  comment: ''
})

const activeStatus = ref('all')
const statuses = [
  { key: 'all',    label: 'Tous' }
]

async function load() {
  loading.value = true
  selectedTicket.value = null
  try {
    const allTickets = await fetchAllTickets()
    if (activeStatus.value === 'open') {
      tickets.value = allTickets.filter(t => t.status !== 5 && t.status !== 6)
    } else if (activeStatus.value === 'solved') {
      tickets.value = allTickets.filter(t => t.status === 5)
    } else if (activeStatus.value === 'closed') {
      tickets.value = allTickets.filter(t => t.status === 6)
    } else {
      tickets.value = allTickets
    }
  } catch (error) {
    console.error("Erreur lors du chargement des tickets:", error)
    tickets.value = []
  } finally {
    loading.value = false
  }
}

async function selectTicket(ticket: Ticket) {
  selectedTicket.value = ticket
  selectedTicketItems.value = []
  ticketCosts.value = []
  ticketCostSummary.value = null
  loadingItems.value = true
  loadingCosts.value = true
  
  try {
    const [items, costs, costSummary] = await Promise.all([
      fetchTicketItems(ticket.id),
      fetchTicketCosts(ticket.id),
      getTicketCostSummary(ticket.id)
    ])
    
    selectedTicketItems.value = items || []
    ticketCosts.value = costs || []
    ticketCostSummary.value = costSummary
  } catch (error) {
    console.error("Erreur lors du chargement:", error)
  } finally {
    loadingItems.value = false
    loadingCosts.value = false
  }
}

function goToCreateTicket() {
  router.push('/tickets/create')
}

function formatDate(dateString?: string): string {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatNumber(value: any): string {
  if (value === undefined || value === null) return '0.00'
  const num = typeof value === 'number' ? value : parseFloat(value)
  if (isNaN(num)) return '0.00'
  return num.toFixed(2)
}

function formatDuration(seconds: any): string {
  const secs = typeof seconds === 'number' ? seconds : parseInt(seconds) || 0
  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)
  if (hours === 0 && minutes === 0) return '-'
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours}h ${minutes}min`
}

async function saveCost() {
  if (!newCost.value.name) {
    alert('Veuillez saisir un libellé')
    return
  }
  
  savingCost.value = true
  
  try {
    const actiontime = (newCost.value.hours || 0) * 3600
    
    await addTicketCost(selectedTicket.value!.id, {
      name: newCost.value.name,
      comment: newCost.value.comment,
      actiontime: actiontime,
      cost_time: newCost.value.cost_time,
      cost_fixed: newCost.value.cost_fixed
    })
    
    // Recharger les coûts
    const [costs, costSummary] = await Promise.all([
      fetchTicketCosts(selectedTicket.value!.id),
      getTicketCostSummary(selectedTicket.value!.id)
    ])
    
    ticketCosts.value = costs
    ticketCostSummary.value = costSummary
    
    // Réinitialiser le formulaire
    newCost.value = {
      name: '',
      hours: 0,
      cost_time: 0,
      cost_fixed: 0,
      comment: ''
    }
    
    showCostsModal.value = false
  } catch (error) {
    console.error('Erreur lors de l\'ajout du coût:', error)
    alert('Erreur lors de l\'ajout du coût')
  } finally {
    savingCost.value = false
  }
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  1: 'Nouveau', 2: 'En cours', 3: 'Planifié', 4: 'En attente', 5: 'Résolu', 6: 'Fermé',
}

function statusLabel(status: TicketStatus): string {
  return STATUS_LABELS[status] ?? 'Inconnu'
}

function statusClass(status: TicketStatus): string {
  const a: Record<TicketStatus, string> = {
    1: 'badge-blue', 2: 'badge-orange', 3: 'badge-orange', 4: 'badge-gray', 5: 'badge-green', 6: 'badge-gray',
  }
  return a[status] ?? 'badge-gray'
}

function getTypeBadge(type: number) {
  return type === 1 ? { label: 'Incident', class: 'badge-red' } : { label: 'Demande', class: 'badge-blue' }
}

onMounted(load)
</script>

<template>
  <div class="module-view animate-in">
    <div class="mv-header">
      <div class="mv-title-wrap">

        <div>
          <h1 class="mv-title">Tickets</h1>
        </div>
      </div>
      <div class="mv-actions">
        <div class="filter-tabs">
          <button v-for="s in statuses" :key="s.key" class="tab" :class="{ active: activeStatus === s.key }" @click="() => { activeStatus = s.key; load(); }">{{ s.label }}</button>
        </div>
        <button class="btn-fetch btn-orange" @click="load" :disabled="loading">
          <svg v-if="loading" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          {{ loading ? 'Chargement...' : 'Recharger' }}
        </button>
        <button class="btn-primary" @click="goToCreateTicket">
          + Nouveau Ticket
        </button>
      </div>
    </div>

    <div class="tickets-layout">
      <!-- Liste des Tickets -->
      <div class="tickets-list card">
        <h3>Liste des Tickets</h3>
        <div v-if="loading" class="loading-state">Chargement...</div>
        <div v-else-if="tickets.length === 0" class="empty-state">Aucun ticket trouvé.</div>
        <div v-else class="list-container">
          <table class="tickets-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Titre</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Créé le</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="ticket in tickets" 
                :key="ticket.id"
                @click="selectTicket(ticket)"
                class="clickable-row"
                :class="{ 'selected': selectedTicket?.id === ticket.id }"
              >
                <td class="col-id">#{{ ticket.id }}</td>
                <td class="col-title">{{ ticket.title }}</td>
                <td>
                  <span :class="['badge', getTypeBadge(ticket.type).class]">
                    {{ getTypeBadge(ticket.type).label }}
                  </span>
                </td>
                <td>
                  <div class="status-cell">
                    <span :class="['status-dot', `status-${ticket.status}`]"></span>
                    <span>{{ statusLabel(ticket.status) }}</span>
                  </div>
                </td>
                <td class="col-date">{{ formatDate(ticket.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Fiche du Ticket -->
      <div class="ticket-detail card" v-if="selectedTicket">
        <div class="detail-header">
          <h3>Fiche du Ticket #{{ selectedTicket.id }}</h3>
          <button class="btn-close" @click="selectedTicket = null">✕</button>
        </div>
        <h2>{{ selectedTicket.title }}</h2>
        <div class="detail-badges">
          <span :class="['badge', getTypeBadge(selectedTicket.type).class]">{{ getTypeBadge(selectedTicket.type).label }}</span>
          <span :class="['badge', statusClass(selectedTicket.status)]">{{ statusLabel(selectedTicket.status) }}</span>
          <span class="badge badge-gray">Priorité: {{ selectedTicket.priorityLabel }}</span>
        </div>
        <hr />
        
        <div class="detail-dates">
          <p><strong>Créé le :</strong> {{ formatDate(selectedTicket.createdAt) }}</p>
          <p><strong>Modifié le :</strong> {{ formatDate(selectedTicket.updatedAt) }}</p>
          <p><strong>Résolu le :</strong> {{ formatDate(selectedTicket.solvedAt) || 'Non résolu' }}</p>
          <p><strong>Clos le :</strong> {{ formatDate(selectedTicket.closedAt) || 'Non clos' }}</p>
        </div>
        <hr />
        
        <div class="detail-content">
          <h4>Description</h4>
          <div class="html-content" v-html="selectedTicket.description"></div>
        </div>
        <hr />
        
        <div class="detail-items">
          <h4>Éléments associés (Matériels liés)</h4>
          <div v-if="loadingItems" class="loading-state">Chargement des éléments...</div>
          <ul v-else-if="selectedTicketItems.length > 0" class="items-list">
            <li v-for="item in selectedTicketItems" :key="item.id">
              <span class="badge badge-gray">{{ item.itemtype }}</span> ID: {{ item.items_id }}
            </li>
          </ul>
          <p v-else class="empty-state">Aucun matériel lié à ce ticket.</p>
        </div>
        <hr />
        
        <!-- SECTION COÛTS -->
        <div class="detail-costs">
          <h4>Coûts du ticket</h4>
          
          <div v-if="loadingCosts" class="loading-state">Chargement des coûts...</div>
          <div v-else-if="ticketCostSummary" class="costs-summary-grid">
            <div class="costs-card">
              <div class="costs-card-content">
                <span class="costs-card-value">{{ formatNumber(ticketCostSummary.totalCost) }} €</span>
                <span class="costs-card-label">Coût total</span>
              </div>
            </div>
            <div class="costs-card">
              <div class="costs-card-content">
                <span class="costs-card-value">{{ ticketCostSummary.totalTimeFormatted }}</span>
                <span class="costs-card-label">Temps passé</span>
              </div>
            </div>
            <div class="costs-card">
              <div class="costs-card-content">
                <span class="costs-card-value">{{ formatNumber(ticketCostSummary.costTime) }} €</span>
                <span class="costs-card-label">Coût horaire</span>
              </div>
            </div>
            <div class="costs-card">
              <div class="costs-card-content">
                <span class="costs-card-value">{{ formatNumber(ticketCostSummary.costFixed) }} €</span>
                <span class="costs-card-label">Coût fixe</span>
              </div>
            </div>
          </div>
          
          <div v-else class="empty-state">Aucun coût enregistré pour ce ticket</div>
          
          <button class="btn-add-cost" @click="showCostsModal = true">
            + Ajouter un coût
          </button>
        </div>
        <hr />
        
        <button class="btn-edit" @click="router.push(`/tickets/${selectedTicket.id}/edit`)">
          Modifier le ticket
        </button>
      </div>
      
      <div class="ticket-detail-placeholder card" v-else>
        <p>Sélectionnez un ticket dans la liste pour voir sa fiche détaillée.</p>
      </div>
    </div>

    <!-- Modal d'ajout de coût -->
    <div v-if="showCostsModal" class="modal-overlay" @click.self="showCostsModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Ajouter un coût</h3>
          <button class="modal-close" @click="showCostsModal = false">×</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>Libellé *</label>
            <input v-model="newCost.name" type="text" placeholder="Ex: Intervention sur site" />
          </div>
          <div class="form-group">
            <label>Durée (heures)</label>
            <input v-model.number="newCost.hours" type="number" step="0.5" placeholder="0" />
          </div>
          <div class="form-group">
            <label>Coût horaire (€/h)</label>
            <input v-model.number="newCost.cost_time" type="number" step="0.01" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label>Coût fixe (€)</label>
            <input v-model.number="newCost.cost_fixed" type="number" step="0.01" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label>Commentaire</label>
            <textarea v-model="newCost.comment" rows="2" placeholder="Détails supplémentaires..."></textarea>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" @click="showCostsModal = false">Annuler</button>
          <button class="btn-primary" @click="saveCost" :disabled="savingCost">
            {{ savingCost ? 'Ajout...' : 'Ajouter' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '@/styles/TicketsView.css';
</style>