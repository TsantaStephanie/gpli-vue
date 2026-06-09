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

const resetDatabase = async () => {
  const results = [];

  for (const itemtype of itemtypesToDelete) {
    try {
      const ids = await fetchAllIds(itemtype);

      if (ids.length === 0) {
        results.push({ itemtype, success: true, message: 'Aucun élément à supprimer.' });
        continue;
      }

      // Suppression définitive — force_purge=1 en query param + timeout élevé
      const response = await glpiClient.delete(`/${itemtype}`, {
        params: { force_purge: 1 },
        data: { input: ids.map(id => ({ id })) },
        timeout: RESET_TIMEOUT,
      });

      results.push({
        itemtype,
        success: true,
        message: `${ids.length} élément(s) supprimé(s) définitivement.`,
        data: response.data,
      });
    } catch (error: any) {
      results.push({ itemtype, success: false, error });
    }
  }

  return results;
};

export const resetService = { resetDatabase };
