<template>
  <div class="tickets-view animate-in">

    <!-- ─── Header ──────────────────────────────────────────────────────────── -->
    <div class="tv-header">
      <div class="mv-title-wrap">
        <div class="mv-icon icon-orange">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
            <line x1="9" y1="16" x2="12" y2="16"/>
          </svg>
        </div>
        <div>
          <h1 class="mv-title">Tickets</h1>
          <p class="mv-sub">{{ filteredTickets.length }} ticket{{ filteredTickets.length !== 1 ? 's' : '' }}</p>
        </div>
      </div>
      <div class="mv-actions">
        <div class="tv-search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            v-model="searchQuery"
            class="tv-search-input"
            placeholder="Rechercher un ticket…"
          />
        </div>
        <div class="filter-tabs">
          <button
            v-for="s in statuses"
            :key="s.key"
            class="tab"
            :class="{ active: activeStatus === s.key }"
            @click="activeStatus = s.key"
          >{{ s.label }}</button>
        </div>
        <button class="btn-fetch btn-orange" @click="load" :disabled="loading">
          <svg v-if="loading" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          {{ loading ? 'Chargement…' : 'Recharger' }}
        </button>
        <button class="btn-fetch btn-new-ticket" @click="openModal">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nouveau ticket
        </button>
      </div>
    </div>

    <!-- ─── Content : liste + fiche ──────────────────────────────────────────── -->
    <div class="tv-content">

      <!-- ─── Liste des tickets ──────────────────────────────────────────────── -->
      <div class="tv-list-pane">

        <!-- Skeletons -->
        <div v-if="loading && tickets.length === 0" class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Titre</th><th>Type</th><th>Statut</th><th>Priorité</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in 8" :key="i">
                <td><span class="skel skel-id" /></td>
                <td><span class="skel skel-title" /></td>
                <td><span class="skel skel-badge" /></td>
                <td><span class="skel skel-badge" /></td>
                <td><span class="skel skel-badge" /></td>
                <td><span class="skel skel-date" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Vide -->
        <div v-else-if="filteredTickets.length === 0 && !loading" class="empty-module">
          <div class="em-icon icon-orange">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
          </div>
          <h2>Aucun ticket trouvé</h2>
          <p>{{ tickets.length > 0 ? 'Aucun résultat pour ce filtre.' : 'Cliquez sur "Recharger" pour récupérer les tickets.' }}</p>
        </div>

        <!-- Tableau -->
        <div v-else class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Titre</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Priorité</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="ticket in filteredTickets"
                :key="ticket.id"
                class="ticket-row"
                :class="{ 'row-selected': ticket.id === selectedId }"
                @click="openFiche(ticket.id)"
              >
                <td class="td-id">
                  <span class="ticket-id">#{{ ticket.id }}</span>
                </td>
                <td class="td-title">{{ ticket.title }}</td>
                <td>
                  <span :class="['badge', ticket.type === 1 ? 'badge-orange' : 'badge-blue']">
                    {{ ticket.type === 1 ? 'Incident' : 'Demande' }}
                  </span>
                </td>
                <td>
                  <span :class="['badge', statusClass(ticket.status)]">
                    {{ statusLabel(ticket.status) }}
                  </span>
                </td>
                <td>
                  <div class="priority-cell">
                    <span :class="['priority-dot', priorityClass(ticket.priority)]" />
                    {{ ticket.priorityLabel }}
                  </div>
                </td>
                <td class="td-date">{{ formatDate(ticket.createdAt) }}</td>
                <td class="td-action">
                  <button
                    class="btn-row-edit"
                    title="Modifier"
                    @click.stop="openEdit(ticket)"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ─── Fiche détail ────────────────────────────────────────────────────── -->
      <Transition name="fiche-slide">
        <div v-if="selectedId !== null" class="tv-fiche-pane">

          <!-- En-tête de la fiche -->
          <div class="fiche-head">
            <span class="fiche-head-id">#{{ selectedId }}</span>
            <button class="fiche-close-btn" @click="closeFiche" title="Fermer la fiche">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Chargement de la fiche -->
          <div v-if="ficheLoading" class="fiche-loading">
            <div class="fiche-skel-title" />
            <div class="fiche-skel-badges" />
            <div class="fiche-skel-block" />
            <div class="fiche-skel-block small" />
          </div>

          <!-- Contenu de la fiche -->
          <template v-else-if="selectedTicket">

            <!-- Titre + badges -->
            <div class="fiche-title-section">
              <h2 class="fiche-title">{{ selectedTicket.title }}</h2>
              <div class="fiche-badges">
                <span :class="['badge', statusClass(selectedTicket.status)]">
                  {{ statusLabel(selectedTicket.status) }}
                </span>
                <span :class="['badge', selectedTicket.type === 1 ? 'badge-orange' : 'badge-blue']">
                  {{ selectedTicket.type === 1 ? 'Incident' : 'Demande' }}
                </span>
              </div>
            </div>

            <!-- Méta-données -->
            <div class="fiche-meta-grid">
              <div class="fiche-meta-item">
                <span class="fiche-meta-label">Priorité</span>
                <div class="priority-cell">
                  <span :class="['priority-dot', priorityClass(selectedTicket.priority)]" />
                  <span class="fiche-meta-value">{{ selectedTicket.priorityLabel }}</span>
                </div>
              </div>
              <div class="fiche-meta-item">
                <span class="fiche-meta-label">Ouvert le</span>
                <span class="fiche-meta-value">{{ formatDate(selectedTicket.createdAt) }}</span>
              </div>
              <div v-if="selectedTicket.updatedAt" class="fiche-meta-item">
                <span class="fiche-meta-label">Modifié le</span>
                <span class="fiche-meta-value">{{ formatDate(selectedTicket.updatedAt) }}</span>
              </div>
              <div v-if="selectedTicket.solvedAt" class="fiche-meta-item">
                <span class="fiche-meta-label">Résolu le</span>
                <span class="fiche-meta-value">{{ formatDate(selectedTicket.solvedAt) }}</span>
              </div>
              <div v-if="selectedTicket.timeToResolve" class="fiche-meta-item">
                <span class="fiche-meta-label">Échéance SLA</span>
                <span class="fiche-meta-value">{{ formatDate(selectedTicket.timeToResolve) }}</span>
              </div>
              <div v-if="selectedTicket.actiontime" class="fiche-meta-item">
                <span class="fiche-meta-label">Durée totale</span>
                <span class="fiche-meta-value">{{ formatDuration(selectedTicket.actiontime) }}</span>
              </div>
              <div v-if="selectedTicket.categoryId" class="fiche-meta-item">
                <span class="fiche-meta-label">Catégorie</span>
                <span class="fiche-meta-value">{{ categoryLabel(selectedTicket.categoryId) }}</span>
              </div>
              <div v-if="selectedTicket.requesterId" class="fiche-meta-item">
                <span class="fiche-meta-label">Demandeur</span>
                <span class="fiche-meta-value">{{ userLabel(selectedTicket.requesterId) }}</span>
              </div>
              <div v-if="selectedTicket.locationId" class="fiche-meta-item">
                <span class="fiche-meta-label">Localisation</span>
                <span class="fiche-meta-value">{{ locationLabel(selectedTicket.locationId) }}</span>
              </div>
            </div>

            <!-- Description -->
            <div v-if="cleanDescription" class="fiche-section">
              <p class="fiche-section-title">Description</p>
              <div class="fiche-description">{{ cleanDescription }}</div>
            </div>

            <!-- Suivis -->
            <div class="fiche-section">
              <p class="fiche-section-title">
                Suivis
                <span class="fiche-count">{{ followups.length }}</span>
              </p>
              <div v-if="followups.length === 0" class="fiche-no-followups">
                Aucun suivi enregistré pour ce ticket.
              </div>
              <div v-else class="fiche-followups-list">
                <div v-for="f in followups" :key="f.id" class="followup-item">
                  <div class="followup-meta">
                    <span class="followup-user">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      Utilisateur {{ f.userId }}
                    </span>
                    <span class="followup-date">{{ formatDateTime(f.date) }}</span>
                    <span v-if="f.isPrivate" class="followup-private-badge">Privé</span>
                  </div>
                  <div class="followup-content">{{ cleanHtml(f.content) }}</div>
                </div>
              </div>
            </div>

          </template>
        </div>
      </Transition>

    </div>

    <!-- ─── Modal nouveau ticket ──────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
          <div class="modal-box">

            <!-- Header -->
            <div class="modal-header">
              <div class="modal-header-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                  <line x1="9" y1="12" x2="15" y2="12"/>
                  <line x1="9" y1="16" x2="12" y2="16"/>
                </svg>
              </div>
              <div>
                <h2 class="modal-title">{{ editId !== null ? 'Modifier le ticket' : 'Nouveau ticket' }}</h2>
                <p class="modal-subtitle">{{ editId !== null ? `Ticket #${editId}` : 'Créer un ticket via l\'API GLPI' }}</p>
              </div>
              <button class="modal-close" @click="closeModal">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <!-- Formulaire -->
            <form @submit.prevent="submitTicket" class="modal-form">

              <!-- Titre -->
              <div class="form-field">
                <label class="form-label">Titre <span class="form-required">*</span></label>
                <input
                  v-model="form.name"
                  class="form-input"
                  type="text"
                  placeholder="Titre du ticket"
                  required
                  autofocus
                />
              </div>

              <!-- Description -->
              <div class="form-field">
                <label class="form-label">Description <span class="form-required">*</span></label>
                <textarea
                  v-model="form.content"
                  class="form-textarea"
                  placeholder="Décrivez le problème ou la demande…"
                  rows="4"
                  required
                />
              </div>

              <!-- Type + Statut côte à côte -->
              <div class="form-row">
                <div class="form-field">
                  <label class="form-label">Type</label>
                  <select v-model="form.type" class="form-select">
                    <option :value="1">Incident</option>
                    <option :value="2">Demande</option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label">Statut</label>
                  <select v-model="form.status" class="form-select">
                    <option :value="1">Nouveau</option>
                    <option :value="2">En cours (assigné)</option>
                    <option :value="3">En cours (planifié)</option>
                    <option :value="4">En attente</option>
                    <option :value="5">Résolu</option>
                    <option :value="6">Fermé</option>
                  </select>
                </div>
              </div>

              <!-- Priorité + Durée côte à côte -->
              <div class="form-row">
                <div class="form-field">
                  <label class="form-label">Priorité</label>
                  <select v-model="form.priority" class="form-select">
                    <option :value="1">Très basse</option>
                    <option :value="2">Basse</option>
                    <option :value="3">Moyenne</option>
                    <option :value="4">Haute</option>
                    <option :value="5">Très haute</option>
                    <option :value="6">Majeure</option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label">Durée totale (heures)</label>
                  <div class="form-input-with-unit">
                    <input
                      v-model.number="form.actiontimeHours"
                      class="form-input"
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="0"
                    />
                    <span class="form-unit">h</span>
                  </div>
                </div>
              </div>

              <!-- Catégorie ITIL + Utilisateur demandeur -->
              <div class="form-row">
                <div class="form-field">
                  <label class="form-label">Catégorie ITIL</label>
                  <select v-model="form.itilcategoriesId" class="form-select" :disabled="optLoading">
                    <option :value="0">— Aucune —</option>
                    <option v-for="c in optCategories" :key="c.id" :value="c.id">{{ c.label }}</option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label">Utilisateur demandeur</label>
                  <select v-model="form.usersIdRecipient" class="form-select" :disabled="optLoading">
                    <option :value="0">— Aucun —</option>
                    <option v-for="u in optUsers" :key="u.id" :value="u.id">{{ u.label }}</option>
                  </select>
                </div>
              </div>

              <!-- Localisation + Date d'échéance -->
              <div class="form-row">
                <div class="form-field">
                  <label class="form-label">Localisation</label>
                  <select v-model="form.locationsId" class="form-select" :disabled="optLoading">
                    <option :value="0">— Aucune —</option>
                    <option v-for="l in optLocations" :key="l.id" :value="l.id">{{ l.label }}</option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label">Date d'échéance</label>
                  <input v-model="form.timeToResolve" class="form-input" type="datetime-local" />
                </div>
              </div>

              <!-- Erreur -->
              <div v-if="createError" class="form-error">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {{ createError }}
              </div>

              <!-- Actions -->
              <div class="modal-actions">
                <button type="button" class="btn-cancel" @click="closeModal" :disabled="creating">Annuler</button>
                <button type="submit" class="btn-submit" :disabled="creating || !form.name || !form.content">
                  <svg v-if="creating" class="spin-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  {{ creating ? 'Sauvegarde…' : editId !== null ? 'Enregistrer' : 'Créer le ticket' }}
                </button>
              </div>

            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  fetchAllTickets,
  fetchTicketById,
  fetchTicketFollowups,
  createTicket,
  updateTicket,
  type Followup,
} from '@/services/api/ticketService'
import { fetchAllUsers }     from '@/services/api/userService'
import { fetchAllLocations } from '@/services/api/locationService'
import { fetchAllPaginated } from '@/services/api/glpiClient'
import { GLPI_ENDPOINTS }   from '@/constants/glpi'
import type { Ticket, TicketStatus, TicketPriority } from '@/models/Ticket'

