# Rapport des coûts

## Vue d'ensemble

Fichier : `src/views/front/CostReportView.vue`
Route : `/front/costs`

Affiche un tableau des coûts distribués par type d'actif, avec 3 sources de coûts distinctes.

---

## Les 3 sources de coûts

| Source | Type | Origine |
|--------|------|---------|
| `'kanban'` | Super coût | Coût saisi manuellement lors du passage en "Terminé" dans le Kanban |
| `'glpi'` | Coût GLPI | Import des `TicketCost` depuis l'API GLPI (temps × taux + fixe + matériel) |
| `'reopen'` | Coût de réouverture | Pourcentage du dernier coût, ajouté lors d'une réouverture de ticket |

> Les anciens records sans champ `source` (valeur `null`) sont traités comme `'kanban'`.

---

## Structure du tableau

```
| Catégorie         | Super coût | Coût GLPI | Coût de réouverture | Coût total |
|-------------------|------------|-----------|---------------------|------------|
| Ordinateur        | 220,00 Ar  | 160,45 Ar | 12,50 Ar            | 392,95 Ar  |
| Écran             | 75,00 Ar   | 0,00 Ar   | 7,50 Ar             | 82,50 Ar   |
| Total             | 295,00 Ar  | 160,45 Ar | 20,00 Ar            | 475,45 Ar  |
```

---

## Logique de répartition par actif

Chaque coût est **distribué proportionnellement** entre les types d'actifs du ticket.

```
Ticket avec 2 actifs : Computer + Monitor
fixedCost = 600 Ar
→ costPerItem = 600 / 2 = 300 Ar par type
→ Computer += 300 Ar
→ Monitor  += 300 Ar
```

Code (`sumByType`) :
```ts
const costPerItem = r.fixedCost / types.length
for (const t of types) {
  map.set(t, (map.get(t) ?? 0) + costPerItem)
}
```

---

## Enrichissement des records sans itemTypes

Certains anciens records SQLite ont `itemTypes: '[]'` (sauvegardés avant que le dialog récupère les actifs). À l'ouverture de la page :

1. On identifie les records avec `itemTypes` vide
2. On fetch `GET /Ticket/{id}/Item_Ticket` pour chaque ticket concerné
3. On enrichit les records en mémoire (sans modifier SQLite)
4. Si toujours vide → classé sous `'Non catégorisé'`

```ts
const items = await fetchTicketItems(ticketId)
const types = items.map(i => i.itemtype).filter(Boolean)
```

---

## Calcul du coût GLPI

```ts
const calcTotal = (c: any): number => {
  const timeHours    = Number(c.actiontime ?? 0) / 3600
  const costHoraire  = timeHours * Number(c.cost_time ?? 0)
  const costFixe     = Number(c.cost_fixed ?? 0)
  const costMateriel = Number(c.cost_material ?? 0)
  return costHoraire + costFixe + costMateriel
}
```

Exemple : `(8 700 / 3600) × 8,7 + 50 + 109 = 160,45`

---

## Chargement parallèle (Promise.allSettled)

```ts
const [sqlite, glpi] = await Promise.allSettled([
  getAllTicketCosts(),      // SQLite — backend Spring Boot
  fetchGlpiTicketCosts(),  // GLPI API REST
])
```

`Promise.allSettled` permet d'afficher les données disponibles même si une source est indisponible.

---

## Services utilisés

```ts
import { getAllTicketCosts, fetchGlpiTicketCosts } from '@/services/api/ticketCostService'
import { fetchTicketItems } from '@/services/api/ticketService'
```

---

## Exemple de scénario complet

**Données :**
- Ticket 1 : 1 Ordinateur, coût saisi = 400 Ar, réouverture 5% = 20 Ar
- Ticket 2 : 1 Ordinateur + 1 Écran, coût saisi = 300 Ar (→ 150 Ar chacun)
- GLPI : Ticket 1 = 160,45 Ar (Ordinateur)

**Résultat :**
```
Ordinateur : super = 400 + 150 = 550 | glpi = 160,45 | reopen = 20  | total = 730,45
Écran      : super = 150             | glpi = 0       | reopen = 0   | total = 150
```
