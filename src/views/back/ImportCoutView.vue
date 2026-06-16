<script setup lang="ts">
import { ref } from 'vue'
import { fetchAllTickets, fetchTicketItems } from '@/services/api/ticketService'
import { saveTicketCost, deleteLatestTicketCost, getLatestTicketCost } from '@/services/api/ticketCostService'

// ─── Types ────────────────────────────────────────────────────────────────────
interface CostMovement {
  position: number
  mvt:      'open' | 'cancel' | 'closed'
  value:    number | null
  raw:      string
}

interface TicketInfo {
  id:    number
  title: string
  types: string[]
}

// ─── State ────────────────────────────────────────────────────────────────────
const file        = ref<File | null>(null)
const movements   = ref<CostMovement[]>([])
const importing   = ref(false)
const parseError  = ref('')
const importDone  = ref<{ success: number; skipped: number; errors: number } | null>(null)

// ─── Parse CSV ────────────────────────────────────────────────────────────────
function parseCSV(text: string): CostMovement[] {
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean)
  const result: CostMovement[] = []
  for (const line of lines) {
    const [col1, col2, col3] = line.split(',').map(s => s.trim())
    const position = Number(col1)
    const rawMvt   = col2?.toLowerCase()
    const mvt      = (rawMvt === 'close' ? 'closed' : rawMvt) as 'open' | 'cancel' | 'closed'
    const value    = col3 ? Number(col3) : null
    if (!position || !['open', 'cancel', 'closed'].includes(mvt)) continue
    result.push({ position, mvt, value, raw: line })
  }
  console.log('[ImportCout] parseCSV →', result.length, 'mouvements valides')
  return result
}

// ─── Lecture fichier ──────────────────────────────────────────────────────────
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const f     = input.files?.[0]
  if (!f) return
  file.value       = f
  parseError.value = ''
  importDone.value = null
  movements.value  = []
  const reader = new FileReader()
  reader.onload = (ev) => {
    const text      = ev.target?.result as string
    movements.value = parseCSV(text)
    if (!movements.value.length) {
      parseError.value = 'Aucun mouvement valide. Format attendu : position,mvt,valeur'
    }
  }
  reader.readAsText(f)
}

// ─── insertMvt ────────────────────────────────────────────────────────────────
// Reçoit un ticketInfo déjà résolu — plus aucun appel réseau ici
async function insertMvt(
  info: TicketInfo,
  mvt:  'open' | 'closed' | 'cancel',
  valeur: number | null,
): Promise<'success' | 'skipped'> {

  if (mvt === 'cancel') {
    await deleteLatestTicketCost(info.id)
    return 'success'
  }

  if (!valeur || valeur <= 0) return 'skipped'

  if (mvt === 'open') {
    const latest = await getLatestTicketCost(info.id)
    if (!latest) return 'skipped'

    const reopenCost = Math.round(latest.fixedCost * (valeur / 100) * 100) / 100
    await saveTicketCost({
      ticketId:    info.id,
      ticketTitle: info.title,
      fixedCost:   reopenCost,
      itemCount:   info.types.length || 1,
      itemTypes:   JSON.stringify(info.types),
      source:      'reopen',
    })
    return 'success'
  }

  // closed
  await saveTicketCost({
    ticketId:    info.id,
    ticketTitle: info.title,
    fixedCost:   valeur,
    itemCount:   info.types.length || 1,
    itemTypes:   JSON.stringify(info.types),
    source:      'kanban',
  })
  return 'success'
}

