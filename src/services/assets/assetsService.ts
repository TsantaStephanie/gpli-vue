// src/services/assets/assetsService.ts

import { glpiClient } from '../api/glpiClient';

// ============================================================
// 1. TYPES
// ============================================================

export interface AssetSearchParams {
  text?: string;
  type?: string;
  entityId?: number;
  locationId?: number;
  userId?: number;
  status?: string;
  serial?: string;
  inventoryNumber?: string;
  includeDeleted?: boolean;
}

export interface Asset {
  id: number;
  name: string;
  type: string;
  status: string;
  entityId: number;
  entityName: string;
  locationId: number;
  locationName: string;
  userId: number;
  userName: string;
  serial: string | null;
  inventoryNumber: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  comment?: string | null;
  picture: string | null;
}

// Cache de la liste complète (vidé par RefreshCache)
let cachedAssets: Asset[] | null = null;

// ============================================================
// 2. TYPES D'ACTIFS
//    On utilise les endpoints directs GET /{type} (permission
//    "Lecture" suffisante) et non /search/{type} (nécessite
//    "Rechercher", souvent refusé aux profils limités).
// ============================================================

const ASSET_TYPES = [
  'Computer',
  'Monitor',
  'Printer',
  'Phone',
  'NetworkEquipment',
] as const;

// ============================================================
// 3. CHARGEMENT — GET /{type}?expand_dropdowns=true par type
// ============================================================

export async function GetAssets(): Promise<Asset[]> {
  if (cachedAssets) return cachedAssets;

  console.log('🔄 Chargement des actifs...');

  // expand_dropdowns=true : GLPI résout les FK en objets { id, name, completename }
  // range=0-9999         : récupère tous les éléments en un appel
  const qs = 'expand_dropdowns=true&range=0-9999';

  const settled = await Promise.allSettled(
    ASSET_TYPES.map(type =>
      glpiClient
        .get(`/${type}?${qs}`, { timeout: 120_000 })
        .then(({ data }) => {
          const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
          // Rejette les réponses GLPI de type [errorCode, "message"]
          if (items.length > 0 && typeof items[0] === 'number') return [] as Asset[];
          return items.map(item => transformItem(item, type));
        })
    )
  );

  const assets: Asset[] = [];
  let forbidden = 0;

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      assets.push(...result.value);
    } else {
      const msg: string = (result.reason as any)?.message ?? String(result.reason);
      console.warn('⚠️ Type d\'actif ignoré :', msg);
      if (msg.includes('403') || msg.toLowerCase().includes('permission')) forbidden++;
    }
  }

  // Si TOUS les types sont refusés, on lève une erreur explicite
  if (forbidden === ASSET_TYPES.length) {
    throw new Error(
      'Accès refusé (403) sur tous les types d\'actifs.\n' +
      'Vérifiez que le profil GLPI de cet utilisateur dispose du droit ' +
      '"Lecture" sur Computer, Monitor, Printer, Phone et NetworkEquipment.'
    );
  }

  cachedAssets = assets;
  console.log(`✅ ${cachedAssets.length} assets chargés`);
  return cachedAssets;
}

// ============================================================
// 4. TRANSFORMATION depuis GET /{type}?expand_dropdowns=true
// ============================================================

/**
 * Résout un champ FK retourné par expand_dropdowns.
 * GLPI renvoie soit :
 *   - un objet  { id, name, completename }
 *   - un entier (si la FK vaut 0 ou sans expansion)
 *   - 0 / null
 */
function resolveFK(val: any): { id: number; label: string } {
  if (!val || val === 0) return { id: 0, label: '-' };
  if (typeof val === 'object') {
    const label = val.completename || val.name || '-';
    return { id: Number(val.id) || 0, label };
  }
  // Entier brut (pas d'expansion) → on garde l'ID, le label sera l'ID
  return { id: Number(val) || 0, label: String(val) };
}

