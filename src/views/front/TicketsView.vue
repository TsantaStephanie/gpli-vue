<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchAllTickets, fetchTicketItems } from '@/services/api/ticketService'
import type { Ticket, TicketStatus } from '@/models/Ticket'

const router = useRouter()
const loading    = ref(false)
const loadError  = ref('')
const allTickets = ref<Ticket[]>([])
const selected   = ref<Ticket | null>(null)
const linkedItems = ref<any[]>([])
const loadingItems = ref(false)
// ── Chargement ────────────────────────────────────────────────
async function load() {
  loading.value = true
  loadError.value = ''
  try {
    allTickets.value = await fetchAllTickets()
  } catch (e: any) {
    loadError.value = e.message || 'Impossible de charger les tickets.'
    console.error(e)
  } finally {
    loading.value = false
  }
}

// ── Recherche multicritère ────────────────────────────────────
const searchText   = ref('')
const searchType   = ref('')   // '' | '1' (Incident) | '2' (Demande)
const searchStatus = ref('')   // '' | '1'…'6'

const hasSearch = computed(() =>
  searchText.value.trim() !== '' || searchType.value !== '' || searchStatus.value !== ''
)

function resetSearch() {
  searchText.value   = ''
  searchType.value   = ''
  searchStatus.value = ''
}

const tickets = computed(() => {
  let result = allTickets.value

  const t = searchText.value.trim().toLowerCase()
  if (t) result = result.filter(tk => tk.title.toLowerCase().includes(t))

  if (searchType.value)   result = result.filter(tk => String(tk.type)   === searchType.value)
  if (searchStatus.value) result = result.filter(tk => String(tk.status) === searchStatus.value)

  return result
})

// ── Sélection / modal ─────────────────────────────────────────
async function openTicket(ticket: Ticket) {
  selected.value = ticket
  linkedItems.value = []
  loadingItems.value = true
  try {
    linkedItems.value = await fetchTicketItems(ticket.id) || []
  } catch {}
  finally { loadingItems.value = false }
}

function closeModal() { selected.value = null }

// ── Helpers d'affichage ───────────────────────────────────────
const STATUS_META: Record<number, { label: string; color: string }> = {
  1: { label: 'Nouveau',     color: 'blue'   },
  2: { label: 'En cours',    color: 'orange' },
  3: { label: 'Planifié',    color: 'cyan'   },
  4: { label: 'En attente',  color: 'gray'   },
  5: { label: 'Résolu',      color: 'green'  },
  6: { label: 'Fermé',       color: 'slate'  },
}

function statusMeta(status: TicketStatus) {
  return STATUS_META[status] ?? { label: 'Inconnu', color: 'gray' }
}

function typeMeta(type: number) {
  return type === 1
    ? { label: 'Incident', color: 'red'  }
    : { label: 'Demande',  color: 'blue' }
}

