# Comment gérer les erreurs

## try/catch autour d'un appel API

```ts
try {
  const records = await getAllTicketCosts()
  console.log('[OK] Chargé :', records.length, 'records')
} catch (e) {
  console.error('[Erreur] getAllTicketCosts :', e)
}
```

---

## Afficher l'erreur dans le template

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'

const records = ref([])
const loading = ref(false)
const erreur  = ref('')

async function charger() {
  loading.value = true
  erreur.value  = ''
  try {
    records.value = await getAllTicketCosts()
  } catch (e: any) {
    erreur.value = e?.message ?? 'Erreur inconnue'
    console.error('[charger]', e)
  } finally {
    loading.value = false   // exécuté même si erreur
  }
}

onMounted(charger)
</script>

<template>
  <div v-if="loading">Chargement…</div>
  <div v-else-if="erreur" style="color: red">{{ erreur }}</div>
  <div v-else>{{ records.length }} résultats</div>
</template>
```

---

## Erreur silencieuse (warn sans bloquer)

Quand l'échec d'une opération n'est pas critique :

```ts
try {
  await deleteLatestTicketCost(ticket.id)
} catch (e) {
  console.warn('[Cost] Erreur suppression coût :', e)
  // On continue sans bloquer l'utilisateur
}
```

---

## Retourner null en cas d'erreur (404 toléré)

```ts
async function getLatestTicketCost(ticketId: number): Promise<TicketCostRecord | null> {
  try {
    const res = await axios.get(`/api/ticket-costs/ticket/${ticketId}/latest`)
    return res.data
  } catch {
    return null   // 404 ou autre → null, pas de crash
  }
}

// Utilisation
const record = await getLatestTicketCost(42)
if (record) {
  coutBase.value = record.fixedCost
}
```

---

## Plusieurs appels en parallèle avec gestion d'erreur indépendante

```ts
// Promise.allSettled — continue même si un appel échoue
const [sqlite, glpi] = await Promise.allSettled([
  getAllTicketCosts(),
  fetchGlpiTicketCosts(),
])

if (sqlite.status === 'fulfilled') {
  records.value = sqlite.value
} else {
  erreur.value = 'SQLite indisponible : ' + sqlite.reason?.message
  console.error('[load] SQLite :', sqlite.reason)
}

if (glpi.status === 'rejected') {
  console.warn('[load] GLPI indisponible :', glpi.reason?.message)
  // On continue sans les données GLPI
}
```

---

## Rollback optimiste (annuler si l'API échoue)

Technique utilisée dans KanbanView : on met à jour l'UI avant l'API, on revient en arrière si ça échoue.

```ts
async function applyStatusChange(ticket: Ticket, newStatus: number) {
  const oldStatus = ticket.status   // sauvegarder l'ancien statut

  ticket.status = newStatus as TicketStatus   // mise à jour optimiste

  try {
    await updateTicketStatus(ticket.id, newStatus)
    console.log(`[Kanban] Ticket #${ticket.id} → statut ${newStatus}`)
  } catch (e) {
    ticket.status = oldStatus   // rollback
    console.error('[Kanban] Rollback :', e)
  }
}
```

---

## Erreurs axios — lire le message

```ts
try {
  await axios.post('/api/ticket-costs', payload)
} catch (e: any) {
  // Réponse HTTP avec erreur (400, 500...)
  if (e.response) {
    console.error('Statut :', e.response.status)
    console.error('Message :', e.response.data)
  }
  // Pas de réponse (réseau coupé, timeout)
  else if (e.request) {
    console.error('Pas de réponse réseau')
  }
  // Autre erreur JS
  else {
    console.error('Erreur :', e.message)
  }
}
```

---

## console.log vs console.warn vs console.error

| Méthode | Quand l'utiliser |
|---------|-----------------|
| `console.log(...)` | Information normale, débogage |
| `console.warn(...)` | Quelque chose d'inattendu mais pas bloquant |
| `console.error(...)` | Erreur réelle qui a un impact |

---

## Récapitulatif

| Besoin | Solution |
|--------|----------|
| Erreur bloquante | `try/catch` + `erreur.value = e.message` + afficher dans template |
| Erreur non critique | `try/catch` + `console.warn(...)` + continuer |
| 404 toléré | `try/catch` + `return null` |
| Plusieurs API dont une peut échouer | `Promise.allSettled` |
| Annuler une action si l'API échoue | Sauvegarder l'état, rollback dans le `catch` |