// ─── State ────────────────────────────────────────────────────────────────────
const loading      = ref(false)
const ficheLoading = ref(false)
const tickets      = ref<Ticket[]>([])
const selectedId   = ref<number | null>(null)
const selectedTicket = ref<Ticket | null>(null)
const followups    = ref<Followup[]>([])
const activeStatus = ref('all')
const searchQuery  = ref('')

// ─── Options des selects (chargées à l'ouverture du modal) ───────────────────
interface SelectOption { id: number; label: string }
const optCategories = ref<SelectOption[]>([])
const optUsers      = ref<SelectOption[]>([])
const optLocations  = ref<SelectOption[]>([])
const optLoading    = ref(false)

async function loadOptions() {
  if (optLoading.value) return
  optLoading.value = true
  try {
    const [cats, users, locs] = await Promise.all([
      fetchAllPaginated<{ id: number; name: string; completename?: string }>(GLPI_ENDPOINTS.ITIL_CATEGORY),
      fetchAllUsers(),
      fetchAllLocations(),
    ])
    optCategories.value = cats.map(c => ({ id: c.id, label: c.completename || c.name }))
    optUsers.value      = users
      .filter(u => !u.isDeleted && u.isActive)
      .map(u => ({ id: u.id, label: [u.firstname, u.lastname].filter(Boolean).join(' ') || u.username }))
    optLocations.value  = locs
      .filter(l => !l.isDeleted)
      .map(l => ({ id: l.id, label: l.fullPath || l.name }))
  } catch (e) {
    console.error('Erreur chargement options :', e)
  } finally {
    optLoading.value = false
  }
}

