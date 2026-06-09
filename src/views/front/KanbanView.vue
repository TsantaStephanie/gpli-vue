a<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchAllTickets, fetchTicketItems } from '@/services/api/ticketService'
import { glpiClient } from '@/services/api/glpiClient'
import type { Ticket, TicketStatus } from '@/models/Ticket'

const router  = useRouter()
const loading = ref(true)
const loadError = ref('')
const allTickets = ref<Ticket[]>([])

// ── Colonnes Kanban ─────────────────────────────────────────────
const COLUMNS = [
  {
    id: 'new',
    label: 'Nouveau',
    statuses: [1] as number[],
    targetStatus: 1,
    color: 'blue',
    needsDialog: false,
  },
  {
    id: 'progress',
    label: 'En cours',
    statuses: [2, 3, 4] as number[],
    targetStatus: 2,
    color: 'orange',
    needsDialog: false,
  },
  {
    id: 'done',
    label: 'Terminé',
    statuses: [5, 6] as number[],
    targetStatus: 5,
    color: 'green',
    needsDialog: true,   // Demande une note de résolution
  },
] as const

type ColumnId = typeof COLUMNS[number]['id']

function colTickets(col: typeof COLUMNS[number]) {
  return allTickets.value.filter(t => (col.statuses as number[]).includes(t.status))
}

// ── Chargement ──────────────────────────────────────────────────
async function load() {
  loading.value = true
  loadError.value = ''
  try {
    allTickets.value = await fetchAllTickets()
  } catch (e: any) {
    loadError.value = e.message || 'Impossible de charger les tickets.'
  } finally {
    loading.value = false
  }
}

// ── Drag & Drop ─────────────────────────────────────────────────
const dragging        = ref<Ticket | null>(null)
const draggingFromCol = ref<ColumnId | null>(null)
const dragOverCol     = ref<ColumnId | null>(null)

function onDragStart(ticket: Ticket, colId: ColumnId) {
  dragging.value        = ticket
  draggingFromCol.value = colId
}

function onDragEnd() {
  dragging.value        = null
  draggingFromCol.value = null
  dragOverCol.value     = null
}

function onDragOver(e: DragEvent, colId: ColumnId) {
  e.preventDefault()
  dragOverCol.value = colId
}

function onDragLeave() {
  dragOverCol.value = null
}

function onDrop(e: DragEvent, col: typeof COLUMNS[number]) {
  e.preventDefault()
  dragOverCol.value = null
  if (!dragging.value || draggingFromCol.value === col.id) {
    dragging.value = null
    return
  }
  const ticket = dragging.value
  dragging.value = null

  if (col.needsDialog) {
    openStatusDialog(ticket, col.targetStatus)
  } else {
    applyStatusChange(ticket, col.targetStatus)
  }
}

// ── Mise à jour statut ──────────────────────────────────────────
async function applyStatusChange(ticket: Ticket, newStatus: number, note?: string) {
  const idx = allTickets.value.findIndex(t => t.id === ticket.id)
  const prev = idx !== -1 ? { ...allTickets.value[idx] } : null

  // Mise à jour optimiste
  if (idx !== -1) {
    allTickets.value[idx] = { ...allTickets.value[idx], status: newStatus as TicketStatus }
  }

  try {
    await glpiClient.put(`/Ticket/${ticket.id}`, { input: { status: newStatus } })

    // Si note de résolution → ITILSolution
    if (note?.trim()) {
      await glpiClient.post('/ITILSolution', {
        input: { items_id: ticket.id, itemtype: 'Ticket', content: note.trim() },
      }).catch(() => { /* silencieux si refusé */ })
    }
  } catch (e) {
    // Rollback
    if (prev && idx !== -1) allTickets.value[idx] = prev
    console.error('Erreur mise à jour statut :', e)
  }
}

// ── Dialog de confirmation (Terminé) ────────────────────────────
const showDialog    = ref(false)
const dialogTicket  = ref<Ticket | null>(null)
const dialogStatus  = ref(5)
const resolutionNote = ref('')

function openStatusDialog(ticket: Ticket, status: number) {
  dialogTicket.value  = ticket
  dialogStatus.value  = status
  resolutionNote.value = ''
  showDialog.value    = true
}

function cancelDialog() {
  showDialog.value   = false
  dialogTicket.value = null
}

