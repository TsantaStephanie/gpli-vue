<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchAllTickets, fetchTicketItems } from '@/services/api/ticketService'
import { glpiClient } from '@/services/api/glpiClient'
import { getKanbanSettings, type KanbanSetting } from '@/services/api/kanbanSettingsService'
import type { Ticket, TicketStatus } from '@/models/Ticket'

const router  = useRouter()
const loading = ref(true)
const loadError = ref('')
const allTickets = ref<Ticket[]>([])

// ── Langue (labels de statuts uniquement) ──────────────────────
const lang = ref<'fr' | 'mg'>('fr')

const STATUS_LABELS: Record<'fr' | 'mg', Record<number, string>> = {
  fr: { 1: 'Nouveau', 2: 'En cours',  3: 'Planifié',  4: 'En attente', 5: 'Résolu',  6: 'Fermé'   },
  mg: { 1: 'Vaovao',  2: 'Mandeha',   3: 'Voatokana', 4: 'Miandry',    5: 'Voavita', 6: 'Voakidy' },
}

// ── Paramètres Kanban (couleurs + labels malgaches) ─────────
const colSettings = ref<Record<string, KanbanSetting>>({})

async function loadSettings() {
  try {
    const data = await getKanbanSettings()
    const map: Record<string, KanbanSetting> = {}
    data.forEach(s => { map[s.columnId] = s })
    colSettings.value = map
  } catch { /* settings optionnels */ }
}

function colColor(colId: string): string {
  return colSettings.value[colId]?.color ?? ''
}

function colLabelMg(colId: string): string {
  return colSettings.value[colId]?.labelMg ?? ''
}

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
    statuses: [2] as number[],
    targetStatus: 2,
    color: 'orange',
    needsDialog: false,
  },
  {
    id: 'done',
    label: 'Terminé',
    statuses: [6] as number[],
    targetStatus: 6,
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

function typeMeta(t: number)     { return TYPE_META[t]     ?? { label: 'Inconnu', color: 'gray' } }
function priorityMeta(p: number) { return PRIORITY_META[p] ?? { label: '-',       color: 'gray' } }
function statusMeta(s: number) {
  const colors: Record<number, string> = { 1: 'blue', 2: 'orange', 3: 'cyan', 4: 'gray', 5: 'green', 6: 'slate' }
  return {
    label: STATUS_LABELS[lang.value][s] ?? 'Inconnu',
    color: colors[s] ?? 'gray',
  }
}

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

onMounted(() => { load(); loadSettings() })
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
        <div class="lang-toggle">
          <button :class="{ active: lang === 'fr' }" @click="lang = 'fr'">FR</button>
          <button :class="{ active: lang === 'mg' }" @click="lang = 'mg'">MG</button>
        </div>
        <button class="btn-refresh" @click="load" :disabled="loading">
          <svg :class="{ spin: loading }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Actualiser
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
        :style="colColor(col.id) ? { borderTopColor: colColor(col.id), background: colColor(col.id) + '08' } : {}"
        @dragover="onDragOver($event, col.id)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, col)"
      >
        <!-- En-tête colonne -->
        <div class="col-header">
          <div class="col-title-wrap">
            <span class="col-dot" :class="`dot-${col.color}`" :style="colColor(col.id) ? { background: colColor(col.id) } : {}"></span>
            <div class="col-title-stack">
              <span class="col-title">{{ col.label }}</span>
              <span v-if="colLabelMg(col.id)" class="col-title-mg">{{ colLabelMg(col.id) }}</span>
            </div>
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
@import '../../styles/tsanta/KanbanView.css';
</style>
