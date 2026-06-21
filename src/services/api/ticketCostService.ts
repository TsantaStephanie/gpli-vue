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

export async function getTicketCosts(ticketId: number): Promise<TicketCostRecord[]> {
  const res = await axios.get<TicketCostRecord[]>(`${BASE}/ticket/${ticketId}`)
  console.log(`[TicketCost] getTicketCosts(${ticketId}) →`, res.data.length, 'enregistrement(s)')
  return res.data
}

export async function deleteLatestTicketCost(ticketId: number): Promise<void> {
  await axios.delete(`${BASE}/ticket/${ticketId}/latest`)
}

export async function deleteAllTicketCosts(): Promise<void> {
  await axios.delete(BASE)
  console.log('[TicketCost] deleteAll → tous les coûts SQLite supprimés')
}

// ─── Mouvement de coût unifié ──────────────────────────────────────────────
// Fonction UNIQUE partagée entre l'interface (dialogs Kanban) et l'import CSV
// (back office), pour garantir le même comportement partout et faciliter
// l'ajout d'un futur type de mouvement (un seul endroit à modifier).
export type CostMovementType = 'open' | 'closed' | 'cancel'

export type ReopenBaseMode = 1 | 2 | 3 | 4

export interface CostMovementInput {
  ticketId:    number
  ticketTitle: string
  itemTypes:   string[]       // types d'actifs liés au ticket
  mvt:         CostMovementType
  value:       number | null 
  precomputedCost?: number
  mode?: ReopenBaseMode
}


export function computeReopenBase(costs: TicketCostRecord[], mode: ReopenBaseMode): number | null {
  const superCosts = costs.filter(c=> c.source==='kanban').sort((a,b) =>a.id-b.id)
  console.log('[CostMovement] computeReopenBase mode ${mode} -> super couts:' , superCosts.map(c=> c.fixedCost))
  if(!superCosts.length) return null

  switch (mode) {
  case 2:
    return superCosts[0].fixedCost
  case 3: {
    const sum = superCosts.reduce((s, c) => s + c.fixedCost, 0)
    return sum / superCosts.length
  }
  case 4:
    return superCosts.reduce((s, c) => s + c.fixedCost, 0)
  case 1:
  default:
    return superCosts[superCosts.length - 1].fixedCost
  }
}


 
export interface CostMovementResult {
  applied: boolean
  reason?: string
  record?: TicketCostRecord
}

export async function applyCostMovement(input: CostMovementInput): Promise<CostMovementResult> {
  const { ticketId, ticketTitle, itemTypes, mvt, value } = input
  const itemCount     = itemTypes.length || 1
  const itemTypesJson = JSON.stringify(itemTypes)
  console.log('[CostMovement] applyCostMovement →', input)

  if (mvt === 'cancel') {
    await deleteLatestTicketCost(ticketId)
    console.log(`[CostMovement] ticket#${ticketId} cancel → dernier coût supprimé`)
    return { applied: true }
  }

  if (!value || value <= 0) {
    console.log(`[CostMovement] ticket#${ticketId} mvt:${mvt} → ignoré (valeur vide)`)
    return { applied: false, reason: 'valeur vide' }
  }

  if (mvt === 'open') {
    let reopenCost: number

    if (input.precomputedCost != null) {
      // Coût déjà calculé par l'appelant (cache déjà en mémoire) → pas de fetch,
      // logique identique à l'ancien code du dialog Kanban.
      reopenCost = input.precomputedCost
      console.log(`[CostMovement] ticket#${ticketId} open → precomputedCost fourni = ${reopenCost} Ar (pas de fetch)`)
    } else {
      const mode = input.mode ?? 1
      const costs = await getTicketCosts(ticketId)
      const base  = computeReopenBase(costs, mode)
      if (base == null) {
        console.warn(`[CostMovement] ticket#${ticketId} open ${value}% (mode ${mode}) → aucun coût super trouvé, ignoré`)
        return { applied: false, reason: 'aucun super coût trouvé' }
      }
      reopenCost = base * (value / 100)
      console.log(`[CostMovement] ticket#${ticketId} open ${value}% (mode ${mode}) de base ${base} = ${reopenCost} Ar → OK`)
    }

    const record = await saveTicketCost({
      ticketId, ticketTitle,
      fixedCost: reopenCost,
      itemCount,
      itemTypes: itemTypesJson,
      source:    'reopen',
    })
    return { applied: true, record }
  }

  // mvt === 'closed' → montant Ar direct (super coût)
  const record = await saveTicketCost({
    ticketId, ticketTitle,
    fixedCost: value,
    itemCount,
    itemTypes: itemTypesJson,
    source:    'kanban',
  })
  console.log(`[CostMovement] ticket#${ticketId} closed ${value} Ar → OK`)
  return { applied: true, record }
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
      fixedCost:   calcTotal(c),
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
        allocatedCost: costPerItem,
        source:        r.source ?? 'kanban',
        date:          r.createdAt,
      })
    }
  }

  return [...map.entries()]
    .map(([itemType, { totalCost, ticketIds, entries }]) => ({
      itemType,
      totalCost,
      ticketCount: ticketIds.size,
      entries,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
}
