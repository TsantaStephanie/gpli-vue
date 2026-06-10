import { glpiClient } from './glpiClient';

const itemtypesToDelete = [
  // Parc
  'Computer', 'Monitor', 'Printer', 'Phone', 'NetworkEquipment', 'Peripheral',
  // Logiciels
  'Software',
  // ITIL
  'Ticket', 'Problem', 'Change',
  // Référentiels
  'SLA', 'ITILCategory', 'Location',
  // Divers
  'Budget', 'Document',
];

const RESET_TIMEOUT = 120_000; // 2 min — les purges en masse peuvent être lentes

async function fetchAllIds(itemtype: string): Promise<number[]> {
  const ids: number[] = [];

  // Éléments actifs
  try {
    const { data } = await glpiClient.get(`/${itemtype}`, {
      params: { range: '0-9999' },
      timeout: RESET_TIMEOUT,
    });
    if (Array.isArray(data)) ids.push(...data.map((i: any) => i.id));
  } catch {}

  // Éléments déjà en corbeille (is_deleted=1)
  try {
    const { data } = await glpiClient.get(`/${itemtype}`, {
      params: { range: '0-9999', is_deleted: 1 },
      timeout: RESET_TIMEOUT,
    });
    if (Array.isArray(data)) ids.push(...data.map((i: any) => i.id));
  } catch {}

  return [...new Set(ids)];
}

type ProgressCallback = (itemtype: string, status: 'processing' | 'done' | 'error', count: number) => void

const resetDatabase = async (onProgress?: ProgressCallback) => {
  const results = [];

  for (const itemtype of itemtypesToDelete) {
    onProgress?.(itemtype, 'processing', 0);
    try {
      const ids = await fetchAllIds(itemtype);

      if (ids.length === 0) {
        onProgress?.(itemtype, 'done', 0);
        results.push({ itemtype, success: true, count: 0, message: 'Aucun élément à supprimer.' });
        continue;
      }

      const response = await glpiClient.delete(`/${itemtype}`, {
        params: { force_purge: 1 },
        data: { input: ids.map(id => ({ id })) },
        timeout: RESET_TIMEOUT,
      });

      onProgress?.(itemtype, 'done', ids.length);
      results.push({
        itemtype,
        success: true,
        count: ids.length,
        message: `${ids.length} élément(s) supprimé(s) définitivement.`,
        data: response.data,
      });
    } catch (error: any) {
      onProgress?.(itemtype, 'error', 0);
      results.push({ itemtype, success: false, count: 0, error });
    }
  }

  return results;
};

export const resetService = { resetDatabase };
