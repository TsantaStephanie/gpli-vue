# Comment passer une donnée d'un fichier à un autre

## 1. Props — du parent vers l'enfant

Le parent passe une valeur, l'enfant la reçoit en lecture seule.

### Enfant — déclare ce qu'il attend

```vue
<!-- src/components/TicketCard.vue -->
<script setup lang="ts">
const props = defineProps<{
  ticketId:    number
  ticketTitle: string
  cost?:       number   // optionnel
}>()
</script>

<template>
  <div>{{ props.ticketTitle }} — {{ props.cost ?? 0 }} Ar</div>
</template>
```

### Parent — passe les valeurs

```vue
<!-- src/views/front/KanbanView.vue -->
<script setup lang="ts">
import TicketCard from '@/components/TicketCard.vue'
</script>

<template>
  <TicketCard
    :ticketId="42"
    ticketTitle="Problème réseau"
    :cost="150"
  />
</template>
```

> `:ticketId` avec `:` = valeur dynamique (number, object, etc.)
> `ticketTitle` sans `:` = string littérale

---

## 2. Emits — de l'enfant vers le parent

L'enfant signale un événement, le parent réagit.

### Enfant — émet un événement

```vue
<!-- src/components/CostDialog.vue -->
<script setup lang="ts">
const emit = defineEmits<{
  confirmer: [cost: number]   // émet un nombre
  annuler:   []               // émet sans données
}>()

function onConfirmer() {
  emit('confirmer', 250)   // envoie 250 au parent
}

function onAnnuler() {
  emit('annuler')
}
</script>

<template>
  <button @click="onConfirmer">Confirmer</button>
  <button @click="onAnnuler">Annuler</button>
</template>
```

### Parent — écoute l'événement

```vue
<!-- src/views/front/KanbanView.vue -->
<script setup lang="ts">
import CostDialog from '@/components/CostDialog.vue'

function handleConfirmer(cost: number) {
  console.log('Coût reçu du dialog :', cost)
}

function handleAnnuler() {
  console.log('Annulé')
}
</script>

<template>
  <CostDialog
    @confirmer="handleConfirmer"
    @annuler="handleAnnuler"
  />
</template>
```

---

## 3. Service partagé — entre n'importe quels fichiers

Un fichier de service exporte des fonctions utilisables partout. C'est la méthode utilisée dans ce projet.

### Le service

```ts
// src/services/api/ticketCostService.ts
export async function saveTicketCost(payload: TicketCostPayload) {
  const res = await axios.post('/api/ticket-costs', payload)
  return res.data
}

export async function getAllTicketCosts() {
  const res = await axios.get('/api/ticket-costs')
  return res.data
}
```

### L'utiliser dans n'importe quel composant

```ts
// Dans KanbanView.vue
import { saveTicketCost } from '@/services/api/ticketCostService'

// Dans CostReportView.vue
import { getAllTicketCosts } from '@/services/api/ticketCostService'
```

---

## 4. État partagé avec un ref exporté (mini-store)

Pour partager une valeur réactive entre plusieurs composants sans props.

```ts
// src/stores/sessionStore.ts
import { ref } from 'vue'

export const currentUser = ref<string | null>(null)

export function setUser(name: string) {
  currentUser.value = name
}
```

```ts
// Dans LoginView.vue — écriture
import { setUser } from '@/stores/sessionStore'
setUser('admin')

// Dans NavBar.vue — lecture
import { currentUser } from '@/stores/sessionStore'
// currentUser.value → "admin"  (réactif, se met à jour partout)
```

---

## 5. localStorage — persister entre rechargements

Pour garder une valeur même après un refresh de page.

```ts
// Écrire
localStorage.setItem('glpi_session_token', token)

// Lire
const token = localStorage.getItem('glpi_session_token')
// → "abc123" ou null si absent

// Supprimer
localStorage.removeItem('glpi_session_token')
```

Utilisé dans ce projet pour le `Session-Token` GLPI (voir `glpiClient.ts`).

---

## Récapitulatif — quand utiliser quoi ?

| Besoin | Solution |
|--------|----------|
| Parent → Enfant (lecture) | Props |
| Enfant → Parent (événement) | Emits |
| Entre fichiers quelconques | Service exporté |
| Valeur partagée réactive (plusieurs composants) | ref exporté (store) |
| Valeur persistée entre rechargements | localStorage |
