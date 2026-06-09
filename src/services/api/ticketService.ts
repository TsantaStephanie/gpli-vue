/**
 * ticketService.ts
 * Fetch et gestion des tickets GLPI (Support / Helpdesk)
 * Endpoint : GET /apirest.php/Ticket
 */

import { fetchAllPaginated, glpiClient } from './glpiClient';
import { GLPI_ENDPOINTS, TICKET_STATUS } from '@/constants/glpi';
import {
  type GlpiTicket,
  type Ticket,
  type TicketStatus,
  mapGlpiTicketToTicket,
} from '@/models/Ticket';

// ─── Paramètres de recherche ──────────────────────────────────────────────────

export interface TicketSearchParams {
  entityId?: number;
  status?: TicketStatus;
  requesterId?: number;
  assignedUserId?: number;
  includeDeleted?: boolean;
}

// ─── Interfaces pour les coûts ─────────────────────────────────────────────────

export interface TicketCost {
  id: number;
  tickets_id: number;
  name: string;
  comment?: string;
  actiontime: number;      // Temps passé en secondes
  cost_time: number;       // Coût horaire
  cost_fixed: number;      // Coût fixe
  cost_total: number;      // Coût total
  date_creation: string;
  date_mod: string;
}

export interface TicketCostSummary {
  totalCost: number;
  totalTime: number;       // en secondes
  totalTimeFormatted: string;
  costTime: number;
  costFixed: number;
  costs: TicketCost[];
}

// ─── Gestion des coûts ────────────────────────────────────────────────────────

/**
 * Récupère tous les coûts d'un ticket
 */
export async function fetchTicketCosts(ticketId: number): Promise<TicketCost[]> {
  const { default: glpiClient } = await import('./glpiClient');
  
  try {
    const { data } = await glpiClient.get(`${GLPI_ENDPOINTS.TICKET}/${ticketId}/TicketCost`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Erreur lors du chargement des coûts du ticket #${ticketId}:`, error);
    return [];
  }
}

/**
 * Ajoute un coût à un ticket
 */
export async function addTicketCost(
  ticketId: number, 
  cost: {
    name: string;
    comment?: string;
    actiontime?: number;
    cost_time?: number;
    cost_fixed?: number;
  }
): Promise<TicketCost | null> {
  const { default: glpiClient } = await import('./glpiClient');
  
  const costTotal = (cost.cost_time || 0) + (cost.cost_fixed || 0);
  
  try {
    const { data } = await glpiClient.post('/TicketCost', {
      input: {
        tickets_id: ticketId,
        name: cost.name,
        comment: cost.comment || '',
        actiontime: cost.actiontime || 0,
        cost_time: cost.cost_time || 0,
        cost_fixed: cost.cost_fixed || 0,
        cost_total: costTotal,
      }
    });
    
    console.log(`[GLPI] Coût ajouté au ticket #${ticketId}:`, data);
    return data;
  } catch (error) {
    console.error(`Erreur lors de l'ajout du coût au ticket #${ticketId}:`, error);
    return null;
  }
}

/**
 * Supprime un coût d'un ticket
 */
export async function deleteTicketCost(costId: number): Promise<boolean> {
  const { default: glpiClient } = await import('./glpiClient');
  
  try {
    await glpiClient.delete(`/TicketCost/${costId}`);
    console.log(`[GLPI] Coût #${costId} supprimé`);
    return true;
  } catch (error) {
    console.error(`Erreur lors de la suppression du coût #${costId}:`, error);
    return false;
  }
}

/**
 * Récupère le résumé des coûts d'un ticket
 */
export async function getTicketCostSummary(ticketId: number): Promise<TicketCostSummary> {
  const costs = await fetchTicketCosts(ticketId);
  
  let totalCost = 0;
  let totalTime = 0;
  let costTime = 0;
  let costFixed = 0;
  
  costs.forEach(cost => {
    totalCost += Number(cost.cost_total) || 0;
    totalTime += Number(cost.actiontime) || 0;
    costTime += Number(cost.cost_time) || 0;
    costFixed += Number(cost.cost_fixed) || 0;
  });
  
  // Formater le temps total
  const hours = Math.floor(totalTime / 3600);
  const minutes = Math.floor((totalTime % 3600) / 60);
  let totalTimeFormatted = '0 min';
  if (hours > 0 && minutes > 0) totalTimeFormatted = `${hours}h ${minutes}min`;
  else if (hours > 0) totalTimeFormatted = `${hours}h`;
  else if (minutes > 0) totalTimeFormatted = `${minutes}min`;
  
  return {
    totalCost: Number(totalCost.toFixed(2)),
    totalTime: totalTime,
    totalTimeFormatted: totalTimeFormatted,
    costTime: Number(costTime.toFixed(2)),
    costFixed: Number(costFixed.toFixed(2)),
    costs: costs
  };
}

// ─── Fonctions existantes ──────────────────────────────────────────────────────

function buildTicketParams(params: TicketSearchParams): Record<string, unknown> {
  const q: Record<string, unknown> = {
    is_deleted: params.includeDeleted ? undefined : 0,
  };
  return Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined));
}

