/**
 * ticketService.ts
 * Fetch et gestion des tickets GLPI (Support / Helpdesk)
 * Endpoint : GET /apirest.php/Ticket
 */

import { fetchAllPaginated } from './glpiClient';
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

function buildTicketParams(params: TicketSearchParams): Record<string, unknown> {
  const q: Record<string, unknown> = {
    is_deleted: params.includeDeleted ? undefined : 0,
  };
  if (params.entityId        !== undefined) q['searchText[entities_id]']       = params.entityId;
  if (params.status          !== undefined) q['searchText[status]']             = params.status;
  if (params.requesterId     !== undefined) q['searchText[users_id_recipient]'] = params.requesterId;
  if (params.assignedUserId  !== undefined) q['searchText[_users_id_assign]']   = params.assignedUserId;
  return Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined));
}

// ─── Fetch tous les tickets ───────────────────────────────────────────────────

export async function fetchAllTickets(params: TicketSearchParams = {}): Promise<Ticket[]> {
  const raw = await fetchAllPaginated<GlpiTicket>(
    GLPI_ENDPOINTS.TICKET,
    buildTicketParams(params),
  );
  return raw.map(mapGlpiTicketToTicket);
}

// ─── Fetch un ticket par ID ───────────────────────────────────────────────────

export async function fetchTicketById(id: number): Promise<Ticket> {
  const { default: glpiClient } = await import('./glpiClient');
  const { data } = await glpiClient.get<GlpiTicket>(`${GLPI_ENDPOINTS.TICKET}/${id}`);
  return mapGlpiTicketToTicket(data);
}

// ─── Fetch tickets par statut (raccourcis utiles) ─────────────────────────────

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

// ─── Types et fetch des suivis ────────────────────────────────────────────────

export interface GlpiFollowup {
  id: number
  items_id: number
  itemtype: string
  users_id: number
  date: string
  date_mod: string
  content: string
  is_private: number
}

export interface Followup {
  id: number
  ticketId: number
  userId: number
  date: string
  content: string
  isPrivate: boolean
}

export async function fetchTicketFollowups(ticketId: number): Promise<Followup[]> {
  try {
    const raw = await fetchAllPaginated<GlpiFollowup>(
      GLPI_ENDPOINTS.TICKET_FOLLOWUP,
      { 'searchText[items_id]': ticketId },
    )
    return raw
      .filter(f => f.items_id === ticketId && f.itemtype === 'Ticket')
      .map(f => ({
        id: f.id,
        ticketId: f.items_id,
        userId: f.users_id,
        date: f.date,
        content: f.content ?? '',
        isPrivate: f.is_private === 1,
      }))
  } catch {
    return []
  }
}

// ─── Créer un ticket ──────────────────────────────────────────────────────────

export interface CreateTicketPayload {
  name: string;
  content: string;
  type?: 1 | 2;         // 1=Incident, 2=Demande
  priority?: number;    // 1–6
  urgency?: number;     // 1–6
  entitiesId?: number;
  itilcategoriesId?: number;
  usersIdRecipient?: number;
}

export async function createTicket(payload: CreateTicketPayload): Promise<{ id: number }> {
  const { default: glpiClient } = await import('./glpiClient');
  const { data } = await glpiClient.post<{ id: number }>(GLPI_ENDPOINTS.TICKET, {
    input: {
      name: payload.name,
      content: payload.content,
      type: payload.type ?? 1,
      priority: payload.priority ?? 3,
      urgency: payload.urgency ?? 3,
      entities_id: payload.entitiesId ?? 0,
      itilcategories_id: payload.itilcategoriesId,
      users_id_recipient: payload.usersIdRecipient,
    },
  });
  return data;
}
