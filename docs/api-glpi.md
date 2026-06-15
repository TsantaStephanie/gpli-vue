# API GLPI — glpiClient

## Instance Axios

Le fichier `src/services/api/glpiClient.ts` exporte une instance Axios pré-configurée.

```ts
import glpiClient from '@/services/api/glpiClient'
```

Elle ajoute automatiquement à chaque requête :
- `App-Token` (depuis `.env`)
- `Session-Token` (depuis `localStorage`)

---

## Faire une requête simple

```ts
// GET /Ticket
const { data } = await glpiClient.get('/Ticket')

// GET /Ticket/{id}
const { data } = await glpiClient.get(`/Ticket/${id}`)

// PUT /Ticket/{id}
await glpiClient.put(`/Ticket/${id}`, { input: { status: 2 } })

// POST /Ticket
await glpiClient.post('/Ticket', { input: { name: 'Mon ticket', content: '...' } })

// DELETE /TicketCost/{id}
await glpiClient.delete(`/TicketCost/${id}`)
```

**Important** : les requêtes POST et PUT vers GLPI wrappent le body dans `{ input: { ... } }`.

---

## Pagination automatique

GLPI limite les réponses à 50 items par défaut. Utiliser `fetchAllPaginated` pour tout récupérer.

```ts
import { fetchAllPaginated } from '@/services/api/glpiClient'

// Récupère tous les tickets sans limite
const tickets = await fetchAllPaginated<GlpiTicket>('/Ticket')

// Avec paramètres supplémentaires
const costs = await fetchAllPaginated('/TicketCost', { range: '0-999' })
```

GLPI retourne le header `Content-Range: items 0-49/312` — `fetchAllPaginated` lit ce header et boucle automatiquement.

---

## Endpoints fréquents

| Resource            | Endpoint                              |
|---------------------|---------------------------------------|
| Tickets             | `GET /Ticket`                         |
| Ticket par ID       | `GET /Ticket/{id}`                    |
| Actifs d'un ticket  | `GET /Ticket/{id}/Item_Ticket`        |
| Coûts d'un ticket   | `GET /Ticket/{id}/TicketCost`         |
| Tous les coûts      | `GET /TicketCost`                     |
| Créer un ticket     | `POST /Ticket`                        |
| Modifier un ticket  | `PUT /Ticket/{id}`                    |
| Suivi               | `POST /ITILFollowup`                  |
| Solution            | `POST /ITILSolution`                  |
| Lier actif          | `POST /Item_Ticket`                   |
| Session             | `GET /initSession` / `GET /killSession` |

---

## Calcul du coût total GLPI (TicketCost)

```ts
const calcTotal = (c: any): number => {
  const timeHours    = Number(c.actiontime ?? 0) / 3600
  const costHoraire  = timeHours * Number(c.cost_time ?? 0)
  const costFixe     = Number(c.cost_fixed ?? 0)
  const costMateriel = Number(c.cost_material ?? 0)
  return costHoraire + costFixe + costMateriel
}
```

---

## Gestion des erreurs

- `401` → session expirée, token effacé du localStorage
- `ECONNABORTED` → timeout réseau (configuré à 60 s)
- Erreurs GLPI renvoyées comme `[errorCode, "message"]` dans le body

---

## Variables .env nécessaires

```env
VITE_GLPI_BASE_URL=http://localhost/glpi/apirest.php
VITE_GLPI_APP_TOKEN=xxxx
VITE_GLPI_USER_TOKEN=xxxx
VITE_GLPI_LOGIN=admin
VITE_GLPI_PASSWORD=motdepasse
VITE_GLPI_AUTH_MODE=credentials   # ou 'token'
```
