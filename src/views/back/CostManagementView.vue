<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  getAllTicketCosts,
  updateTicketCostById,
  deleteTicketCostById,
  getTicketCosts,
  computeReopenBase,
  type TicketCostRecord,
} from '@/services/api/ticketCostService'

// ─── State ────────────────────────────────────────────────────────────────────
const allCosts  = ref<TicketCostRecord[]>([])
const loading   = ref(true)
const pageError = ref('')

interface EditForm {
  fixedCost: number
  pct:       number
  mode:      1 | 2 | 3 | 4
  saving:    boolean
  error:     string
}

const editingId      = ref<number | null>(null)
const editForm       = ref<EditForm>({ fixedCost: 0, pct: 0, mode: 1, saving: false, error: '' })
const cascadeWarning = ref('')   // avertissement après cascade partielle

// ─── Computed ─────────────────────────────────────────────────────────────────
const kanbanCosts = computed(() =>
  allCosts.value.filter(c => c.source === 'kanban').sort((a, b) => a.id - b.id)
)
const reopenCosts = computed(() =>
  allCosts.value.filter(c => c.source === 'reopen').sort((a, b) => a.id - b.id)
)

// ─── Chargement ───────────────────────────────────────────────────────────────
async function loadAll(quiet = false) {
  if (!quiet) loading.value = true
  pageError.value = ''
  try {
    allCosts.value = await getAllTicketCosts()
    console.log('[CostMgmt] chargé', allCosts.value.length, 'enregistrements',
      '— kanban:', kanbanCosts.value.length, '— reopen:', reopenCosts.value.length)
  } catch (e) {
    pageError.value = 'Erreur lors du chargement des coûts'
    console.error('[CostMgmt] erreur chargement:', e)
  } finally {
    if (!quiet) loading.value = false
  }
}

onMounted(loadAll)

// ─── Edition super coût (kanban) ─────────────────────────────────────────────
function openEditKanban(record: TicketCostRecord) {
  editingId.value = record.id
  editForm.value  = { fixedCost: record.fixedCost, pct: 0, mode: 1, saving: false, error: '' }
  console.log('[CostMgmt] openEditKanban id=' + record.id + ' fixedCost=' + record.fixedCost)
}

async function saveKanban(record: TicketCostRecord) {
  editForm.value.saving = true
  editForm.value.error  = ''
  cascadeWarning.value  = ''
  try {
    // 1. Sauvegarder le super coût modifié
    await updateTicketCostById(record.id, { fixedCost: editForm.value.fixedCost })
    console.log('[CostMgmt] saveKanban id=' + record.id + ' → fixedCost=' + editForm.value.fixedCost)

    // 2. Recharger tous les coûts du ticket (inclut la nouvelle valeur kanban)
    const ticketCosts = await getTicketCosts(record.ticketId)
    console.log('[CostMgmt] cascade: ' + ticketCosts.length + ' coûts chargés pour ticket#' + record.ticketId)

    // 3. Séparer les réouvertures avec et sans pct/mode stockés
    const reopens = ticketCosts.filter(c => c.source === 'reopen')
    const withData    = reopens.filter(c => c.reopenPct != null && c.reopenMode != null)
    const withoutData = reopens.filter(c => c.reopenPct == null || c.reopenMode == null)
    console.log('[CostMgmt] cascade: ' + withData.length + ' à recalculer, '
      + withoutData.length + ' sans pct/mode')

    // 4. Recalculer chaque réouverture dont on connaît pct et mode
    for (const reopen of withData) {
      // Seulement les kanbans avec id < reopen.id (existants au moment de l'import)
      const base = computeReopenBase(ticketCosts.filter(c => c.source === 'kanban' && c.id < reopen.id), reopen.reopenMode as 1 | 2 | 3 | 4)
      if (base == null || base === 0) {
        console.warn('[CostMgmt] cascade: base=0 pour réouverture#' + reopen.id + ', ignorée')
        continue
      }
      const newCost = base * (reopen.reopenPct! / 100)
      console.log('[CostMgmt] cascade réouverture#' + reopen.id
        + ' mode=' + reopen.reopenMode
        + ' base=' + base
        + ' × pct=' + reopen.reopenPct + '%'
        + ' = ' + newCost + ' Ar')
      await updateTicketCostById(reopen.id, {
        fixedCost:  newCost,
        reopenPct:  reopen.reopenPct,
        reopenMode: reopen.reopenMode,
      })
    }

    // 5. Avertir si des réouvertures n'ont pas pu être recalculées
    if (withoutData.length > 0) {
      cascadeWarning.value = withoutData.length
        + ' réouverture(s) non recalculée(s) — pct/mode non renseignés (modifiez-les manuellement).'
      console.warn('[CostMgmt] cascade incomplète:', withoutData.map(r => r.id))
    }

    await loadAll(true)
    editingId.value = null
  } catch (e: any) {
    const status = e?.response?.status
    const body   = e?.response?.data ? JSON.stringify(e.response.data) : e?.message
    editForm.value.error = `Erreur ${status ?? '?'} — ${body ?? 'inconnue'}`
    console.error('[CostMgmt] saveKanban erreur:', status, body, e)
  } finally {
    editForm.value.saving = false
  }
}

