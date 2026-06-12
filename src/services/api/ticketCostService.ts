import axios from 'axios'

export interface TicketCostPayload {
  ticketId: number
  ticketTitle: string
  fixedCost: number
  itemCount: number
  itemTypes: string   // JSON sérialisé : '["Computer","Monitor"]'
}

export interface TicketCostRecord extends TicketCostPayload {
  id: number
  createdAt: string
}

export interface CostByType {
  itemType: string
  totalCost: number
  ticketCount: number
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

/**
 * Calcule le rapport de coûts par type d'item côté client.
 * Pour chaque enregistrement, coût par actif = fixedCost / itemCount.
 * On distribue ce coût sur chaque type dans itemTypes (tableau JSON).
 */
export function computeCostReport(records: TicketCostRecord[]): CostByType[] {
  const map = new Map<string, { totalCost: number; ticketIds: Set<number> }>()

  for (const r of records) {
    let types: string[] = []
    try { types = JSON.parse(r.itemTypes || '[]') } catch { types = [] }
    if (!types.length || !r.itemCount) continue

    const costPerItem = r.fixedCost / r.itemCount

    for (const t of types) {
      if (!map.has(t)) map.set(t, { totalCost: 0, ticketIds: new Set() })
      const entry = map.get(t)!
      entry.totalCost += costPerItem
      entry.ticketIds.add(r.ticketId)
    }
  }

  return [...map.entries()]
    .map(([itemType, { totalCost, ticketIds }]) => ({
      itemType,
      totalCost: Math.round(totalCost * 100) / 100,
      ticketCount: ticketIds.size,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
}
