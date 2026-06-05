/**
 * resetService.ts
 * Suppression en masse des données via l'API GLPI (purge complète)
 * Utilise DELETE /ItemType avec input[] pour les suppressions groupées
 */

import glpiClient, { fetchAllPaginated } from './glpiClient'
import { GLPI_ENDPOINTS } from '@/constants/glpi'

interface MinimalItem { id: number }

export interface ResetResult {
  deleted: number
  errors: string[]
}

/**
 * Supprime tous les items d'un endpoint GLPI en lots de 50.
 * force_purge = true → bypass corbeille GLPI
 */
async function purgeAll(endpoint: string, onProgress?: (done: number, total: number) => void): Promise<ResetResult> {
  const errors: string[] = []

  const items = await fetchAllPaginated<MinimalItem>(endpoint, {}, 100)
  const total = items.length
  if (total === 0) return { deleted: 0, errors: [] }

  const BATCH = 50
  let deleted = 0

  for (let i = 0; i < total; i += BATCH) {
    const batch = items.slice(i, i + BATCH).map(item => ({ id: item.id, force_purge: true }))
    try {
      await glpiClient.delete(endpoint, { data: { input: batch } })
      deleted += batch.length
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : `Erreur lot ${i}–${i + BATCH}`)
    }
    onProgress?.(Math.min(i + BATCH, total), total)
  }

  return { deleted, errors }
}

// ─── Tickets & relations ────────────────────────────────────────────────────

export async function resetTickets(onProgress?: (done: number, total: number) => void): Promise<ResetResult> {
  return purgeAll(GLPI_ENDPOINTS.TICKET, onProgress)
}

export async function resetTicketFollowups(onProgress?: (done: number, total: number) => void): Promise<ResetResult> {
  return purgeAll(GLPI_ENDPOINTS.TICKET_FOLLOWUP, onProgress)
}

export async function resetTicketSolutions(onProgress?: (done: number, total: number) => void): Promise<ResetResult> {
  return purgeAll(GLPI_ENDPOINTS.TICKET_SOLUTION, onProgress)
}

// ─── Parc informatique ──────────────────────────────────────────────────────

export async function resetComputers(onProgress?: (done: number, total: number) => void): Promise<ResetResult> {
  return purgeAll(GLPI_ENDPOINTS.COMPUTER, onProgress)
}

export async function resetMonitors(onProgress?: (done: number, total: number) => void): Promise<ResetResult> {
  return purgeAll(GLPI_ENDPOINTS.MONITOR, onProgress)
}

export async function resetPrinters(onProgress?: (done: number, total: number) => void): Promise<ResetResult> {
  return purgeAll(GLPI_ENDPOINTS.PRINTER, onProgress)
}

export async function resetNetworkEquipment(onProgress?: (done: number, total: number) => void): Promise<ResetResult> {
  return purgeAll(GLPI_ENDPOINTS.NETWORK_EQUIPMENT, onProgress)
}

// ─── Réservations ───────────────────────────────────────────────────────────

export async function resetReservations(onProgress?: (done: number, total: number) => void): Promise<ResetResult> {
  return purgeAll('/Reservation', onProgress)
}

export async function resetReservationItems(onProgress?: (done: number, total: number) => void): Promise<ResetResult> {
  return purgeAll('/ReservationItem', onProgress)
}