// ─── Modal création / modification ───────────────────────────────────────────
const showModal   = ref(false)
const creating    = ref(false)
const createError = ref('')
const editId      = ref<number | null>(null)
const form = ref({
  name: '', content: '',
  type: 1 as 1 | 2,
  status: 1 as TicketStatus,
  priority: 3,
  actiontimeHours: 0,
  itilcategoriesId: 0,
  usersIdRecipient: 0,
  locationsId: 0,
  timeToResolve: '',
})

const statuses = [
  { key: 'all',    label: 'Tous' },
  { key: 'open',   label: 'Ouverts' },
  { key: 'solved', label: 'Résolus' },
  { key: 'closed', label: 'Fermés' },
]

// ─── Filtrage ─────────────────────────────────────────────────────────────────
const filteredTickets = computed(() => {
  let list = tickets.value.filter(t => !t.isDeleted)

  if (activeStatus.value === 'open')   list = list.filter(t => t.status !== 5 && t.status !== 6)
  if (activeStatus.value === 'solved') list = list.filter(t => t.status === 5)
  if (activeStatus.value === 'closed') list = list.filter(t => t.status === 6)

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(t =>
      t.title.toLowerCase().includes(q) || String(t.id).includes(q),
    )
  }
  return list
})

const cleanDescription = computed(() => {
  if (!selectedTicket.value?.description) return ''
  const stripped = cleanHtml(selectedTicket.value.description)
  // Ignorer les descriptions vides type "<p><br /></p>"
  return stripped.replace(/\n/g, '').trim() ? stripped : ''
})

