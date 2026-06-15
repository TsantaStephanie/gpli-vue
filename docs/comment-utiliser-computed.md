# Comment utiliser computed()

## Principe

`computed` crée une valeur dérivée d'autres `ref`. Elle se recalcule automatiquement quand ses dépendances changent. Elle ne s'exécute pas à chaque rendu — seulement si une dépendance a changé.

```ts
import { ref, computed } from 'vue'

const prix = ref(100)
const taux = ref(10)   // 10%

const surcharge = computed(() => prix.value * taux.value / 100)
// surcharge.value → 10
// Si prix.value change → surcharge.value se recalcule automatiquement
```

---

## Calculer un total depuis un tableau

```ts
const records = ref([
  { fixedCost: 100 },
  { fixedCost: 200 },
  { fixedCost: 50  },
])

const total = computed(() =>
  records.value.reduce((sum, r) => sum + r.fixedCost, 0)
)
// total.value → 350
```

Utilisé dans CostReportView.vue :
```ts
const totalSuper = computed(() =>
  Math.round(tableRows.value.reduce((s, r) => s + r.superCost, 0) * 100) / 100
)
```

---

## Filtrer une liste

```ts
const tickets     = ref([...])
const filtre      = ref('En cours')

const ticketsFiltres = computed(() =>
  tickets.value.filter(t => t.statusLabel === filtre.value)
)

// Dans le template : v-for="t in ticketsFiltres"
```

---

## Transformer une liste (map)

```ts
const records = ref<TicketCostRecord[]>([])

// Une ligne par type d'actif
const tableRows = computed(() => {
  const map = new Map<string, number>()
  for (const r of records.value) {
    map.set(r.source, (map.get(r.source) ?? 0) + r.fixedCost)
  }
  return [...map.entries()].map(([source, total]) => ({ source, total }))
})
```

---

## Computed depuis un autre computed

```ts
const kanbanRecords = computed(() =>
  records.value.filter(r => r.source === 'kanban')
)

const totalKanban = computed(() =>
  kanbanRecords.value.reduce((s, r) => s + r.fixedCost, 0)
)
```

---

## Computed avec condition (v-if dans le script)

```ts
const messageErreur = computed(() => {
  if (!ticketId.value)          return 'ID manquant'
  if (cout.value <= 0)          return 'Le coût doit être > 0'
  return ''                      // pas d'erreur
})

const peutSauvegarder = computed(() => messageErreur.value === '')
```

```vue
<template>
  <p v-if="messageErreur">{{ messageErreur }}</p>
  <button :disabled="!peutSauvegarder">Sauvegarder</button>
</template>
```

---

## Computed pour le coût de réouverture (projet)

```ts
const dernierCout  = ref(500)
const pourcentage  = ref(10)

const coutReouverture = computed(() => {
  if (!pourcentage.value || !dernierCout.value) return 0
  return Math.round(dernierCout.value * pourcentage.value / 100 * 100) / 100
})
// coutReouverture.value → 50
```

---

## Règles importantes

- Lire une computed : `maComputed.value` (pas d'appel comme une fonction)
- Ne **pas** modifier d'autres `ref` dans un computed → utiliser `watch` pour ça
- Ne **pas** appeler une API dans un computed → faire ça dans `onMounted` ou une fonction async

---

## Récapitulatif

| Besoin | Solution |
|--------|----------|
| Dériver une valeur d'un ref | `computed(() => ...)` |
| Filtrer une liste réactive | `computed(() => liste.value.filter(...))` |
| Calculer un total | `computed(() => liste.value.reduce(...))` |
| Combiner deux computed | Un computed qui lit un autre computed |
| Valider un formulaire | `computed(() => condition ? '' : 'Erreur')` |
