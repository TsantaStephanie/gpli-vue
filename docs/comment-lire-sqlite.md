# Comment lire des données SQLite dans Vue

## Principe

```
Vue (fetch) → Spring Boot (/api/...) → SQLite → JSON → Vue (ref)
```

Le backend Spring Boot expose des endpoints REST. Vue appelle ces endpoints avec `axios` et stocke le résultat dans un `ref`.

---

## Exemple complet — lire tous les coûts

### 1. Le endpoint existe déjà dans le backend

```
GET /api/ticket-costs   →   retourne [ { id, ticketId, fixedCost, ... }, ... ]
```

### 2. La fonction qui appelle le backend (service)

Fichier : `src/services/api/ticketCostService.ts`

```ts
import axios from 'axios'

export interface TicketCostRecord {
  id:          number
  ticketId:    number
  ticketTitle: string
  fixedCost:   number
  itemTypes:   string   // '["Computer","Monitor"]'
  source:      string
  createdAt:   string
}

export async function getAllTicketCosts(): Promise<TicketCostRecord[]> {
  const res = await axios.get<TicketCostRecord[]>('/api/ticket-costs')
  return res.data
}
```

### 3. L'appel dans le composant Vue

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAllTicketCosts, type TicketCostRecord } from '@/services/api/ticketCostService'

const records = ref<TicketCostRecord[]>([])
const loading = ref(false)

async function charger() {
  loading.value = true
  records.value = await getAllTicketCosts()
  loading.value = false
}

onMounted(charger)   // chargement automatique à l'ouverture de la page
</script>

<template>
  <div v-if="loading">Chargement…</div>
  <div v-for="r in records" :key="r.id">
    Ticket #{{ r.ticketId }} — {{ r.fixedCost }} Ar
  </div>
</template>
```

---

## Exemple — lire le dernier coût d'un ticket précis

```ts
// service
export async function getLatestTicketCost(ticketId: number): Promise<TicketCostRecord | null> {
  try {
    const res = await axios.get<TicketCostRecord>(`/api/ticket-costs/ticket/${ticketId}/latest`)
    return res.data
  } catch {
    return null   // 404 si aucun coût → on retourne null
  }
}
```

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getLatestTicketCost } from '@/services/api/ticketCostService'

const dernierCout = ref<number | null>(null)

onMounted(async () => {
  const record = await getLatestTicketCost(42)   // ticketId = 42
  if (record) {
    dernierCout.value = record.fixedCost
  }
})
</script>
```

---

## Exemple — enregistrer (POST) dans SQLite

```ts
// service
export async function saveTicketCost(payload: TicketCostPayload): Promise<TicketCostRecord> {
  const res = await axios.post<TicketCostRecord>('/api/ticket-costs', payload)
  return res.data
}
```

```vue
<script setup lang="ts">
import { saveTicketCost } from '@/services/api/ticketCostService'

async function enregistrer() {
  const record = await saveTicketCost({
    ticketId:    5,
    ticketTitle: 'Problème réseau',
    fixedCost:   150,
    itemCount:   1,
    itemTypes:   '["Computer"]',
    source:      'kanban',
  })
  console.log('Sauvegardé avec ID :', record.id)
}
</script>
```

---

## Exemple — supprimer (DELETE) dans SQLite

```ts
// service
export async function deleteLatestTicketCost(ticketId: number): Promise<void> {
  await axios.delete(`/api/ticket-costs/ticket/${ticketId}/latest`)
}
```

```vue
<script setup lang="ts">
import { deleteLatestTicketCost } from '@/services/api/ticketCostService'

async function supprimer(ticketId: number) {
  await deleteLatestTicketCost(ticketId)
  console.log('Dernier coût supprimé pour ticket', ticketId)
}
</script>
```

---

## Schéma récapitulatif

```
Vue composant
  └── appelle getAllTicketCosts()          ← fonction dans services/api/
        └── axios.get('/api/ticket-costs') ← appel HTTP vers Spring Boot
              └── TicketCostController.java → TicketCostService.java → SQLite
                    └── retourne JSON → stocké dans records.value (ref)
```