// ─── Chargement de la liste ───────────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    tickets.value = await fetchAllTickets()
  } catch (e) {
    console.error('Erreur chargement tickets :', e)
  } finally {
    loading.value = false
  }
}

// ─── Fiche détail ─────────────────────────────────────────────────────────────
async function openFiche(id: number) {
  if (selectedId.value === id) {
    closeFiche()
    return
  }
  selectedId.value   = id
  selectedTicket.value = null
  followups.value    = []
  ficheLoading.value = true
  try {
    const [ticket, fups] = await Promise.all([
      fetchTicketById(id),
      fetchTicketFollowups(id),
    ])
    selectedTicket.value = ticket
    followups.value      = fups
  } catch (e) {
    console.error('Erreur fiche ticket :', e)
  } finally {
    ficheLoading.value = false
  }
}

function closeFiche() {
  selectedId.value     = null
  selectedTicket.value = null
  followups.value      = []
}

// ─── Modal création ───────────────────────────────────────────────────────────
function openModal() {
  editId.value = null
  form.value   = {
    name: '', content: '', type: 1, status: 1, priority: 3, actiontimeHours: 0,
    itilcategoriesId: 0, usersIdRecipient: 0, locationsId: 0, timeToResolve: '',
  }
  createError.value = ''
  showModal.value   = true
  loadOptions()
}