// ─── Edition réouverture ──────────────────────────────────────────────────────
function openEditReopen(record: TicketCostRecord) {
  editingId.value = record.id
  editForm.value  = {
    fixedCost: record.fixedCost,
    pct:       record.reopenPct  ?? 0,
    mode:      (record.reopenMode ?? 1) as 1 | 2 | 3 | 4,
    saving:    false,
    error:     '',
  }
  console.log('[CostMgmt] openEditReopen id=' + record.id
    + ' pct=' + record.reopenPct + ' mode=' + record.reopenMode)
}

async function saveReopen(record: TicketCostRecord) {
  editForm.value.saving = true
  editForm.value.error  = ''
  try {
    // Récupérer tous les coûts du ticket pour calculer la base via computeReopenBase
    const costs = await getTicketCosts(record.ticketId)
    console.log('[CostMgmt] saveReopen ticket#' + record.ticketId
      + ' → ' + costs.length + ' enregistrements chargés')

    // Seulement les kanbans avec id < record.id (existants au moment de l'import)
    const base = computeReopenBase(costs.filter(c => c.source === 'kanban' && c.id < record.id), editForm.value.mode)
    console.log('[CostMgmt] saveReopen mode=' + editForm.value.mode + ' base=' + base)

    if (base == null || base === 0) {
      editForm.value.error = 'Aucun super coût (kanban) trouvé pour ce ticket'
      console.warn('[CostMgmt] saveReopen → base nulle, abandon')
      return
    }

    const newFixedCost = base * (editForm.value.pct / 100)
    console.log('[CostMgmt] saveReopen calcul: ' + base + ' × ' + editForm.value.pct
      + '% = ' + newFixedCost + ' Ar')

    await updateTicketCostById(record.id, {
      fixedCost:  newFixedCost,
      reopenPct:  editForm.value.pct,
      reopenMode: editForm.value.mode,
    })
    await loadAll(true)
    editingId.value = null
  } catch (e: any) {
    const status = e?.response?.status
    const body   = e?.response?.data ? JSON.stringify(e.response.data) : e?.message
    editForm.value.error = `Erreur ${status ?? '?'} — ${body ?? 'inconnue'}`
    console.error('[CostMgmt] saveReopen erreur:', status, body, e)
  } finally {
    editForm.value.saving = false
  }
}

// ─── Suppression réouverture ──────────────────────────────────────────────────
async function deleteReopen(record: TicketCostRecord) {
  if (!confirm('Supprimer la réouverture #' + record.id + ' (' + record.ticketTitle + ') ?')) return
  try {
    await deleteTicketCostById(record.id)
    console.log('[CostMgmt] deleteReopen id=' + record.id + ' supprimé')
    if (editingId.value === record.id) editingId.value = null
    await loadAll(true)
  } catch (e) {
    pageError.value = 'Erreur lors de la suppression'
    console.error('[CostMgmt] deleteReopen erreur:', e)
  }
}

function cancelEdit() {
  editingId.value = null
  console.log('[CostMgmt] édition annulée')
}
</script>

