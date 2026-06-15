# Comment créer un service API

## Principe

Un service est un fichier TypeScript dans `src/services/api/` qui regroupe toutes les fonctions d'appel à une API (GLPI ou backend SQLite). Les composants Vue importent ces fonctions au lieu de faire des appels axios directement.

```
src/services/api/
├── glpiClient.ts          ← instance axios GLPI (session token)
├── ticketCostService.ts   ← coûts (SQLite backend)
├── ticketService.ts       ← tickets (GLPI)
├── sessionService.ts      ← session GLPI
└── monNouveauService.ts   ← ton nouveau service
```

---

## Structure d'un service complet

```ts
// src/services/api/equipementService.ts

import axios from 'axios'
import glpiClient from './glpiClient'   // si appel GLPI

const BASE = '/api/equipements'   // endpoint de ton backend Spring Boot

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Equipement {
  id:       number
  nom:      string
  type:     string
  ticketId: number
}

// ─── Lire (GET) ───────────────────────────────────────────────────────────────

export async function getAllEquipements(): Promise<Equipement[]> {
  const res = await axios.get<Equipement[]>(BASE)
  return res.data
}

export async function getEquipementById(id: number): Promise<Equipement | null> {
  try {
    const res = await axios.get<Equipement>(`${BASE}/${id}`)
    return res.data
  } catch {
    return null   // 404 → retourner null plutôt que crasher
  }
}

// ─── Créer (POST) ─────────────────────────────────────────────────────────────

export interface CreateEquipementPayload {
  nom:      string
  type:     string
  ticketId: number
}

export async function createEquipement(payload: CreateEquipementPayload): Promise<Equipement> {
  const res = await axios.post<Equipement>(BASE, payload)
  return res.data
}

// ─── Modifier (PUT) ───────────────────────────────────────────────────────────

export async function updateEquipement(id: number, changes: Partial<Equipement>): Promise<Equipement> {
  const res = await axios.put<Equipement>(`${BASE}/${id}`, changes)
  return res.data
}

// ─── Supprimer (DELETE) ───────────────────────────────────────────────────────

export async function deleteEquipement(id: number): Promise<void> {
  await axios.delete(`${BASE}/${id}`)
}
```

---

## Utiliser ce service dans un composant Vue

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  getAllEquipements,
  createEquipement,
  deleteEquipement,
  type Equipement,
} from '@/services/api/equipementService'

const equipements = ref<Equipement[]>([])
const loading     = ref(false)

async function charger() {
  loading.value     = true
  equipements.value = await getAllEquipements()
  loading.value     = false
}

async function ajouter() {
  const nouveau = await createEquipement({ nom: 'PC-001', type: 'Computer', ticketId: 5 })
  equipements.value.push(nouveau)   // mise à jour locale immédiate
}

async function supprimer(id: number) {
  await deleteEquipement(id)
  equipements.value = equipements.value.filter(e => e.id !== id)
}

onMounted(charger)
</script>
```

---

## Service qui appelle GLPI (pas le backend SQLite)

```ts
// src/services/api/categorieService.ts
import glpiClient from './glpiClient'    // utilise glpiClient, pas axios

export interface GlpiCategorie {
  id:   number
  name: string
}

export async function getAllCategories(): Promise<GlpiCategorie[]> {
  const { data } = await glpiClient.get('/ITILCategory', {
    params: { range: '0-999' }
  })
  return Array.isArray(data) ? data : []
}
```

---

## Différence : axios vs glpiClient

| | `axios` | `glpiClient` |
|---|---------|-------------|
| **Cible** | Backend Spring Boot (`/api/...`) | API GLPI (`/Ticket`, `/TicketCost`, etc.) |
| **Auth** | Aucune (même domaine) | Ajoute `App-Token` + `Session-Token` automatiquement |
| **Import** | `import axios from 'axios'` | `import glpiClient from '@/services/api/glpiClient'` |

---

## Bonne pratique : console.log dans le service

```ts
export async function saveEquipement(payload: CreateEquipementPayload): Promise<Equipement> {
  console.log('[Equipement] saveEquipement payload:', payload)
  const res = await axios.post<Equipement>(BASE, payload)
  console.log('[Equipement] sauvegardé, id:', res.data.id)
  return res.data
}
```
