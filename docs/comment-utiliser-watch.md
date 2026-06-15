# Comment utiliser watch()

## Principe

`watch` surveille un `ref` et exécute une fonction quand sa valeur change. Contrairement à `computed`, il peut faire des effets de bord : appels API, console.log, modifier d'autres refs.

```ts
import { ref, watch } from 'vue'

const pourcentage = ref(10)

watch(pourcentage, (nouvelleValeur, ancienneValeur) => {
  console.log(`Changé : ${ancienneValeur} → ${nouvelleValeur}`)
})
```

---

## Cas courant : recharger des données quand un filtre change

```ts
const filtreSource = ref('kanban')
const records      = ref<TicketCostRecord[]>([])

watch(filtreSource, async (newSource) => {
  console.log('[watch] filtre changé :', newSource)
  records.value = await getRecordsBySource(newSource)
})
```

```vue
<template>
  <select v-model="filtreSource">
    <option value="kanban">Kanban</option>
    <option value="glpi">GLPI</option>
    <option value="reopen">Réouverture</option>
  </select>
</template>
```

---

## watch avec exécution immédiate (immediate)

Par défaut, `watch` attend un **changement** avant de s'exécuter. Avec `immediate: true`, il s'exécute aussi au démarrage.

```ts
const ticketId = ref(42)

watch(ticketId, async (id) => {
  records.value = await getRecordsByTicket(id)
}, { immediate: true })   // exécuté dès le départ ET à chaque changement
```

---

## Surveiller un objet (deep)

Pour surveiller les changements dans les propriétés d'un objet, utiliser `deep: true`.

```ts
const ticket = ref({ id: 1, status: 2, priority: 3 })

watch(ticket, (newTicket) => {
  console.log('[watch] ticket modifié :', newTicket)
}, { deep: true })

// Sans deep: true, ce changement ne serait PAS détecté :
ticket.value.status = 5
```

---

## Surveiller plusieurs refs à la fois

```ts
const ticketId = ref(1)
const source   = ref('kanban')

watch([ticketId, source], ([newId, newSource]) => {
  console.log('[watch] changement :', newId, newSource)
  charger(newId, newSource)
})
```

---

## watch vs computed — quand utiliser lequel ?

| Besoin | Utiliser |
|--------|----------|
| Dériver une valeur (pas d'effet de bord) | `computed` |
| Appeler une API quand une valeur change | `watch` |
| Modifier un autre `ref` quand une valeur change | `watch` |
| Logger / console.log un changement | `watch` |
| Calculer un total depuis un tableau | `computed` |

---

## Exemple projet — surveiller l'input du pourcentage

```ts
const reopenPct   = ref(10)
const coutBase    = ref(500)
const coutAffiche = ref(0)

// Recalculer le coût affiché en temps réel quand le % change
watch(reopenPct, (pct) => {
  const p = Number(pct)
  coutAffiche.value = p > 0 ? Math.round(coutBase.value * p / 100 * 100) / 100 : 0
  console.log('[watch] nouveau coût réouverture :', coutAffiche.value)
})
```

> Dans ce projet, ce cas est géré avec `computed` (plus simple). Utiliser `watch` quand tu as besoin de faire un appel API ou un effet de bord.

---

## Arrêter un watch

```ts
const stopWatch = watch(ticketId, () => {
  // ...
})

// Plus tard :
stopWatch()   // le watch ne s'exécute plus
```
