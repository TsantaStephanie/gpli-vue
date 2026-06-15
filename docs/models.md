# Modèles de données

## Ticket

Fichier : `src/models/Ticket.ts`

### Statuts

| Valeur | Label |
|--------|-------|
| `1` | Nouveau |
| `2` | En cours (assigné) |
| `3` | En cours (planifié) |
| `4` | En attente |
| `5` | Résolu |
| `6` | Fermé |

```ts
import { TICKET_STATUS_LABELS } from '@/models/Ticket'
// TICKET_STATUS_LABELS[2] → "En cours (assigné)"
```

### Priorités

| Valeur | Label |
|--------|-------|
| `1` | Très basse |
| `2` | Basse |
| `3` | Moyenne |
| `4` | Haute |
| `5` | Très haute |
| `6` | Majeure |

### Interface GlpiTicket (brute API)

```ts
interface GlpiTicket {
  id: number
  name: string          // titre
  content: string       // description (HTML)
  status: TicketStatus
  priority: TicketPriority
  entities_id: number
  locations_id?: number
  date?: string         // ISO 8601
  date_mod?: string
  solvedate?: string
  is_deleted: number    // 0 | 1
}
```

### Interface Ticket (locale)

```ts
interface Ticket {
  id: number
  title: string         // = name
  description: string   // = content
  status: TicketStatus
  statusLabel: string   // label traduit
  priority: TicketPriority
  priorityLabel: string
  entityId: number
  isDeleted: boolean
  createdAt?: string
  updatedAt?: string
}
```

### Mapper

```ts
import { mapGlpiTicketToTicket } from '@/models/Ticket'

const ticket = mapGlpiTicketToTicket(rawFromApi)
```

---

## TicketCostRecord

Fichier : `src/services/api/ticketCostService.ts`

```ts
type CostSource = 'glpi' | 'kanban' | 'reopen'

interface TicketCostRecord {
  id:          number
  ticketId:    number
  ticketTitle: string
  fixedCost:   number         // coût total du ticket
  itemCount:   number         // nombre d'actifs liés
  itemTypes:   string         // JSON : '["Computer","Monitor"]'
  source:      CostSource
  createdAt:   string
}
```

**Règle de répartition** : `fixedCost / itemCount` distribué à chaque type d'actif.

### Sources

| Source | Origine |
|--------|---------|
| `'kanban'` | Coût saisi manuellement lors du passage en "Terminé" |
| `'reopen'` | Surcharge % lors d'une réouverture de ticket |
| `'glpi'`   | Import depuis GLPI (`TicketCost.cost_fixed + cost_time × heures + cost_material`) |

---

## Types d'actifs GLPI

| itemtype | Label français |
|----------|---------------|
| `Computer` | Ordinateur |
| `Monitor` | Écran |
| `Printer` | Imprimante |
| `Phone` | Téléphone |
| `NetworkEquipment` | Équipement réseau |
| `Peripheral` | Périphérique |

Défini dans `CostReportView.vue` :

```ts
const ITEM_TYPE_LABELS: Record<string, string> = {
  Computer:         'Ordinateur',
  Monitor:          'Écran',
  Printer:          'Imprimante',
  Phone:            'Téléphone',
  NetworkEquipment: 'Équipement réseau',
  Peripheral:       'Périphérique',
}
```

---

## Asset (actif)

Fichier : `src/models/Asset.ts`

Les actifs GLPI peuvent être : `Computer`, `Monitor`, `Printer`, `Phone`, `NetworkEquipment`, `Peripheral`. Chaque type a son propre endpoint GLPI (`/Computer`, `/Monitor`, etc.).
