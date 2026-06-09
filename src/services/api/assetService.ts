/**
 * assetService.ts
 * Fetch des actifs GLPI : Computers, Monitors, Printers
 * Endpoints :
 *   GET /apirest.php/Computer
 *   GET /apirest.php/Monitor
 *   GET /apirest.php/Printer
 */

import { fetchAllPaginated, glpiClient } from './glpiClient';
import { GLPI_ENDPOINTS } from '@/constants/glpi';
import {
  type Asset,
  type AssetType,
  mapRawToAsset,
} from '@/models/Asset';

// ─── Paramètres de recherche communs ─────────────────────────────────────────

export interface AssetSearchParams {
  type?: AssetType | '';
  text?: string;
  entityId?: number;
  locationId?: number;
  userId?: number;
  groupId?: number;
  status?: number;
  serial?: string;
  inventoryNumber?: string;
  includeDeleted?: boolean;
}


/**
 * Récupère le statut d'un asset par son ID et son type
 * @param itemtype - Type GLPI (Computer, Monitor, Printer, etc.)
 * @param id - ID de l'asset
 * @returns Le statut (nom) ou 'Inconnu' si non trouvé
 */
export async function getAssetStatusById(itemtype: string, id: number): Promise<string> {
  try {
    const { data } = await glpiClient.get(`/${itemtype}/${id}?expand_dropdowns=true`);
    
    // Récupérer le statut depuis states_id
    let status = 'Inconnu';
    const statusField = data.states_id;
    
    if (typeof statusField === 'object' && statusField !== null) {
      status = statusField.name || statusField.completename || 'Inconnu';
    } else if (typeof statusField === 'string') {
      status = statusField;
    } else if (typeof statusField === 'number') {
      const statusMap: Record<number, string> = {
        1: 'En production',
        2: 'En stock',
        3: 'Réformé',
        4: 'En maintenance',
        5: 'En panne',
      };
      status = statusMap[statusField] || 'Inconnu';
    }
    
    return status;
  } catch (error) {
    console.error(`Erreur récupération statut pour ${itemtype}#${id}:`, error);
    return 'Inconnu';
  }
}


function buildBaseParams(params: AssetSearchParams): Record<string, unknown> {
  // Ne pas passer is_deleted=0 : GLPI exclut déjà les supprimés par défaut.
  // is_deleted=0 active la vue "corbeille" dans certaines versions GLPI → 0 résultats.
  const q: Record<string, unknown> = {
    is_deleted: params.includeDeleted ? 1 : undefined,
  };
  return Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined));
}

// ─── Computers ────────────────────────────────────────────────────────────────

export async function fetchAllComputers(params: AssetSearchParams = {}): Promise<Asset[]> {
  const raw = await fetchAllPaginated<any>(
    GLPI_ENDPOINTS.COMPUTER,
    buildBaseParams(params),
    50,
    120_000,
  );
  return raw.map(item => mapRawToAsset(item, 'Computer'));
}

export async function fetchComputerById(id: number): Promise<Asset> {
  const { default: glpiClient } = await import('./glpiClient');
  const { data } = await glpiClient.get<any>(`${GLPI_ENDPOINTS.COMPUTER}/${id}`);
  return mapRawToAsset(data, 'Computer');
}

// ─── Monitors ─────────────────────────────────────────────────────────────────

export async function fetchAllMonitors(params: AssetSearchParams = {}): Promise<Asset[]> {
  const raw = await fetchAllPaginated<any>(
    GLPI_ENDPOINTS.MONITOR,
    buildBaseParams(params),
    50,
    120_000,
  );
  return raw.map(item => mapRawToAsset(item, 'Monitor'));
}

export async function fetchMonitorById(id: number): Promise<Asset> {
  const { default: glpiClient } = await import('./glpiClient');
  const { data } = await glpiClient.get<any>(`${GLPI_ENDPOINTS.MONITOR}/${id}`);
  return mapRawToAsset(data, 'Monitor');
}

// ─── Printers ─────────────────────────────────────────────────────────────────

export async function fetchAllPrinters(params: AssetSearchParams = {}): Promise<Asset[]> {
  const raw = await fetchAllPaginated<any>(
    GLPI_ENDPOINTS.PRINTER,
    buildBaseParams(params),
    50,
    120_000,
  );
  return raw.map(item => mapRawToAsset(item, 'Printer'));
}

export async function fetchPrinterById(id: number): Promise<Asset> {
  const { default: glpiClient } = await import('./glpiClient');
  const { data } = await glpiClient.get<any>(`${GLPI_ENDPOINTS.PRINTER}/${id}`);
  return mapRawToAsset(data, 'Printer');
}

// ─── Fetch tous les actifs (toutes catégories) ────────────────────────────────