export async function searchTickets(criteria: Array<{ field: string; searchtype: string; value: string }>): Promise<Ticket[]> {
  const { default: glpiClient } = await import('./glpiClient');
  
  const params: Record<string, string> = {};
  criteria.forEach((c, index) => {
    params[`criteria[${index}][field]`] = c.field;
    params[`criteria[${index}][searchtype]`] = c.searchtype;
    params[`criteria[${index}][value]`] = c.value;
  });

  const raw = await fetchAllPaginated<Record<string, any>>(
    GLPI_ENDPOINTS.SEARCH('Ticket'),
    params
  );

  const tickets: Ticket[] = [];
  for (const item of raw) {
    if (item[1]) {
      const t = await fetchTicketById(Number(item[2] || item.id || Object.values(item)[0]));
      if(t) tickets.push(t);
    }
  }
  return tickets;
}

export async function fetchAllTickets(_params: TicketSearchParams = {}): Promise<Ticket[]> {
  // GET /Ticket sans is_deleted : GLPI renvoie les tickets non-supprimés par défaut.
  // Passer is_deleted=0 active à tort la vue "corbeille" → tableau vide.
  const { data } = await glpiClient.get(GLPI_ENDPOINTS.TICKET, {
    params: { range: '0-9999' },
    timeout: 120_000,
  });

  // GLPI peut renvoyer :
  //   • Un tableau  : [{ id, name, ... }, ...]        ← cas normal
  //   • Un objet    : { data: [...], totalcount: N }  ← endpoint search
  //   • Un tableau  : [errorCode, "message"]          ← erreur déguisée en 200
  const raw: GlpiTicket[] = Array.isArray(data)
    ? (typeof data[0] === 'number' ? [] : data)
    : (data?.data ?? []);

  return raw.map(mapGlpiTicketToTicket);
}

export async function fetchTicketById(id: number): Promise<Ticket> {
  const { default: glpiClient } = await import('./glpiClient');
  const { data } = await glpiClient.get<GlpiTicket>(`${GLPI_ENDPOINTS.TICKET}/${id}`);
  return mapGlpiTicketToTicket(data);
}

export async function fetchTicketItems(ticketId: number): Promise<any[]> {
  const { default: glpiClient } = await import('./glpiClient');
  const { data } = await glpiClient.get(`${GLPI_ENDPOINTS.TICKET}/${ticketId}/Item_Ticket`);
  return data;
}

export async function fetchOpenTickets(entityId?: number): Promise<Ticket[]> {
  const tickets = await fetchAllTickets({ entityId });
  return tickets.filter(
    (t) => t.status !== TICKET_STATUS.SOLVED && t.status !== TICKET_STATUS.CLOSED,
  );
}

