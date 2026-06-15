# Kanban

## Vue d'ensemble

Fichier : `src/views/front/KanbanView.vue`
Route : `/front/kanban`

Le Kanban affiche les tickets en colonnes selon leur statut. Les colonnes sont configurables depuis `KanbanSettingsView`.

---

## Colonnes et statuts

Chaque colonne correspond à un statut GLPI :

| Statut GLPI | Valeur |
|-------------|--------|
| Nouveau | `1` |
| En cours (assigné) | `2` |
| En cours (planifié) | `3` |
| En attente | `4` |
| Résolu | `5` |
| Fermé | `6` |

---

## Drag & Drop (changement de statut)

Glisser une carte vers une autre colonne appelle `applyStatusChange(ticket, newStatus)`.

```ts
async function applyStatusChange(ticket: Ticket, newStatus: number) {
  // 1. Mise à jour optimiste locale (UI réactive immédiatement)
  ticket.status = newStatus as TicketStatus

  // 2. Appel API GLPI
  try {
    await updateTicketStatus(ticket.id, newStatus)
  } catch (e) {
    // 3. Rollback si l'API échoue
    ticket.status = oldStatus
    console.error('[Kanban] Rollback status:', e)
  }
}
```

---

## Dialog "Terminer" (saisie du coût)

Quand un ticket est glissé vers la colonne **Terminé** (statut 5 ou 6), un dialog s'ouvre pour saisir le coût.

```
┌─────────────────────────────────┐
│  Ticket terminé                 │
│  Coût : [___________] Ar        │
│                                 │
│  [Annuler]    [Confirmer]       │
└─────────────────────────────────┘
```

Le coût saisi est enregistré dans SQLite via `saveTicketCost()` avec `source: 'kanban'`.

```ts
await saveTicketCost({
  ticketId:    ticket.id,
  ticketTitle: ticket.title,
  fixedCost:   coutSaisi,
  itemCount:   items.length || 1,
  itemTypes:   JSON.stringify(items.map(i => i.itemtype)),
  source:      'kanban',
})
```

---

## Dialog "Réouverture" (surcharge %)

Quand un ticket déjà **Terminé** est ramené en **En cours**, un dialog de réouverture s'affiche avec 3 boutons.

```
┌────────────────────────────────────────┐
│  Réouverture du ticket                 │
│                                        │
│  Dernier coût : 500 Ar                 │
│  Surcharge : [10] %  → + 50 Ar         │
│                                        │
│  [Fermer]  [Annuler — suppr. coût]  [Réouverture +10%] │
└────────────────────────────────────────┘
```

### Comportement des 3 boutons

| Bouton | Action |
|--------|--------|
| **Fermer** | Ferme le dialog, rien ne change |
| **Annuler — supprimer le coût** | Change le statut → En cours + **supprime** le dernier coût SQLite |
| **Réouverture +X%** | Change le statut → En cours + **ajoute** un coût de type `'reopen'` |

```ts
// Annuler : suppression du dernier coût
async function annulerFermeture() {
  await applyStatusChange(ticket, 2)
  await deleteLatestTicketCost(ticket.id)
}

// Confirmer +% : ajout d'un coût de réouverture
async function confirmCancelDialog() {
  await applyStatusChange(ticket, 2)
  if (reopenCost.value > 0) {
    await saveTicketCost({
      ticketId: ticket.id,
      fixedCost: reopenCost.value,   // = dernierCoût × pct / 100
      source: 'reopen',
      ...
    })
  }
}
```

---

## Calcul du coût de réouverture

```ts
const reopenCost = computed(() => {
  const pct = Number(reopenPct.value)        // % saisi
  if (!pct || !cancelCostBase.value) return 0
  return Math.round(cancelCostBase.value * pct / 100 * 100) / 100
})
```

`cancelCostBase` est le `fixedCost` du dernier enregistrement SQLite pour ce ticket.

---

## Services utilisés

```ts
import { saveTicketCost, getLatestTicketCost, deleteLatestTicketCost }
  from '@/services/api/ticketCostService'

import { updateTicketStatus, fetchTicketItems }
  from '@/services/api/ticketService'
```

---

## Paramètres Kanban

Configurables dans `/kanban-settings` :
- Couleur de chaque colonne
- Nom affiché de chaque colonne
- Colonnes visibles / masquées

Stocké dans SQLite via `kanbanSettingsService.ts`.
