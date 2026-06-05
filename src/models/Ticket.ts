/**
 * Modèle GLPI : Ticket (Support / Helpdesk)
 * Endpoint API : GET /apirest.php/Ticket
 */

// ─── Enums de statut, priorité, urgence ──────────────────────────────────────

export type TicketStatus =
  | 1   // Nouveau
  | 2   // En cours (assigné)
  | 3   // En cours (planifié)
  | 4   // En attente
  | 5   // Résolu
  | 6;  // Fermé

export type TicketPriority =
  | 1   // Très basse
  | 2   // Basse
  | 3   // Moyenne
  | 4   // Haute
  | 5   // Très haute
  | 6;  // Majeure

export type TicketType =
  | 1   // Incident
  | 2;  // Demande

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  1: 'Nouveau',
  2: 'En cours (assigné)',
  3: 'En cours (planifié)',
  4: 'En attente',
  5: 'Résolu',
  6: 'Fermé',
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  1: 'Très basse',
  2: 'Basse',
  3: 'Moyenne',
  4: 'Haute',
  5: 'Très haute',
  6: 'Majeure',
};

// ─── Interface brute API GLPI ─────────────────────────────────────────────────

export interface GlpiTicket {
  id: number;
  name: string;               // titre
  content: string;            // description (HTML)
  status: TicketStatus;
  priority: TicketPriority;
  urgency: number;
  impact: number;
  type: TicketType;
  entities_id: number;
  locations_id?: number;
  itilcategories_id?: number;
  requesttypes_id?: number;
  users_id_recipient?: number;  // demandeur
  users_id_lastupdater?: number;
  is_deleted: number;
  actiontime?: number;        // durée totale en secondes
  date?: string;              // date de création
  date_mod?: string;
  solvedate?: string;
  closedate?: string;
  time_to_resolve?: string;   // SLA
}

// ─── Modèle local (store / SQLite) ───────────────────────────────────────────

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  statusLabel: string;
  priority: TicketPriority;
  priorityLabel: string;
  urgency: number;
  type: TicketType;
  entityId: number;
  locationId?: number;
  categoryId?: number;
  requesterId?: number;       // utilisateur demandeur
  actiontime?: number;        // durée totale en secondes
  isDeleted: boolean;
  createdAt?: string;
  updatedAt?: string;
  solvedAt?: string;
  closedAt?: string;
  timeToResolve?: string;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

export function mapGlpiTicketToTicket(raw: GlpiTicket): Ticket {
  return {
    id: raw.id,
    title: raw.name,
    description: raw.content ?? '',
    status: raw.status,
    statusLabel: TICKET_STATUS_LABELS[raw.status] ?? 'Inconnu',
    priority: raw.priority,
    priorityLabel: TICKET_PRIORITY_LABELS[raw.priority] ?? 'Inconnue',
    urgency: raw.urgency,
    type: raw.type,
    entityId: raw.entities_id,
    locationId: raw.locations_id,
    categoryId: raw.itilcategories_id,
    requesterId: raw.users_id_recipient,
    actiontime: raw.actiontime,
    isDeleted: raw.is_deleted === 1,
    createdAt: raw.date,
    updatedAt: raw.date_mod,
    solvedAt: raw.solvedate,
    closedAt: raw.closedate,
    timeToResolve: raw.time_to_resolve,
  };
}