// ─── Import ───────────────────────────────────────────────────────────────────
async function importerMouvements() {
  importing.value  = true
  importDone.value = null
  let success = 0, skipped = 0, errors = 0

  try {
    // 1. Chargement unique des tickets, triés par ID croissant
    const allTickets = await fetchAllTickets()
    allTickets.sort((a: any, b: any) => a.id - b.id)
    console.log('[ImportCout] tickets GLPI chargés:', allTickets.length)

    // 2. Positions uniques présentes dans le CSV
    const uniquePositions = [...new Set(movements.value.map(m => m.position))]

    // 3. Pré-chargement en parallèle des items pour chaque position unique
    const ticketMap = new Map<number, TicketInfo>()
    await Promise.all(
      uniquePositions.map(async (pos) => {
        const ticket = allTickets[pos - 1]
        if (!ticket) {
          console.warn(`[ImportCout] position ${pos} → ticket introuvable`)
          return
        }
        const items = await fetchTicketItems(ticket.id).catch(() => [])
        const types = (items || []).map((i: any) => i.itemtype).filter(Boolean)
        ticketMap.set(pos, { id: ticket.id, title: ticket.title, types })
        console.log(`[ImportCout] position ${pos} → ticket#${ticket.id} "${ticket.title}"`)
      })
    )

    // 4. Boucle d'import — aucun appel réseau supplémentaire pour résoudre le ticket
    for (const m of movements.value) {
      const info = ticketMap.get(m.position)
      if (!info) {
        skipped++
        console.warn(`[ImportCout] position ${m.position} → ignoré (ticket introuvable)`)
        continue
      }

      try {
        const result = await insertMvt(info, m.mvt, m.value)
        result === 'success' ? success++ : skipped++
      } catch (e) {
        errors++
        console.error(`[ImportCout] position ${m.position} erreur:`, e)
      }
    }
  } catch (e) {
    errors++
    console.error('[ImportCout] Erreur chargement tickets GLPI:', e)
  }

  importing.value  = false
  importDone.value = { success, skipped, errors }
  console.log('[ImportCout] terminé →', importDone.value)
}
</script>

<template>
  <div>
    <h2>Import des mouvements de coûts</h2>
    <p>
      Format CSV : <code>position, mvt, valeur</code><br>
      <small>Ticket avec status<code>open</code> | <code>closed</code> | <code>cancel</code></small>
    </p>

    <!-- Input fichier -->
    <div style="margin-top:1rem">
      <input type="file" accept=".csv" @change="onFileChange" />
      <span v-if="file" style="margin-left:.75rem">{{ file.name }}</span>
    </div>

    <!-- Erreur parsing -->
    <p v-if="parseError" style="color:red;margin-top:.5rem">{{ parseError }}</p>

    <!-- Prévisualisation -->
    <div v-if="movements.length" style="margin-top:1.5rem">
      <p><strong>{{ movements.length }}</strong> mouvements détectés</p>
      <table style="margin-top:.5rem;border-collapse:collapse;width:100%">
        <thead>
          <tr>
            <th style="text-align:left;padding:.25rem .5rem">Position</th>
            <th style="text-align:left;padding:.25rem .5rem">Mvt</th>
            <th style="text-align:left;padding:.25rem .5rem">Valeur</th>
            <th style="text-align:left;padding:.25rem .5rem">Type</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(m, i) in movements" :key="i">
            <td style="padding:.25rem .5rem">{{ m.position }}e ticket</td>
            <td style="padding:.25rem .5rem">{{ m.mvt }}</td>
            <td style="padding:.25rem .5rem">
              {{ m.value != null ? m.value + (m.mvt === 'open' ? ' %' : ' Ar') : '—' }}
            </td>
            <td style="padding:.25rem .5rem;color:#64748b;font-size:.8rem">
              {{ m.mvt === 'cancel' ? 'suppression' : m.mvt === 'open' ? '% réouverture' : 'Ar coût fixe' }}
            </td>
          </tr>
        </tbody>
      </table>

      <button
        @click="importerMouvements"
        :disabled="importing"
        style="margin-top:1rem"
      >
        {{ importing ? 'Import en cours…' : 'Importer ' + movements.length + ' mouvements' }}
      </button>
    </div>

    <!-- Résultat -->
    <div v-if="importDone" style="margin-top:1rem">
      <p>✅ {{ importDone.success }} importé(s)</p>
      <p>⏭ {{ importDone.skipped }} ignoré(s)</p>
      <p v-if="importDone.errors > 0" style="color:red">❌ {{ importDone.errors }} erreur(s) — vérifier la console</p>
    </div>
  </div>
</template>