function relativeDate(dateStr?: string): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)   return "À l'instant"
  if (mins  < 60)  return `il y a ${mins} min`
  if (hours < 24)  return `il y a ${hours}h`
  if (days  < 30)  return `il y a ${days}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatFull(dateStr?: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

onMounted(load)
</script>

<template>
  <div class="portal-page">

    <!-- ── Hero ──────────────────────────────────────────────── -->
    <div class="portal-hero">
      <div class="hero-text">
        <h1>Mes tickets</h1>
        <p>Suivez vos demandes et incidents en temps réel</p>
      </div>
      <button class="btn-cta" @click="router.push('/front/tickets/create')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nouvelle demande
      </button>
    </div>

    <!-- ── Recherche multicritère ──────────────────────────────── -->
    <div class="search-block">
      <div class="search-row">

        <!-- Texte libre -->
        <div class="search-input-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            v-model="searchText"
            type="text"
            placeholder="Rechercher dans les tickets…"
            class="search-input"
          />
          <button v-if="searchText" class="input-clear" @click="searchText = ''">×</button>
        </div>

        <!-- Type -->
        <div class="select-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <select v-model="searchType" class="search-select">
            <option value="">Tous les types</option>
            <option value="1">Incident</option>
            <option value="2">Demande</option>
          </select>
        </div>

        <!-- Statut -->
        <div class="select-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <select v-model="searchStatus" class="search-select">
            <option value="">Tous les statuts</option>
            <option value="1">Nouveau</option>
            <option value="2">En cours</option>
            <option value="3">Planifié</option>
            <option value="4">En attente</option>
            <option value="5">Résolu</option>
            <option value="6">Fermé</option>
          </select>
        </div>

        <!-- Actions -->
        <div class="search-actions">
          <button v-if="hasSearch" class="btn-reset" @click="resetSearch">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Réinitialiser
          </button>
          <button class="btn-refresh" @click="load" :disabled="loading">
            <svg :class="{ spin: loading }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Actualiser
          </button>
        </div>
      </div>

      <!-- Compteur de résultats -->
      <div v-if="!loading && allTickets.length" class="search-count">
        <span class="count-num">{{ tickets.length }}</span>
        ticket{{ tickets.length !== 1 ? 's' : '' }}
        <template v-if="hasSearch">
          sur {{ allTickets.length }} au total
          <span class="count-sep">·</span>
          <button class="count-reset" @click="resetSearch">tout afficher</button>
        </template>
      </div>
    </div>

    <!-- ── Erreur ───────────────────────────────────────────────── -->
    <div v-if="loadError" class="load-error">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {{ loadError }}
      <button class="err-retry" @click="load">Réessayer</button>
    </div>

    <!-- ── Grille de cartes ───────────────────────────────────── -->
    <div v-if="loading" class="loading-grid">
      <div v-for="n in 6" :key="n" class="skeleton-card"></div>
    </div>

    <div v-else-if="tickets.length" class="tickets-grid">
      <button
        v-for="ticket in tickets" :key="ticket.id"
        class="ticket-card"
        @click="openTicket(ticket)"
      >
        <div class="card-top">
          <span class="type-chip" :class="`chip-${typeMeta(ticket.type).color}`">
            {{ typeMeta(ticket.type).label }}
          </span>
          <span class="ticket-num">#{{ ticket.id }}</span>
        </div>

        <h3 class="card-title">{{ ticket.title }}</h3>

        <div class="card-bottom">
          <span class="status-chip" :class="`chip-${statusMeta(ticket.status).color}`">
            <span class="chip-dot"></span>
            {{ statusMeta(ticket.status).label }}
          </span>
          <span class="card-date">{{ relativeDate(ticket.createdAt) }}</span>
        </div>
      </button>
    </div>

    <div v-else class="empty-portal">
      <div class="empty-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
        </svg>
      </div>
      <p class="empty-title">Aucun ticket trouvé</p>
      <p class="empty-sub">
        <template v-if="hasSearch">Aucun ticket ne correspond à votre recherche.</template>
        <template v-else>Vous n'avez pas encore de ticket ouvert.</template>
      </p>
      <button v-if="hasSearch" class="btn-ghost" @click="resetSearch">
        Réinitialiser la recherche
      </button>
      <button v-else class="btn-cta" @click="router.push('/front/tickets/create')">
        Créer mon premier ticket
      </button>
    </div>

  <!-- ── Modal détail (Teleport à l'intérieur du root pour éviter le warning Transition) -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="selected" class="modal-overlay" @click.self="closeModal">
        <div class="modal-card">

          <div class="modal-header">
            <div class="modal-chips">
              <span class="type-chip" :class="`chip-${typeMeta(selected.type).color}`">
                {{ typeMeta(selected.type).label }}
              </span>
              <span class="status-chip" :class="`chip-${statusMeta(selected.status).color}`">
                <span class="chip-dot"></span>
                {{ statusMeta(selected.status).label }}
              </span>
              <span class="ticket-num">#{{ selected.id }}</span>
            </div>
            <button class="modal-close" @click="closeModal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <h2 class="modal-title">{{ selected.title }}</h2>

          <div class="modal-meta">
            <div class="meta-item">
              <span class="meta-label">Créé</span>
              <span class="meta-val">{{ formatFull(selected.createdAt) }}</span>
            </div>
            <div class="meta-item" v-if="selected.solvedAt">
              <span class="meta-label">Résolu</span>
              <span class="meta-val">{{ formatFull(selected.solvedAt) }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Priorité</span>
              <span class="meta-val">{{ selected.priorityLabel }}</span>
            </div>
          </div>

          <div class="modal-body" v-if="selected.description">
            <p class="section-label">Description</p>
            <div class="description-box" v-html="selected.description"></div>
          </div>

          <div class="modal-body" v-if="loadingItems || linkedItems.length">
            <p class="section-label">Matériels liés</p>
            <div v-if="loadingItems" class="items-loading">Chargement…</div>
            <div v-else class="linked-items">
              <span v-for="item in linkedItems" :key="item.id" class="item-chip">
                {{ item.itemtype }} #{{ item.items_id }}
              </span>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-ghost" @click="closeModal">Fermer</button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</div>
</template>

<style scoped>
/* ── Page ─────────────────────────────────────────────────── */
.portal-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 2rem;
}

/* ── Hero ─────────────────────────────────────────────────── */
.portal-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero-text h1 {
  font-size: 1.625rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -.03em;
  margin: 0;
}

.hero-text p {
  font-size: .875rem;
  color: #64748b;
  margin: .25rem 0 0;
}

.btn-cta {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  padding: .625rem 1.25rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: .875rem;
  cursor: pointer;
  transition: background .15s, box-shadow .15s, transform .1s;
}
.btn-cta:hover { background: #2563eb; box-shadow: 0 4px 12px rgba(59,130,246,.3); transform: translateY(-1px); }

/* ── Recherche multicritère ───────────────────────────────── */
.search-block {
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

.search-row {
  display: flex;
  align-items: center;
  gap: .5rem;
  flex-wrap: wrap;
}

/* Champ texte */
.search-input-wrap {
  display: flex;
  align-items: center;
  gap: .375rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  padding: 0 .75rem;
  height: 36px;
  color: #94a3b8;
  flex: 1;
  min-width: 200px;
  transition: border-color .15s, box-shadow .15s;
}
.search-input-wrap:focus-within {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(59,130,246,.08);
}

.search-input {
  border: none;
  outline: none;
  font-size: .8125rem;
  color: #0f172a;
  background: transparent;
  flex: 1;
  min-width: 0;
}
.search-input::placeholder { color: #94a3b8; }

.input-clear {
  background: none;
  border: none;
  font-size: 1rem;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color .1s;
  flex-shrink: 0;
}
.input-clear:hover { color: #475569; }

/* Selects */
.select-wrap {
  display: flex;
  align-items: center;
  gap: .375rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  padding: 0 .625rem 0 .75rem;
  height: 36px;
  color: #94a3b8;
  transition: border-color .15s;
}
.select-wrap:focus-within {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(59,130,246,.08);
}

.search-select {
  border: none;
  outline: none;
  background: transparent;
  font-size: .8125rem;
  color: #334155;
  cursor: pointer;
  appearance: none;
  padding-right: .5rem;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0 center;
}

/* Boutons d'action */
.search-actions {
  display: flex;
  align-items: center;
  gap: .375rem;
  flex-shrink: 0;
}

.btn-reset {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  padding: .4rem .75rem;
  background: #fff;
  border: 1px solid #fca5a5;
  border-radius: 9px;
  font-size: .8125rem;
  font-weight: 500;
  color: #ef4444;
  cursor: pointer;
  transition: background .15s;
}
.btn-reset:hover { background: #fef2f2; }

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: .375rem;
  padding: .4rem .875rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  font-size: .8125rem;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: background .15s;
}
.btn-refresh:hover:not(:disabled) { background: #f8fafc; }
.btn-refresh:disabled { opacity: .5; cursor: not-allowed; }
.btn-refresh svg.spin { animation: spin .8s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

/* Compteur de résultats */
.search-count {
  font-size: .8125rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: .375rem;
}

.count-num {
  font-weight: 700;
  color: #334155;
}

.count-sep { color: #cbd5e1; }

.count-reset {
  background: none;
  border: none;
  font-size: .8125rem;
  color: #3b82f6;
  cursor: pointer;
  padding: 0;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.count-reset:hover { color: #2563eb; }

/* ── Grille de cartes ─────────────────────────────────────── */
.tickets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: .875rem;
}

.ticket-card {
  background: #fff;
  border: 1px solid #e8edf2;
  border-radius: 14px;
  padding: 1.125rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: .75rem;
  cursor: pointer;
  text-align: left;
  transition: box-shadow .15s, transform .1s, border-color .15s;
}
.ticket-card:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,.08);
  border-color: #c7d2fe;
  transform: translateY(-2px);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ticket-num {
  font-size: .75rem;
  font-weight: 700;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.card-title {
  font-size: .9375rem;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.card-date {
  font-size: .75rem;
  color: #94a3b8;
}

/* ── Chips de type & statut ───────────────────────────────── */
.type-chip, .status-chip {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  font-size: .6875rem;
  font-weight: 700;
  padding: .2rem .5rem;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.chip-red    { background: #fee2e2; color: #b91c1c; }
.chip-blue   { background: #dbeafe; color: #1d4ed8; }
.chip-orange { background: #ffedd5; color: #c2410c; }
.chip-green  { background: #dcfce7; color: #15803d; }
.chip-cyan   { background: #cffafe; color: #0e7490; }
.chip-gray   { background: #f1f5f9; color: #475569; }
.chip-slate  { background: #f1f5f9; color: #475569; }

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

/* ── Skeleton loader ──────────────────────────────────────── */
.loading-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: .875rem;
}

.skeleton-card {
  height: 130px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e8edf2 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 14px;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Empty state ──────────────────────────────────────────── */
.empty-portal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .875rem;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  width: 72px;
  height: 72px;
  background: #f1f5f9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

.empty-title { font-size: 1.125rem; font-weight: 700; color: #334155; margin: 0; }
.empty-sub   { font-size: .875rem; color: #94a3b8; margin: 0; }

/* ── Modal ────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, .45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

@media (min-width: 640px) {
  .modal-overlay { align-items: center; }
}

.modal-card {
  background: #fff;
  border-radius: 20px;
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  box-shadow: 0 24px 60px rgba(0,0,0,.2);
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.modal-chips { display: flex; align-items: center; gap: .375rem; flex-wrap: wrap; }

.modal-close {
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  cursor: pointer;
  flex-shrink: 0;
  transition: background .15s;
}
.modal-close:hover { background: #e2e8f0; color: #0f172a; }

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.4;
  margin: 0;
}

.modal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: .75rem 1.5rem;
  padding: .875rem 1rem;
  background: #f8fafc;
  border-radius: 10px;
}

.meta-item { display: flex; flex-direction: column; gap: .125rem; }
.meta-label { font-size: .6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; }
.meta-val   { font-size: .875rem; font-weight: 500; color: #334155; }

.modal-body { display: flex; flex-direction: column; gap: .5rem; }

.section-label {
  font-size: .75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #94a3b8;
  margin: 0;
}

.description-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: .875rem 1rem;
  font-size: .875rem;
  color: #334155;
  line-height: 1.6;
  max-height: 180px;
  overflow-y: auto;
}

.linked-items { display: flex; flex-wrap: wrap; gap: .375rem; }

.item-chip {
  background: #f1f5f9;
  color: #475569;
  font-size: .75rem;
  font-weight: 600;
  padding: .25rem .625rem;
  border-radius: 6px;
}

.items-loading { font-size: .875rem; color: #94a3b8; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: .25rem;
  border-top: 1px solid #f1f5f9;
}

.btn-ghost {
  padding: .5rem 1.25rem;
  border: 1px solid #e2e8f0;
  background: none;
  border-radius: 8px;
  font-size: .875rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: background .15s;
}
.btn-ghost:hover { background: #f8fafc; }

/* ── Transition modal ─────────────────────────────────────── */
.modal-enter-active, .modal-leave-active { transition: opacity .2s, transform .2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: translateY(16px); }

/* ── Bannière d'erreur ────────────────────────────────────── */
.load-error {
  display: flex;
  align-items: center;
  gap: .625rem;
  padding: .75rem 1rem;
  background: #fef2f2;
  border: 1px solid rgba(239,68,68,.2);
  border-left: 3px solid #ef4444;
  border-radius: 10px;
  font-size: .875rem;
  color: #b91c1c;
}
.err-retry {
  margin-left: auto;
  padding: .3rem .75rem;
  border: 1px solid rgba(239,68,68,.3);
  background: none;
  border-radius: 6px;
  font-size: .8125rem;
  font-weight: 600;
  color: #b91c1c;
  cursor: pointer;
  transition: background .15s;
}
.err-retry:hover { background: rgba(239,68,68,.08); }
</style>