function openEdit(ticket: Ticket) {
  editId.value = ticket.id
  form.value   = {
    name:             ticket.title,
    content:          cleanHtml(ticket.description),
    type:             ticket.type,
    status:           ticket.status,
    priority:         ticket.priority,
    actiontimeHours:  ticket.actiontime ? +(ticket.actiontime / 3600).toFixed(2) : 0,
    itilcategoriesId: ticket.categoryId  || 0,
    usersIdRecipient: ticket.requesterId || 0,
    locationsId:      ticket.locationId  || 0,
    timeToResolve:    ticket.timeToResolve
      ? ticket.timeToResolve.replace(' ', 'T').substring(0, 16)
      : '',
  }
  createError.value = ''
  showModal.value   = true
  loadOptions()
}

function closeModal() {
  if (creating.value) return
  showModal.value = false
}

async function submitTicket() {
  if (!form.value.name.trim() || !form.value.content.trim()) return
  creating.value    = true
  createError.value = ''
  try {
    const payload = {
      name:             form.value.name.trim(),
      content:          form.value.content.trim(),
      type:             form.value.type,
      status:           form.value.status,
      priority:         form.value.priority,
      urgency:          form.value.priority,
      actiontime:       Math.round((form.value.actiontimeHours || 0) * 3600),
      itilcategoriesId: form.value.itilcategoriesId || undefined,
      usersIdRecipient: form.value.usersIdRecipient || undefined,
      locationsId:      form.value.locationsId      || undefined,
      timeToResolve:    form.value.timeToResolve
        ? form.value.timeToResolve.replace('T', ' ') + ':00'
        : undefined,
    }

    if (editId.value !== null) {
      await updateTicket(editId.value, payload)
      showModal.value = false
      const id = editId.value
      await load()
      await openFiche(id)
    } else {
      const { id } = await createTicket(payload)
      showModal.value = false
      await load()
      await openFiche(id)
    }
  } catch (e: unknown) {
    createError.value = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde'
  } finally {
    creating.value = false
  }
}

// ─── Helpers affichage ────────────────────────────────────────────────────────
function formatDate(d?: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatDateTime(d?: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function categoryLabel(id: number): string {
  return optCategories.value.find(c => c.id === id)?.label ?? `#${id}`
}
function userLabel(id: number): string {
  return optUsers.value.find(u => u.id === id)?.label ?? `Utilisateur #${id}`
}
function locationLabel(id: number): string {
  return optLocations.value.find(l => l.id === id)?.label ?? `#${id}`
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function cleanHtml(html: string): string {
  if (!html) return '—'
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  1: 'Nouveau', 2: 'En cours', 3: 'Planifié', 4: 'En attente', 5: 'Résolu', 6: 'Fermé',
}
function statusLabel(s: TicketStatus): string {
  return STATUS_LABELS[s] ?? 'Inconnu'
}
function statusClass(s: TicketStatus): string {
  const map: Record<TicketStatus, string> = {
    1: 'badge-blue', 2: 'badge-orange', 3: 'badge-orange',
    4: 'badge-gray',  5: 'badge-green',  6: 'badge-gray',
  }
  return map[s] ?? 'badge-gray'
}

function priorityClass(p: TicketPriority): string {
  if (p >= 5) return 'prio-high'
  if (p >= 3) return 'prio-medium'
  return 'prio-low'
}

onMounted(load)
</script>

<style scoped>
@import '../../styles/TicketsView.css';
</style>
