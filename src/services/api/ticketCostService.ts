import axios from 'axios'
import glpiClient from './glpiClient'

export type CostSource = 'glpi' | 'kanban' | 'reopen'

export interface TicketCostPayload {
  ticketId:    number
  ticketTitle: string
  fixedCost:   number
  itemCount:   number
  itemTypes:   string        // JSON sérialisé : '["Computer","Monitor"]'
  source:      CostSource
}

export interface TicketCostRecord extends TicketCostPayload {
  id:        number
  createdAt: string
}

/** Ligne individuelle dans une section "par type d'item" */
export interface CostEntry {
  recordId:      number
  ticketId:      number
  ticketTitle:   string
  allocatedCost: number   // fixedCost / itemCount pour ce type
  source:        CostSource
  date:          string
}

export interface CostByType {
  itemType:    string
  totalCost:   number
  ticketCount: number
  entries:     CostEntry[]
}

const BASE = '/api/ticket-costs'

export async function saveTicketCost(payload: TicketCostPayload): Promise<TicketCostRecord> {
  const res = await axios.post<TicketCostRecord>(BASE, payload)
  return res.data
}

export async function getAllTicketCosts(): Promise<TicketCostRecord[]> {
  const res = await axios.get<TicketCostRecord[]>(BASE)
  return res.data
}

export async function getLatestTicketCost(ticketId: number): Promise<TicketCostRecord | null> {
  try {
    const res = await axios.get<TicketCostRecord>(`${BASE}/ticket/${ticketId}/latest`)
    return res.data
  } catch {
    return null
  }
}

export async function deleteLatestTicketCost(ticketId: number): Promise<void> {
  await axios.delete(`${BASE}/ticket/${ticketId}/latest`)
}

/**
 * Calcule le rapport de coûts PAR TYPE d'item.
 * Filtre optionnel par source ('glpi' | 'kanban' | undefined = tous).
 */
/**
 * Récupère les TicketCost depuis GLPI (Fixed_Cost uniquement > 0).
 * Pour chaque ticket, résout le titre et les types d'actifs liés.
 * Retourne des enregistrements normalisés compatibles avec TicketCostRecord.
 */
export async function fetchGlpiTicketCosts(): Promise<TicketCostRecord[]> {
  // 1. Tous les TicketCost GLPI
  const { data: costs } = await glpiClient.get('/TicketCost', {
    params: { range: '0-999' },
  })
  if (!Array.isArray(costs) || costs.length === 0) return []

  // Garder seulement les lignes avec un Fixed_Cost > 0
  // Calcul du coût total : (durée_sec / 3600) × taux_horaire + coût_fixe + coût_matériel
  const calcTotal = (c: any): number => {
    const timeHours    = Number(c.actiontime  ?? 0) / 3600
    const costHoraire  = timeHours * Number(c.cost_time     ?? 0)
    const costFixe     = Number(c.cost_fixed    ?? 0)
    const costMateriel = Number(c.cost_material ?? 0)
    return costHoraire + costFixe + costMateriel
  }

  const relevant = costs.filter((c: any) => calcTotal(c) > 0)
  if (!relevant.length) return []

  // 2. Résolution titre + items par ticket (en parallèle, dédupliqué)
  const uniqueTicketIds = [...new Set(relevant.map((c: any) => c.tickets_id as number))]

  const ticketCache = new Map<number, { title: string; itemTypes: string[] }>()

  await Promise.all(
    uniqueTicketIds.map(async (ticketId) => {
      try {
        const [ticketRes, itemsRes] = await Promise.all([
          glpiClient.get(`/Ticket/${ticketId}`),
          glpiClient.get(`/Ticket/${ticketId}/Item_Ticket`),
        ])
        const title     = ticketRes.data?.name ?? `Ticket #${ticketId}`
        const items     = Array.isArray(itemsRes.data) ? itemsRes.data : []
        const itemTypes = items.map((i: any) => i.itemtype).filter(Boolean)
        ticketCache.set(ticketId, { title, itemTypes })
      } catch {
        ticketCache.set(ticketId, { title: `Ticket #${ticketId}`, itemTypes: [] })
      }
    })
  )

  // 3. Normalisation au format TicketCostRecord
  return relevant.map((c: any, idx: number) => {
    const info      = ticketCache.get(c.tickets_id) ?? { title: `Ticket #${c.tickets_id}`, itemTypes: [] }
    const itemCount = info.itemTypes.length || 1
    return {
      id:          -(idx + 1),           // ID négatif pour éviter collision avec SQLite
      ticketId:    c.tickets_id as number,
      ticketTitle: info.title,
      fixedCost:   Math.round(calcTotal(c) * 100) / 100,
      itemCount,
      itemTypes:   JSON.stringify(info.itemTypes),
      source:      'glpi' as CostSource,
      createdAt:   c.date ?? new Date().toISOString(),
    }
  })
}

export function computeCostReport(
  records: TicketCostRecord[],
  filterSource?: CostSource,
): CostByType[] {
  const filtered = filterSource
    ? records.filter(r => r.source === filterSource)
    : records

  const map = new Map<string, {
    totalCost:  number
    ticketIds:  Set<number>
    entries:    CostEntry[]
  }>()

  for (const r of filtered) {
    let types: string[] = []
    try { types = JSON.parse(r.itemTypes || '[]') } catch { types = [] }
    // Fallback : coût visible même sans actifs liés
    if (!types.length) types = ['Non catégorisé']

    const costPerItem = r.fixedCost / (types.length || 1)

    for (const t of types) {
      if (!map.has(t)) map.set(t, { totalCost: 0, ticketIds: new Set(), entries: [] })
      const group = map.get(t)!
      group.totalCost += costPerItem
      group.ticketIds.add(r.ticketId)
      group.entries.push({
        recordId:      r.id,
        ticketId:      r.ticketId,
        ticketTitle:   r.ticketTitle,
        allocatedCost: Math.round(costPerItem * 100) / 100,
        source:        r.source ?? 'kanban',
        date:          r.createdAt,
      })
    }
  }

  return [...map.entries()]
    .map(([itemType, { totalCost, ticketIds, entries }]) => ({
      itemType,
      totalCost:   Math.round(totalCost * 100) / 100,
      ticketCount: ticketIds.size,
      entries,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
}
