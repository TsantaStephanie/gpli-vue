<script setup lang="ts">
import { ref } from 'vue'
import { fetchAllTickets, fetchTicketItems } from '@/services/api/ticketService'
import { saveTicketCost, deleteLatestTicketCost, getTicketCosts, computeReopenBase } from '@/services/api/ticketCostService'

// ─── Types ────────────────────────────────────────────────────────────────────
interface CostMovement {
  position: number
  mvt:      'open' | 'cancel' | 'closed'
  value:    number | null
  mode:     '1' | '2' | '3' | '4' | null   // uniquement pour mvt='open', sinon null
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

let ticketMap = new Map<number, TicketInfo>()

// ─── Parse CSV ────────────────────────────────────────────────────────────────
function parseCSV(text: string): CostMovement[] {
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean)
  const result: CostMovement[] = []
  for (const line of lines) {
    const [col1, col2, col3, col4] = line.split(',').map(s => s.trim())
    const position = Number(col1)
    const rawMvt   = col2?.toLowerCase()
    const mvt      = (rawMvt === 'close' ? 'closed' : rawMvt) as 'open' | 'cancel' | 'closed'
    const value    = col3 ? Number(col3) : null
    // mode (colonne 4) : uniquement pertinent pour mvt='open', sinon null
    const mode     = (mvt === 'open' && col4) ? (col4 as '1' | '2' | '3' | '4') : null
    if (!position || !['open', 'cancel', 'closed'].includes(mvt)) continue
    result.push({ position, mvt, value, mode, raw: line })
    console.log(`[ImportCout] parseCSV → position ${position} mvt:${mvt} value:${value} mode:${mode}`)
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
      parseError.value = 'Aucun mouvement valide. Format attendu : position,mvt,valeur,mode'
    }
  }
  reader.readAsText(f)
}

// ─── insertMvt ────────────────────────────────────────────────────────────────
// 4 arguments : position CSV, mvt, valeur, mode (mode utilisé seulement si mvt='open')
// Résolution du ticket via ticketMap construite avant la boucle (closure)
async function insertMvt(
  position: number,
  mvt:      'open' | 'cancel' | 'closed',
  valeur:   number | null,
  mode:     '1' | '2' | '3' | '4' | null,
): Promise<'success' | 'skipped'> {

  // Résolution de la ref via la map pré-chargée
  const info = ticketMap.get(position)
  if (!info) {
    console.warn(`[ImportCout] position ${position} → ticket introuvable, ignoré`)
    return 'skipped'
  }

  if (mvt === 'cancel') {
    await deleteLatestTicketCost(info.id)
    return 'success'
  }

  // valeur peut être 0 (super coût valide) → seule une valeur négative ou absente est ignorée
  if (valeur == null || valeur < 0) return 'skipped'

  if (mvt === 'open') {
    const modeNum = (mode ? Number(mode) : 1) as 1 | 2 | 3 | 4
    const costs   = await getTicketCosts(info.id)
    const base    = computeReopenBase(costs, modeNum)
    console.log(`[ImportCout] position ${position} ticket#${info.id} open mode:${modeNum} base:${base}`)
    if (base == null) {
      console.warn(`[ImportCout] position ${position} ticket#${info.id} → aucun super coût trouvé, ignoré`)
      return 'skipped'
    }

    const reopenCost = base * (valeur / 100)
    await saveTicketCost({
      ticketId:    info.id,
      ticketTitle: info.title,
      fixedCost:   reopenCost,
      itemCount:   info.types.length || 1,
      itemTypes:   JSON.stringify(info.types),
      source:      'reopen',
    })
    console.log(`[ImportCout] position ${position} ticket#${info.id} open ${valeur}% (mode ${modeNum}) de base ${base} = ${reopenCost} Ar → OK`)
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
  console.log(`[ImportCout] position ${position} ticket#${info.id} closed ${valeur} Ar → OK`)
  return 'success'
}

// ─── Import ───────────────────────────────────────────────────────────────────
async function importerMouvements() {
  importing.value  = true
  importDone.value = null
  let success = 0, skipped = 0, errors = 0

  try {
    // 1. Chargement unique des tickets triés par ID croissant
    const allTickets = await fetchAllTickets()
    allTickets.sort((a: any, b: any) => a.id - b.id)
    console.log('[ImportCout] tickets GLPI chargés:', allTickets.length)

    // 2. Positions uniques présentes dans le CSV
    const uniquePositions = [...new Set(movements.value.map(m => m.position))]

    // 3. Pré-chargement en parallèle des items pour chaque position unique
    ticketMap = new Map<number, TicketInfo>()
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

    // 4. Boucle d'import — insertMvt résout la position via ticketMap (closure)
    for (const m of movements.value) {
      try {
        const result = await insertMvt(m.position, m.mvt, m.value, m.mode)
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
      Format CSV : <code>position, mvt, valeur, mode</code><br>
      <small>mvt : <code>open</code> | <code>closed</code> | <code>cancel</code> — mode (1-4, uniquement pour <code>open</code>) : 1=dernier, 2=premier, 3=moyenne, 4=somme</small>
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
            <th style="text-align:left;padding:.25rem .5rem">Mode</th>
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
            <td style="padding:.25rem .5rem">
              {{ m.mode ?? '—' }}
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