export async function fetchAllAssets(params: AssetSearchParams = {}): Promise<Asset[]> {
  const [computers, monitors, printers] = await Promise.all([
    fetchAllComputers(params),
    fetchAllMonitors(params),
    fetchAllPrinters(params),
  ]);
  return [...computers, ...monitors, ...printers];
}

// ─── Fetch un actif par type + id ────────────────────────────────────────────

export async function fetchAssetByTypeAndId(type: AssetType, id: number): Promise<Asset> {
  switch (type) {
    case 'computer': return fetchComputerById(id);
    case 'monitor':  return fetchMonitorById(id);
    case 'printer':  return fetchPrinterById(id);
    default:
      throw new Error(`[assetService] Type d'actif non supporté : ${type}`);
  }
}

// ─── Recherche multicritères via l'API GLPI native ───────────────────────────

type GlpiSearchRow = Record<string, unknown>;

interface GlpiSearchResponse {
  data: GlpiSearchRow[];
  totalcount?: number;
  count?: number;
}

const GLPI_ITEMTYPES: Record<AssetType, string> = {
  computer: 'Computer',
  monitor: 'Monitor',
  printer: 'Printer',
  phone: 'Phone',
  network: 'NetworkEquipment',
};

const GLPI_SEARCH_FIELDS = {
  Computer: {
    id: 2,
    name: 1,
    entity: 80,
    location: 3,
    user: 70,
    group: 71,
    status: 31,
    serial: 5,
    inventory: 6,
    dateMod: 19,
  },
  Monitor: {
    id: 2,
    name: 1,
    entity: 80,
    location: 3,
    user: 70,
    group: 71,
    status: 31,
    serial: 5,
    inventory: 6,
    dateMod: 19,
  },
  Printer: {
    id: 2,
    name: 1,
    entity: 80,
    location: 3,
    user: 70,
    group: 71,
    status: 31,
    serial: 5,
    inventory: 6,
    dateMod: 19,
  },
  Phone: {
    id: 2,
    name: 1,
    entity: 80,
    location: 3,
    user: 70,
    group: 71,
    status: 31,
    serial: 5,
    inventory: 6,
    dateMod: 19,
  },
  NetworkEquipment: {
    id: 2,
    name: 1,
    entity: 80,
    location: 3,
    user: 70,
    group: 71,
    status: 31,
    serial: 5,
    inventory: 6,
    dateMod: 19,
  },
} as const;

function getSearchValue(row: GlpiSearchRow, field: number): string {
  const value = row[field] ?? row[String(field)];
  if (value === null || value === undefined) return '';
  return String(value);
}

function appendCriteria(
  params: Record<string, unknown>,
  index: number,
  field: number,
  searchtype: 'contains' | 'equals',
  value: string | number,
): number {
  if (index > 0) params[`criteria[${index}][link]`] = 'AND';
  params[`criteria[${index}][field]`] = field;
  params[`criteria[${index}][searchtype]`] = searchtype;
  params[`criteria[${index}][value]`] = value;
  return index + 1;
}

async function searchAssetsByType(type: AssetType, params: AssetSearchParams): Promise<Asset[]> {
  const { default: glpiClient } = await import('./glpiClient');
  const itemType = GLPI_ITEMTYPES[type];
  const fields = GLPI_SEARCH_FIELDS[itemType];
  
  const query: Record<string, unknown> = {
    range: '0-99',
    'forcedisplay[0]': fields.id,
    'forcedisplay[1]': fields.name,
    'forcedisplay[2]': fields.entity,
    'forcedisplay[3]': fields.location,
    'forcedisplay[4]': fields.user,
    'forcedisplay[5]': fields.status,
    'forcedisplay[6]': fields.serial,
    'forcedisplay[7]': fields.inventory,
    'forcedisplay[8]': fields.dateMod,
  };

  let index = 0;
  if (params.text) index = appendCriteria(query, index, fields.name, 'contains', params.text);
  if (params.entityId !== undefined) index = appendCriteria(query, index, fields.entity, 'equals', params.entityId);
  if (params.locationId !== undefined) index = appendCriteria(query, index, fields.location, 'equals', params.locationId);
  if (params.userId !== undefined) index = appendCriteria(query, index, fields.user, 'equals', params.userId);
  if (params.status !== undefined) index = appendCriteria(query, index, fields.status, 'equals', params.status);
  if (params.serial) index = appendCriteria(query, index, fields.serial, 'contains', params.serial);
  if (params.inventoryNumber) index = appendCriteria(query, index, fields.inventory, 'contains', params.inventoryNumber);

  const { data } = await glpiClient.get<GlpiSearchResponse>(`/search/${itemType}`, { params: query });

  return (data.data ?? []).map((row) => {
    // Récupérer la valeur du statut depuis la réponse GLPI
    const statusValue = Number(getSearchValue(row, fields.status));
    
    console.log(`[DEBUG] Asset ${getSearchValue(row, fields.name)} - status raw: ${statusValue}`);
    
    return {
      id: Number(getSearchValue(row, fields.id)),
      name: getSearchValue(row, fields.name) || `${itemType} sans nom`,
      itemtype: itemType,
      entities_id: Number(getSearchValue(row, fields.entity)) || 0,
      locations_id: Number(getSearchValue(row, fields.location)) || undefined,
      users_id: Number(getSearchValue(row, fields.user)) || undefined,
      states_id: statusValue || 1,
      serial: getSearchValue(row, fields.serial) || undefined,
      otherserial: getSearchValue(row, fields.inventory) || undefined,
      date_mod: getSearchValue(row, fields.dateMod) || undefined,
      is_deleted: false,
      // Alias pour le composant
      status: statusValue || 1,
      locationId: Number(getSearchValue(row, fields.location)) || undefined,
      userId: Number(getSearchValue(row, fields.user)) || undefined,
      entityId: Number(getSearchValue(row, fields.entity)) || 0,
      inventoryNumber: getSearchValue(row, fields.inventory) || undefined,
      updatedAt: getSearchValue(row, fields.dateMod) || undefined,
      type: type,
    } as any;
  });
}