<template>
  <div>
    <h2>Gestion des coûts</h2>

    <p v-if="loading">Chargement…</p>
    <p v-if="pageError" style="color:red">{{ pageError }}</p>
    <p v-if="cascadeWarning" style="color:orange"> {{ cascadeWarning }}</p>

    <template v-if="!loading">

      <!-- ── Super coûts (kanban) ───────────────────────────────────────────── -->
      <h3>Super coûts (Kanban) — {{ kanbanCosts.length }} ligne(s)</h3>
      <p v-if="!kanbanCosts.length">Aucun super coût enregistré.</p>
      <table v-else style="border-collapse:collapse;width:100%">
        <thead>
          <tr>
            <th style="text-align:left;padding:.25rem .5rem">#</th>
            <th style="text-align:left;padding:.25rem .5rem">Ticket</th>
            <th style="text-align:right;padding:.25rem .5rem">Coût (Ar)</th>
            <th style="text-align:left;padding:.25rem .5rem">Action</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="record in kanbanCosts" :key="record.id">
            <tr>
              <td style="padding:.25rem .5rem">{{ record.id }}</td>
              <td style="padding:.25rem .5rem">{{ record.ticketTitle }}</td>
              <td style="padding:.25rem .5rem;text-align:right">{{ record.fixedCost.toFixed(3) }}</td>
              <td style="padding:.25rem .5rem">
                <button @click="openEditKanban(record)" :disabled="editingId === record.id">
                  Modifier
                </button>
              </td>
            </tr>
            <!-- Formulaire inline édition kanban -->
            <tr v-if="editingId === record.id">
              <td colspan="4" style="padding:.5rem">
                <label>Coût (Ar) :</label>
                <input
                  type="number"
                  v-model.number="editForm.fixedCost"
                  step="0.001"
                  min="0"
                  style="margin-left:.5rem;width:10rem"
                />
                <button
                  @click="saveKanban(record)"
                  :disabled="editForm.saving"
                  style="margin-left:.75rem"
                >{{ editForm.saving ? 'Sauvegarde…' : 'Sauvegarder' }}</button>
                <button @click="cancelEdit" style="margin-left:.5rem">Annuler</button>
                <span v-if="editForm.error" style="color:red;margin-left:.75rem">{{ editForm.error }}</span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- ── Réouvertures ──────────────────────────────────────────────────── -->
      <h3 style="margin-top:2rem">Réouvertures — {{ reopenCosts.length }} ligne(s)</h3>
      <p v-if="!reopenCosts.length">Aucune réouverture enregistrée.</p>
      <table v-else style="border-collapse:collapse;width:100%">
        <thead>
          <tr>
            <th style="text-align:left;padding:.25rem .5rem">#</th>
            <th style="text-align:left;padding:.25rem .5rem">Ticket</th>
            <th style="text-align:right;padding:.25rem .5rem">Coût calculé (Ar)</th>
            <th style="text-align:right;padding:.25rem .5rem">% Réouverture</th>
            <th style="text-align:center;padding:.25rem .5rem">Mode</th>
            <th style="text-align:left;padding:.25rem .5rem">Action</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="record in reopenCosts" :key="record.id">
            <tr>
              <td style="padding:.25rem .5rem">{{ record.id }}</td>
              <td style="padding:.25rem .5rem">{{ record.ticketTitle }}</td>
              <td style="padding:.25rem .5rem;text-align:right">{{ record.fixedCost.toFixed(3) }}</td>
              <td style="padding:.25rem .5rem;text-align:right">
                {{ record.reopenPct != null ? record.reopenPct + ' %' : '—' }}
              </td>
              <td style="padding:.25rem .5rem;text-align:center">
                {{ record.reopenMode ?? '—' }}
              </td>
              <td style="padding:.25rem .5rem">
                <button @click="openEditReopen(record)" :disabled="editingId === record.id">
                  Modifier
                </button>
                <button @click="deleteReopen(record)" style="margin-left:.5rem">
                  Supprimer
                </button>
              </td>
            </tr>
            <!-- Formulaire inline édition réouverture -->
            <tr v-if="editingId === record.id">
              <td colspan="6" style="padding:.5rem">
                <label>% Réouverture :</label>
                <input
                  type="number"
                  v-model.number="editForm.pct"
                  step="0.5"
                  min="0"
                  max="100"
                  style="margin-left:.5rem;width:6rem"
                />
                <label style="margin-left:1rem">Mode :</label>
                <select v-model.number="editForm.mode" style="margin-left:.5rem">
                  <option :value="1">1 — dernier super coût</option>
                  <option :value="2">2 — premier super coût</option>
                  <option :value="3">3 — moyenne des super coûts</option>
                  <option :value="4">4 — somme des super coûts</option>
                </select>
                <button
                  @click="saveReopen(record)"
                  :disabled="editForm.saving"
                  style="margin-left:.75rem"
                >{{ editForm.saving ? 'Calcul…' : 'Sauvegarder' }}</button>
                <button @click="cancelEdit" style="margin-left:.5rem">Annuler</button>
                <span v-if="editForm.error" style="color:red;margin-left:.75rem">{{ editForm.error }}</span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

    </template>
  </div>
</template>