function resolveStatus(val: any): string {
  if (!val || val === 0) return 'Inconnu';
  if (typeof val === 'object') return val.name || val.completename || 'Inconnu';
  if (typeof val === 'string' && val.trim()) return val;
  if (typeof val === 'number') {
    const map: Record<number, string> = {
      1: 'En production', 2: 'En stock', 3: 'Réformé',
      4: 'En maintenance', 5: 'En panne',
    };
    return map[val] || 'Inconnu';
  }
  return 'Inconnu';
}

function transformItem(item: any, type: string): Asset {
  const entity   = resolveFK(item.entities_id);
  const location = resolveFK(item.locations_id);
  const user     = resolveFK(item.users_id);

  return {
    id:              Number(item.id)     || 0,
    name:            String(item.name   || 'Sans nom'),
    type,
    status:          resolveStatus(item.states_id),
    entityId:        entity.id,
    entityName:      entity.label,
    locationId:      location.id,
    locationName:    location.label,
    userId:          user.id,
    userName:        user.label,
    serial:          item.serial      ? String(item.serial)      : null,
    inventoryNumber: item.otherserial ? String(item.otherserial) : null,
    updatedAt:       item.date_mod    ? String(item.date_mod)    : null,
    createdAt:       item.date_creation ? String(item.date_creation) : null,
    comment:         item.comment    ? String(item.comment)      : null,
    picture:         item.picture_front ? String(item.picture_front) : null,
  };
}

// ============================================================
// 5. RECHERCHE — filtrage client sur les données déjà chargées
// ============================================================

export async function SearchAssets(params: AssetSearchParams = {}): Promise<Asset[]> {
  const all = await GetAssets();
  let filtered = [...all];

  if (params.type?.trim())
    filtered = filtered.filter(a => a.type === params.type);

  if (params.text?.trim()) {
    const t = params.text.trim().toLowerCase();
    filtered = filtered.filter(a => a.name.toLowerCase().includes(t));
  }
  if (params.status?.trim()) {
    const s = params.status.trim().toLowerCase();
    filtered = filtered.filter(a => a.status.toLowerCase().includes(s));
  }
  if (params.serial?.trim()) {
    const s = params.serial.trim().toLowerCase();
    filtered = filtered.filter(a => a.serial?.toLowerCase().includes(s));
  }
  if (params.inventoryNumber?.trim()) {
    const n = params.inventoryNumber.trim().toLowerCase();
    filtered = filtered.filter(a => a.inventoryNumber?.toLowerCase().includes(n));
  }

  return filtered;
}

// ============================================================
// 6. UTILITAIRES
// ============================================================

export async function GetAssetTypes(): Promise<{ value: string; label: string; count: number }[]> {
  const assets = await GetAssets();
  const counts = new Map<string, number>();
  assets.forEach(a => counts.set(a.type, (counts.get(a.type) || 0) + 1));

  const results = Array.from(counts.entries())
    .map(([type, count]) => ({ value: type, label: getTypeLabel(type), count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [
    { value: '', label: 'Tous les types', count: assets.length },
    ...results,
  ];
}

export async function GetStatusOptions(): Promise<{ value: string; label: string }[]> {
  const assets = await GetAssets();
  const statusSet = new Set<string>();
  assets.forEach(a => { if (a.status && a.status !== 'Inconnu') statusSet.add(a.status); });

  return [
    { value: '', label: 'Tous les statuts' },
    ...Array.from(statusSet).sort().map(s => ({ value: s, label: s })),
  ];
}

export async function RefreshCache(): Promise<void> {
  cachedAssets = null;
  await GetAssets();
}

export async function GetAssetById(type: string, id: number): Promise<Asset | null> {
  const all = await GetAssets();
  return all.find(a => a.type === type && a.id === id) ?? null;
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    Computer: 'Ordinateurs', Monitor: 'Écrans', Printer: 'Imprimantes',
    Phone: 'Téléphones', NetworkEquipment: 'Réseau', Peripheral: 'Périphériques',
  };
  return labels[type] || type;
}