// Dans assetService.ts, fonction temporaire
export async function debugSearchOptions(itemType: string) {
  const { default: glpiClient } = await import('./glpiClient');
  const { data } = await glpiClient.get(`/listSearchOptions/${itemType}`);
  console.log(`Search options for ${itemType}:`, data);
  return data;
}

export async function searchAssets(params: AssetSearchParams = {}): Promise<Asset[]> {
  const types: AssetType[] = params.type
    ? [params.type]
    : ['computer', 'monitor', 'printer'];

  const results = await Promise.all(types.map((type) => searchAssetsByType(type, params)));
  return results.flat();
}

export async function searchAssetsMultiCriteria(type: string, nameFilter?: string, statusFilter?: string): Promise<Asset[]> {
  const { default: glpiClient } = await import('./glpiClient');
  
  const GLPI_ITEMTYPES: Record<string, string> = {
    computer: 'Computer',
    monitor: 'Monitor',
    printer: 'Printer',
    software: 'Software',
    phone: 'Phone',
    network: 'NetworkEquipment',
  };
  const itemType = GLPI_ITEMTYPES[type] || 'Computer';
  
  // 1. Récupérer les options de recherche pour trouver dynamiquement les ID des champs
  const { data: options } = await glpiClient.get(`/listSearchOptions/${itemType}`);
  
  let nameFieldId = '1';
  let statusFieldId = '31';
  let idFieldId = '2';

  for (const [id, opt] of Object.entries(options)) {
    if (typeof opt === 'object' && opt !== null) {
      const field = (opt as any).field;
      if (field === 'name') nameFieldId = id;
      if (field === 'states_id') statusFieldId = id;
      if (field === 'id') idFieldId = id;
    }
  }

  // 2. Construire les paramètres de la requête
  const params: Record<string, string> = {};
  let critIndex = 0;
  
  if (nameFilter) {
    params[`criteria[${critIndex}][field]`] = nameFieldId;
    params[`criteria[${critIndex}][searchtype]`] = 'contains';
    params[`criteria[${critIndex}][value]`] = nameFilter;
    critIndex++;
  }
  
  if (statusFilter) {
    if (critIndex > 0) params[`criteria[${critIndex}][link]`] = 'AND';
    params[`criteria[${critIndex}][field]`] = statusFieldId;
    params[`criteria[${critIndex}][searchtype]`] = 'equals';
    params[`criteria[${critIndex}][value]`] = statusFilter;
    critIndex++;
  }

  // 3. Forcer l'affichage des colonnes nécessaires pour éviter de devoir refetch chaque élément
  params['forcedisplay[0]'] = idFieldId;
  params['forcedisplay[1]'] = nameFieldId;
  params['forcedisplay[2]'] = statusFieldId;
  // field 19 is usually date_mod
  params['forcedisplay[3]'] = '19';

  const raw = await fetchAllPaginated<Record<string, any>>(`/search/${itemType}`, params, 50, 120_000);
  
  // 4. Mapper les résultats en format Asset
  return raw.map(item => {
    return {
      id: Number(item[idFieldId]),
      type: type as AssetType,
      name: item[nameFieldId] || `Asset #${item[idFieldId]}`,
      status: Number(item[statusFieldId]) || 1,
      isDeleted: false,
      updatedAt: item['19'] || '',
      entityId: 0, // Ignoré pour l'affichage liste simple
    };
  });
}