export async function fetchSolvedTickets(entityId?: number): Promise<Ticket[]> {
  return fetchAllTickets({ status: TICKET_STATUS.SOLVED as TicketStatus, entityId });
}

export async function fetchClosedTickets(entityId?: number): Promise<Ticket[]> {
  return fetchAllTickets({ status: TICKET_STATUS.CLOSED as TicketStatus, entityId });
}

// ─── Créer un ticket ──────────────────────────────────────────────────────────

export interface CreateTicketPayload {
  name: string;
  content: string;
  type?: 1 | 2;
  priority?: number;
  urgency?: number;
  entitiesId?: number;
  itilcategoriesId?: number;
  usersIdRecipient?: number;
}

export async function createTicket(payload: CreateTicketPayload): Promise<{ id: number }> {
  const { default: glpiClient } = await import('./glpiClient');
  const { getCurrentSession } = await import('./sessionService');
  
  const session = getCurrentSession();
  const currentEntityId = session ? session.glpiactive_entity : 0;
  const currentUserId = session ? session.glpiID : 0;

  const { data } = await glpiClient.post<{ id: number }>(GLPI_ENDPOINTS.TICKET, {
    input: {
      name: payload.name,
      content: payload.content,
      type: payload.type ?? 1,
      status: 1,
      urgency: payload.urgency ?? 3,
      impact: 3,
      priority: payload.priority ?? 3,
      entities_id: currentEntityId,
      requesttypes_id: 1,
      _users_id_requester: currentUserId,
      users_id_recipient: currentUserId,
    },
  });
  return data;
}

export async function associateItemToTicket(ticketId: number, itemType: string, itemId: number): Promise<void> {
  const { default: glpiClient } = await import('./glpiClient');
  await glpiClient.post('/Item_Ticket', {
    input: {
      tickets_id: ticketId,
      itemtype: itemType,
      items_id: itemId,
    },
  });
}

// ─── Mettre à jour un ticket ──────────────────────────────────────────────────

export interface UpdateTicketPayload {
  name?: string;
  content?: string;
  type?: 1 | 2;
  status?: number;
  priority?: number;
  urgency?: number;
  impact?: number;
  itilcategories_id?: number;
  assignedUserId?: number;
  assignedGroupId?: number;
}

export async function updateTicket(id: number, payload: UpdateTicketPayload): Promise<{ id: number }> {
  const { default: glpiClient } = await import('./glpiClient');
  
  const { data } = await glpiClient.put<{ id: number }>(`${GLPI_ENDPOINTS.TICKET}/${id}`, {
    input: payload
  });
  
  console.log(`[GLPI] Ticket #${id} mis à jour:`, payload);
  return data;
}

export async function updateTicketStatus(id: number, status: number): Promise<{ id: number }> {
  return updateTicket(id, { status });
}

export async function addTicketFollowup(ticketId: number, content: string, isPrivate: boolean = false): Promise<{ id: number }> {
  const { default: glpiClient } = await import('./glpiClient');
  
  const { data } = await glpiClient.post('/ITILFollowup', {
    input: {
      itemtype: 'Ticket',
      items_id: ticketId,
      content: content,
      is_private: isPrivate ? 1 : 0,
      requesttypes_id: 1
    }
  });
  
  console.log(`[GLPI] Suivi ajouté au ticket #${ticketId}`);
  return data;
}

export async function addTicketSolution(ticketId: number, content: string): Promise<{ id: number }> {
  const { default: glpiClient } = await import('./glpiClient');
  
  const { data } = await glpiClient.post('/ITILSolution', {
    input: {
      itemtype: 'Ticket',
      items_id: ticketId,
      content: content,
      solutiontypes_id: 1
    }
  });
  
  console.log(`[GLPI] Solution ajoutée au ticket #${ticketId}`);
  await updateTicketStatus(ticketId, 5);
  
  return data;
}