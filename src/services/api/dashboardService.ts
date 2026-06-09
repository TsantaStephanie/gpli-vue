// src/services/api/dashboardService.ts

import { glpiClient } from './glpiClient';

export interface DashboardStats {
  assets: {
    total: number;
    byType: Record<string, number>;
     byStatus: Record<string, number>; 
  };
  tickets: {
    total: number;
    byType: Record<number, number>;  // 1=Incident, 2=Demande
    openCount: number;
     byStatus: Record<number, number>; 
  };
}


// Ajouter les labels des statuts d'assets
export const ASSET_STATUS_LABELS: Record<string, string> = {
  'En production':  'En production',
  'En service':     'En production',
  'En stock':       'En stock',
  'Réformé':        'Réformé',
  'En maintenance': 'En maintenance',
  'En panne':       'En panne',
};

export const ASSET_STATUS_COLORS: Record<string, string> = {
  'En production':  'green',
  'En service':     'green',
  'En stock':       'yellow',
  'Réformé':        'gray',
  'En maintenance': 'orange',
  'En panne':       'red',
};

export const ASSET_TYPE_LABELS: Record<string, string> = {
  'Computer': 'Ordinateurs',
  'Monitor': 'Écrans',
  'Printer': 'Imprimantes',
  'Phone': 'Téléphones',
  'NetworkEquipment': 'Réseau'
};

export const TICKET_TYPE_LABELS: Record<number, string> = {
  1: 'Incidents',
  2: 'Demandes'
};

export const TICKET_STATUS_LABELS: Record<number, string> = {
  1: 'Nouveau',
  2: 'En cours',
  3: 'Planifié',
  4: 'En attente',
  5: 'Résolu',
  6: 'Fermé'
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const [assetsStats, ticketsStats] = await Promise.all([
    getAssetsStats(),
    getTicketsStats()
  ]);
  
  return {
    assets: assetsStats,
    tickets: ticketsStats
  };
}

const DASHBOARD_ASSET_TYPES = ['Computer', 'Monitor', 'Printer', 'Phone', 'NetworkEquipment'] as const;

async function getAssetsStats(): Promise<{ total: number; byType: Record<string, number>; byStatus: Record<string, number> }> {
  // /search/AllAssets requiert "Voir tous les matériels" (admin).
  // On utilise les endpoints directs GET /{type} (permission Lecture suffisante).
  const qs = 'expand_dropdowns=true&range=0-9999';

  const settled = await Promise.allSettled(
    DASHBOARD_ASSET_TYPES.map(type =>
      glpiClient
        .get(`/${type}?${qs}`, { timeout: 120_000 })
        .then(({ data }) => {
          const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
          return { type, items };
        })
    )
  );

  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let total = 0;

  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    const { type, items } = result.value;

    for (const item of items) {
      byType[type] = (byType[type] || 0) + 1;

      // states_id avec expand_dropdowns = objet ou entier
      let status: string;
      const s = item.states_id;
      if (!s || s === 0) {
        status = 'Inconnu';
      } else if (typeof s === 'object') {
        status = s.name || s.completename || 'Inconnu';
      } else if (typeof s === 'string') {
        status = s;
      } else {
        const map: Record<number, string> = {
          1: 'En production', 2: 'En stock', 3: 'Réformé',
          4: 'En maintenance', 5: 'En panne',
        };
        status = map[Number(s)] || 'Inconnu';
      }

      // Normalisation
      if (status === 'En service') status = 'En production';
      byStatus[status] = (byStatus[status] || 0) + 1;
      total++;
    }
  }

  return { total, byType, byStatus };
}

async function getTicketsStats(): Promise<{ total: number; byType: Record<number, number>; openCount: number; byStatus: Record<number, number> }> {
  const { data } = await glpiClient.get('/Ticket?expand_dropdowns=true&range=0-999');
  
  const byType: Record<number, number> = { 1: 0, 2: 0 };
  const byStatus: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let total = 0;
  let openCount = 0;
  
  const tickets = Array.isArray(data) ? data : (data.data || []);
  
  tickets.forEach((ticket: any) => {
    // Type
    let typeId = ticket.type;
    if (typeof typeId === 'object' && typeId !== null) typeId = typeId.id;
    typeId = Number(typeId);
    if (typeId !== 1 && typeId !== 2) typeId = 1;
    byType[typeId] = (byType[typeId] || 0) + 1;
    
    // Statut
    let statusId = ticket.status;
    if (typeof statusId === 'object' && statusId !== null) statusId = statusId.id;
    statusId = Number(statusId) || 1;
    byStatus[statusId] = (byStatus[statusId] || 0) + 1;
    
    total++;
    
    // Tickets ouverts = statuts 1,2,3,4
    if (statusId >= 1 && statusId <= 4) openCount++;
  });
  
  console.log('📊 Stats tickets:', { total, byType, byStatus, openCount });
  
  return { total, byType, openCount, byStatus };
}