async function confirmDialog() {
  if (!dialogTicket.value) return
  await applyStatusChange(dialogTicket.value, dialogStatus.value, resolutionNote.value)
  showDialog.value   = false
  dialogTicket.value = null
}

// ── Modal détail ticket ─────────────────────────────────────────
const selectedTicket  = ref<Ticket | null>(null)
const linkedItems     = ref<any[]>([])
const loadingItems    = ref(false)

async function openDetail(ticket: Ticket) {
  selectedTicket.value = ticket
  linkedItems.value    = []
  loadingItems.value   = true
  try {
    linkedItems.value = (await fetchTicketItems(ticket.id)) || []
  } catch { /* ignore */ }
  finally { loadingItems.value = false }
}

function closeDetail() { selectedTicket.value = null }

// ── Helpers d'affichage ─────────────────────────────────────────
const TYPE_META: Record<number, { label: string; color: string }> = {
  1: { label: 'Incident', color: 'red'  },
  2: { label: 'Demande',  color: 'blue' },
}

const PRIORITY_META: Record<number, { label: string; color: string }> = {
  1: { label: 'Très basse', color: 'gray'   },
  2: { label: 'Basse',      color: 'green'  },
  3: { label: 'Moyenne',    color: 'yellow' },
  4: { label: 'Haute',      color: 'orange' },
  5: { label: 'Très haute', color: 'red'    },
  6: { label: 'Majeure',    color: 'red'    },
}

const STATUS_META: Record<number, { label: string; color: string }> = {
  1: { label: 'Nouveau',    color: 'blue'   },
  2: { label: 'En cours',   color: 'orange' },
  3: { label: 'Planifié',   color: 'cyan'   },
  4: { label: 'En attente', color: 'gray'   },
  5: { label: 'Résolu',     color: 'green'  },
  6: { label: 'Fermé',      color: 'slate'  },
}

function typeMeta(t: number)     { return TYPE_META[t]     ?? { label: 'Inconnu', color: 'gray' } }
function priorityMeta(p: number) { return PRIORITY_META[p] ?? { label: '-',       color: 'gray' } }
function statusMeta(s: number)   { return STATUS_META[s]   ?? { label: 'Inconnu', color: 'gray' } }

