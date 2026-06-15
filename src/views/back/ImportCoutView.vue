<script setup lang="ts">
import { ref } from 'vue'
import { fetchAllTickets, fetchTicketItems } from '@/services/api/ticketService'
import { saveTicketCost, deleteLatestTicketCost, getLatestTicketCost } from '@/services/api/ticketCostService'

// ─── Types ────────────────────────────────────────────────────────────────────
interface CostMovement {
  position: number              // numéro dans le CSV (1 = 1er ticket GLPI, 2 = 2ème...)
  mvt:      'open' | 'cancel' | 'closed'
  value:    number | null
  raw:      string
}

// ─── State ────────────────────────────────────────────────────────────────────
const file        = ref<File | null>(null)
const movements   = ref<CostMovement[]>([])
const importing   = ref(false)
const parseError  = ref('')
const importDone  = ref<{ success: number; skipped: number; errors: number } | null>(null)

// ─── Parse CSV ────────────────────────────────────────────────────────────────
// Colonnes : position (1er ticket=1, 2ème=2...), mvt (open|closed|close|cancel), valeur
function parseCSV(text: string): CostMovement[] {
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean)
  const result: CostMovement[] = []
  for (const line of lines) {
    const [col1, col2, col3] = line.split(',').map(s => s.trim())
    const position = Number(col1)
    // 'close' accepté comme alias de 'closed'
    const rawMvt = col2?.toLowerCase()
    const mvt    = (rawMvt === 'close' ? 'closed' : rawMvt) as 'open' | 'cancel' | 'closed'
    const value  = col3 ? Number(col3) : null
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
    const text = ev.target?.result as string
    movements.value = parseCSV(text)
    if (!movements.value.length) {
      parseError.value = 'Aucun mouvement valide. Format attendu : position,mvt,valeur'
    }
  }
  reader.readAsText(f)
}

// ─── Import ───────────────────────────────────────────────────────────────────
async function importerMouvements() {
  importing.value  = true
  importDone.value = null
  let success = 0, skipped = 0, errors = 0

  try {
    // 1. Récupérer tous les tickets GLPI triés par ID croissant
    const allTickets = await fetchAllTickets()
    allTickets.sort((a: any, b: any) => a.id - b.id)
    console.log('[ImportCout] tickets GLPI chargés:', allTickets.length, '→', allTickets.map((t: any) => t.id))

    // 2. Construire la map position → { glpiId, title, types }
    const uniquePositions = [...new Set(movements.value.map(m => m.position))]
    const ticketMap = new Map<number, { id: number; title: string; types: string[] }>()

    await Promise.all(uniquePositions.map(async pos => {
      const ticket = allTickets[pos - 1]   // pos 1 = index 0
      if (!ticket) {
        console.warn(`[ImportCout] position ${pos} → aucun ticket en position ${pos} dans GLPI`)
        return
      }
      const items = await fetchTicketItems(ticket.id).catch(() => [])
      const types = (items || []).map((i: any) => i.itemtype).filter(Boolean)
      ticketMap.set(pos, { id: ticket.id, title: ticket.title, types })
      console.log(`[ImportCout] position ${pos} → ticket#${ticket.id} "${ticket.title}" types:`, types)
    }))

    // 3. Importer chaque mouvement
    for (const m of movements.value) {
      const info = ticketMap.get(m.position)
      if (!info) {
        skipped++
        console.warn(`[ImportCout] position ${m.position} → ticket introuvable, ignoré`)
        continue
      }

      try {
        // cancel → supprime le dernier coût SQLite du ticket
        if (m.mvt === 'cancel') {
          await deleteLatestTicketCost(info.id)
          success++
          console.log(`[ImportCout] position ${m.position} → ticket#${info.id} cancel → dernier coût supprimé`)
          continue
        }

        if (!m.value || m.value <= 0) {
          skipped++
          console.log(`[ImportCout] position ${m.position} mvt:${m.mvt} → ignoré (valeur vide)`)
          continue
        }

        if (m.mvt === 'open') {
          // open → valeur = % de réouverture (comme le dialog Kanban)
          // on récupère le dernier coût SQLite du ticket pour calculer le montant
          const latest = await getLatestTicketCost(info.id)
          if (!latest) {
            skipped++
            console.warn(`[ImportCout] position ${m.position} → ticket#${info.id} open ${m.value}% → aucun coût précédent, ignoré`)
            continue
          }
          const reopenCost = Math.round(latest.fixedCost * (m.value / 100) * 100) / 100
          await saveTicketCost({
            ticketId:    info.id,
            ticketTitle: info.title,
            fixedCost:   reopenCost,
            itemCount:   info.types.length || 1,
            itemTypes:   JSON.stringify(info.types),
            source:      'reopen',
          })
          success++
          console.log(`[ImportCout] position ${m.position} → ticket#${info.id} open ${m.value}% de ${latest.fixedCost} = ${reopenCost} Ar → OK`)
        } else {
          // closed → valeur en Ar directement (super coût)
          await saveTicketCost({
            ticketId:    info.id,
            ticketTitle: info.title,
            fixedCost:   m.value,
            itemCount:   info.types.length || 1,
            itemTypes:   JSON.stringify(info.types),
            source:      'kanban',
          })
          success++
          console.log(`[ImportCout] position ${m.position} → ticket#${info.id} closed ${m.value} Ar → OK`)
        }
      } catch (e) {
        errors++
        console.error(`[ImportCout] ticket#${info.id} erreur:`, e)
      }
    }
  } catch (e) {
    console.error('[ImportCout] Erreur chargement tickets GLPI:', e)
    errors++
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
      <small>Position = rang du ticket dans GLPI (1 = 1er ticket, 2 = 2ème…) — mvt : <code>open</code> | <code>closed</code> | <code>cancel</code></small>
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