function relativeDate(d?: string) {
  if (!d) return '—'
  const diff  = Date.now() - new Date(d).getTime()
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  const mins  = Math.floor(diff / 60_000)
  if (mins  < 1)  return "à l'instant"
  if (mins  < 60) return `il y a ${mins} min`
  if (hours < 24) return `il y a ${hours}h`
  if (days  < 30) return `il y a ${days}j`
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function formatFull(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(load)
</script>

<template>
  <div class="kanban-page">

    <!-- ── En-tête ─────────────────────────────────────────────── -->
    <div class="kanban-header">
      <div>
        <h1 class="kanban-title">Tableau Kanban</h1>
        <p class="kanban-sub">Glissez les tickets d'une colonne à l'autre pour changer leur statut</p>
      </div>
      <div class="kanban-actions">
        <button class="btn-refresh" @click="load" :disabled="loading">
          <svg :class="{ spin: loading }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Actualiser
        </button>
        <button class="btn-cta" @click="router.push('/front/tickets/create')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nouveau ticket
        </button>
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

    <!-- ── Board Kanban ─────────────────────────────────────────── -->
    <div class="kanban-board">
      <div
        v-for="col in COLUMNS" :key="col.id"
        class="kanban-col"
        :class="[`col-${col.color}`, { 'drag-over': dragOverCol === col.id }]"
        @dragover="onDragOver($event, col.id)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, col)"
      >
        <!-- En-tête colonne -->
        <div class="col-header">
          <div class="col-title-wrap">
            <span class="col-dot" :class="`dot-${col.color}`"></span>
            <span class="col-title">{{ col.label }}</span>
          </div>
          <span class="col-count">{{ colTickets(col).length }}</span>
        </div>

        <!-- Cartes -->
        <div class="col-cards">
          <!-- Skeleton loader -->
          <template v-if="loading">
            <div v-for="n in 2" :key="n" class="card-skeleton"></div>
          </template>

          <!-- Vraies cartes -->
          <template v-else>
            <div
              v-for="ticket in colTickets(col)"
              :key="ticket.id"
              class="kanban-card"
              :class="{ 'card-dragging': dragging?.id === ticket.id }"
              draggable="true"
              @dragstart="onDragStart(ticket, col.id)"
              @dragend="onDragEnd"
              @click="openDetail(ticket)"
            >
              <!-- Drag handle -->
              <div class="drag-handle" title="Glisser pour déplacer">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="5"  r="1.5"/><circle cx="15" cy="5"  r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                </svg>
              </div>

              <div class="card-content">
                <!-- Chips -->
                <div class="card-chips">
                  <span class="chip" :class="`chip-${typeMeta(ticket.type).color}`">
                    {{ typeMeta(ticket.type).label }}
                  </span>
                  <span class="chip chip-priority" :class="`chip-${priorityMeta(ticket.priority ?? 3).color}`">
                    P{{ ticket.priority ?? 3 }}
                  </span>
                </div>

                <!-- Titre -->
                <p class="card-title">{{ ticket.title }}</p>

                <!-- Pied de carte -->
                <div class="card-footer">
                  <span class="card-id">#{{ ticket.id }}</span>
                  <span class="card-date">{{ relativeDate(ticket.createdAt) }}</span>
                </div>
              </div>
            </div>

            <!-- Zone vide -->
            <div v-if="colTickets(col).length === 0" class="col-empty">
              Aucun ticket
            </div>
          </template>
        </div>

        <button
          v-if="col.id === 'new'"
          class="col-add-btn"
          @click="router.push('/front/tickets/create')"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter 1 ticket
        </button>
      </div>
    </div>


    <!-- ═══════════════════════════════════════════════════════════
         MODAL DÉTAIL TICKET
         ═══════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="selectedTicket" class="modal-overlay" @click.self="closeDetail">
          <div class="modal-card">

            <div class="modal-head">
              <div class="modal-chips">
                <span class="chip" :class="`chip-${typeMeta(selectedTicket.type).color}`">
                  {{ typeMeta(selectedTicket.type).label }}
                </span>
                <span class="chip" :class="`chip-${statusMeta(selectedTicket.status).color}`">
                  <span class="chip-dot"></span>
                  {{ statusMeta(selectedTicket.status).label }}
                </span>
                <span class="ticket-id">#{{ selectedTicket.id }}</span>
              </div>
              <button class="modal-close" @click="closeDetail">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <h2 class="modal-title">{{ selectedTicket.title }}</h2>

            <div class="modal-meta">
              <div class="meta-item">
                <span class="meta-label">Créé</span>
                <span class="meta-val">{{ formatFull(selectedTicket.createdAt) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Priorité</span>
                <span class="meta-val">{{ priorityMeta(selectedTicket.priority ?? 3).label }}</span>
              </div>
              <div class="meta-item" v-if="selectedTicket.solvedAt">
                <span class="meta-label">Résolu</span>
                <span class="meta-val">{{ formatFull(selectedTicket.solvedAt) }}</span>
              </div>
            </div>

            <div v-if="selectedTicket.description" class="modal-section">
              <p class="section-label">Description</p>
              <div class="description-box" v-html="selectedTicket.description"></div>
            </div>

            <div v-if="loadingItems || linkedItems.length" class="modal-section">
              <p class="section-label">Matériels liés</p>
              <div v-if="loadingItems" class="items-loading">Chargement…</div>
              <div v-else class="linked-items">
                <span v-for="item in linkedItems" :key="item.id" class="item-chip">
                  {{ item.itemtype }} #{{ item.items_id }}
                </span>
              </div>
            </div>

            <div class="modal-foot">
              <button class="btn-ghost" @click="closeDetail">Fermer</button>
              <button
                class="btn-cta"
                @click="closeDetail(); router.push(`/tickets/${selectedTicket!.id}/edit`)"
              >
                Modifier
              </button>
            </div>

          </div>
        </div>
      </Transition>
    </Teleport>


    <!-- ═══════════════════════════════════════════════════════════
         DIALOG CONFIRMATION STATUT "TERMINÉ"
         ═══════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDialog" class="modal-overlay" @click.self="cancelDialog">
          <div class="dialog-card">

            <div class="dialog-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>

            <h3 class="dialog-title">Marquer comme terminé ?</h3>
            <p class="dialog-sub">
              Le ticket <strong>#{{ dialogTicket?.id }}</strong> sera marqué comme résolu.
              Vous pouvez ajouter une note de résolution (optionnel).
            </p>

            <div class="dialog-field">
              <label>Note de résolution</label>
              <textarea
                v-model="resolutionNote"
                rows="3"
                placeholder="Décrivez la solution apportée…"
              ></textarea>
            </div>

            <div class="dialog-actions">
              <button class="btn-ghost" @click="cancelDialog">Annuler</button>
              <button class="btn-confirm" @click="confirmDialog">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Confirmer
              </button>
            </div>

          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
/* ── Page ──────────────────────────────────────────────────────── */
.kanban-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 2rem;
  min-height: 0;
}

/* ── Header ────────────────────────────────────────────────────── */
.kanban-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.kanban-title {
  font-size: 1.625rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -.03em;
  margin: 0;
}

.kanban-sub {
  font-size: .875rem;
  color: #64748b;
  margin: .25rem 0 0;
}

.kanban-actions {
  display: flex;
  align-items: center;
  gap: .5rem;
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: .375rem;
  padding: .5rem 1rem;
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

.btn-cta {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: .5rem 1.125rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 9px;
  font-size: .8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s, box-shadow .15s, transform .1s;
}
.btn-cta:hover { background: #2563eb; box-shadow: 0 4px 12px rgba(59,130,246,.3); transform: translateY(-1px); }

/* ── Erreur ────────────────────────────────────────────────────── */
.load-error {
  display: flex;
  align-items: center;
  gap: .625rem;
  padding: .75rem 1rem;
  background: #fef2f2;
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
}
.err-retry:hover { background: rgba(239,68,68,.08); }

/* ── Board ─────────────────────────────────────────────────────── */
.kanban-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  align-items: start;
}

/* ── Colonne ───────────────────────────────────────────────────── */
.kanban-col {
  background: #f8fafc;
  border: 1px solid #e8edf2;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 0;
  transition: box-shadow .15s, border-color .15s;
  min-height: 200px;
}

.kanban-col.drag-over {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(59,130,246,.12);
}

/* Accents couleur par colonne */
.col-blue   { border-top: 3px solid #3b82f6; }
.col-orange { border-top: 3px solid #f59e0b; }
.col-green  { border-top: 3px solid #22c55e; }

/* ── Header colonne ────────────────────────────────────────────── */
.col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .875rem 1rem .75rem;
}

.col-title-wrap {
  display: flex;
  align-items: center;
  gap: .5rem;
}

.col-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-blue   { background: #3b82f6; }
.dot-orange { background: #f59e0b; }
.dot-green  { background: #22c55e; }

.col-title {
  font-size: .875rem;
  font-weight: 700;
  color: #1e293b;
}

.col-count {
  font-size: .75rem;
  font-weight: 700;
  background: #e2e8f0;
  color: #475569;
  padding: .15rem .5rem;
  border-radius: 100px;
  min-width: 22px;
  text-align: center;
}

/* ── Cartes ────────────────────────────────────────────────────── */
.col-cards {
  display: flex;
  flex-direction: column;
  gap: .5rem;
  padding: 0 .75rem;
  min-height: 60px;
}

.kanban-card {
  background: #fff;
  border: 1px solid #e8edf2;
  border-radius: 10px;
  padding: .75rem .875rem;
  display: flex;
  align-items: flex-start;
  gap: .5rem;
  cursor: pointer;
  transition: box-shadow .15s, border-color .15s, transform .1s, opacity .15s;
  position: relative;
}

.kanban-card:hover {
  box-shadow: 0 4px 14px rgba(0,0,0,.08);
  border-color: #c7d2fe;
  transform: translateY(-1px);
}

.kanban-card.card-dragging {
  opacity: .45;
  transform: rotate(1.5deg) scale(.97);
}

.drag-handle {
  color: #cbd5e1;
  cursor: grab;
  flex-shrink: 0;
  margin-top: .125rem;
  transition: color .12s;
}
.kanban-card:hover .drag-handle { color: #94a3b8; }
.drag-handle:active { cursor: grabbing; }

.card-content {
  display: flex;
  flex-direction: column;
  gap: .4rem;
  flex: 1;
  min-width: 0;
}

.card-chips {
  display: flex;
  align-items: center;
  gap: .3rem;
  flex-wrap: wrap;
}

.card-title {
  font-size: .8125rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-id {
  font-size: .6875rem;
  font-weight: 700;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.card-date {
  font-size: .6875rem;
  color: #94a3b8;
}

/* ── Chips ─────────────────────────────────────────────────────── */
.chip {
  display: inline-flex;
  align-items: center;
  gap: .25rem;
  font-size: .625rem;
  font-weight: 700;
  padding: .15rem .45rem;
  border-radius: 5px;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.chip-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.chip-red    { background: #fee2e2; color: #b91c1c; }
.chip-blue   { background: #dbeafe; color: #1d4ed8; }
.chip-orange { background: #ffedd5; color: #c2410c; }
.chip-green  { background: #dcfce7; color: #15803d; }
.chip-yellow { background: #fef9c3; color: #854d0e; }
.chip-cyan   { background: #cffafe; color: #0e7490; }
.chip-gray   { background: #f1f5f9; color: #475569; }
.chip-slate  { background: #f1f5f9; color: #475569; }

/* ── Zone vide ─────────────────────────────────────────────────── */
.col-empty {
  padding: 1.5rem;
  text-align: center;
  font-size: .8125rem;
  color: #cbd5e1;
  font-style: italic;
}

/* ── Skeleton ──────────────────────────────────────────────────── */
.card-skeleton {
  height: 88px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e8edf2 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 10px;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ── Bouton ajouter ────────────────────────────────────────────── */
.col-add-btn {
  display: flex;
  align-items: center;
  gap: .375rem;
  width: calc(100% - 1.5rem);
  margin: .625rem .75rem .875rem;
  padding: .5rem .875rem;
  background: none;
  border: 1.5px dashed #cbd5e1;
  border-radius: 8px;
  font-size: .8125rem;
  font-weight: 500;
  color: #94a3b8;
  cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
}
.col-add-btn:hover {
  border-color: #93c5fd;
  color: #3b82f6;
  background: #eff6ff;
}

/* ═══════════════════════════════════════════════════════════
   MODALS PARTAGÉES
   ═══════════════════════════════════════════════════════════ */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, .5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  padding: 1rem;
}

/* ── Modal détail ──────────────────────────────────────────────── */
.modal-card {
  background: #fff;
  border-radius: 20px;
  width: 100%;
  max-width: 540px;
  max-height: 88vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  box-shadow: 0 24px 60px rgba(0,0,0,.25);
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.modal-chips { display: flex; align-items: center; gap: .375rem; flex-wrap: wrap; }

.ticket-id {
  font-size: .75rem;
  font-weight: 700;
  color: #94a3b8;
}

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
.modal-close:hover { background: #e2e8f0; }

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

.modal-section { display: flex; flex-direction: column; gap: .5rem; }

.section-label {
  font-size: .6875rem;
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
  max-height: 160px;
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

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: .75rem;
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

/* ── Dialog confirmation ───────────────────────────────────────── */
.dialog-card {
  background: #fff;
  border-radius: 18px;
  width: 100%;
  max-width: 420px;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 24px 60px rgba(0,0,0,.25);
}

.dialog-icon {
  width: 48px;
  height: 48px;
  background: #dcfce7;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #16a34a;
}

.dialog-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.dialog-sub {
  font-size: .875rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: .375rem;
}

.dialog-field label {
  font-size: .8125rem;
  font-weight: 600;
  color: #475569;
}

.dialog-field textarea {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: .625rem .875rem;
  font-size: .875rem;
  color: #1e293b;
  resize: vertical;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
  font-family: inherit;
}
.dialog-field textarea:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(59,130,246,.08);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: .75rem;
  padding-top: .25rem;
}

.btn-confirm {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: .5rem 1.25rem;
  background: #22c55e;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: .875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s, box-shadow .15s;
}
.btn-confirm:hover { background: #16a34a; box-shadow: 0 4px 12px rgba(34,197,94,.3); }

/* ── Animations modal ──────────────────────────────────────────── */
.modal-enter-active, .modal-leave-active { transition: opacity .2s, transform .2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: translateY(12px) scale(.97); }

/* ── Responsive ────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .kanban-board { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .kanban-header { flex-direction: column; align-items: flex-start; }
}
</style>
