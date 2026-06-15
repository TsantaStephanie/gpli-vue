# Comment utiliser ref()

## Principe

`ref` crée une variable réactive. Quand sa valeur change, Vue met à jour automatiquement le template.

```ts
import { ref } from 'vue'

const compteur = ref(0)
compteur.value++            // modifier : toujours .value dans le script
// Dans le template : {{ compteur }} (pas .value)
```

---

## Types de valeurs

```ts
const loading    = ref(false)           // boolean
const titre      = ref('')              // string
const montant    = ref(0)              // number
const ticket     = ref<Ticket | null>(null)   // objet ou null
const records    = ref<TicketCostRecord[]>([]) // tableau
const pourcentage = ref(10)            // number avec valeur initiale
```

---

## Lire et modifier

```ts
// Lire
console.log(loading.value)      // false
console.log(records.value[0])   // premier élément

// Modifier
loading.value = true
records.value = []
ticket.value  = { id: 5, title: '...' }

// Modifier un tableau
records.value.push(nouveauRecord)
records.value = records.value.filter(r => r.id !== 3)  // supprimer id=3
```

---

## ref dans le template

Dans le `<template>`, pas besoin de `.value` :

```vue
<script setup lang="ts">
const loading = ref(false)
const titre   = ref('Mon titre')
const records = ref([{ fixedCost: 100 }, { fixedCost: 200 }])
</script>

<template>
  <div v-if="loading">Chargement…</div>
  <h1>{{ titre }}</h1>
  <div v-for="r in records" :key="r.fixedCost">{{ r.fixedCost }} Ar</div>
</template>
```

---

## Lier un ref à un input (v-model)

```vue
<script setup lang="ts">
const nom    = ref('')
const montant = ref(0)
</script>

<template>
  <input v-model="nom" placeholder="Nom" />
  <input v-model.number="montant" type="number" placeholder="Montant" />

  <p>Nom saisi : {{ nom }}</p>
  <p>Montant saisi : {{ montant }}</p>
</template>
```

> `.number` convertit automatiquement la valeur en `number` (sinon c'est une string).

---

## ref pour un dialog (show/hide)

```vue
<script setup lang="ts">
const showDialog  = ref(false)
const ticketChoisi = ref<Ticket | null>(null)

function ouvrirDialog(ticket: Ticket) {
  ticketChoisi.value = ticket
  showDialog.value   = true
}

function fermerDialog() {
  showDialog.value   = false
  ticketChoisi.value = null
}
</script>

<template>
  <button @click="ouvrirDialog(ticket)">Ouvrir</button>

  <div v-if="showDialog" class="dialog">
    <p>Ticket : {{ ticketChoisi?.title }}</p>
    <button @click="fermerDialog">Fermer</button>
  </div>
</template>
```

---

## ref pour un état de chargement

```vue
<script setup lang="ts">
const loading = ref(false)
const erreur  = ref('')

async function charger() {
  loading.value = true
  erreur.value  = ''
  try {
    records.value = await getAllTicketCosts()
  } catch (e: any) {
    erreur.value = e.message
  } finally {
    loading.value = false   // toujours exécuté, même en cas d'erreur
  }
}
</script>

<template>
  <div v-if="loading">Chargement…</div>
  <div v-else-if="erreur">Erreur : {{ erreur }}</div>
  <div v-else>{{ records.length }} enregistrements</div>
</template>
```

---

## Différence ref vs variable normale

```ts
// Variable normale — Vue ne détecte PAS le changement, pas de mise à jour du template
let compteur = 0
compteur++   // le template ne se met PAS à jour

// ref — Vue détecte le changement et met à jour le template
const compteur = ref(0)
compteur.value++  // le template se met à jour automatiquement
```

---

## Récapitulatif

| Besoin | Code |
|--------|------|
| Variable réactive simple | `const x = ref(valeurInitiale)` |
| Lire dans le script | `x.value` |
| Modifier dans le script | `x.value = nouvelleValeur` |
| Lire dans le template | `{{ x }}` (sans .value) |
| Lier à un input | `v-model="x"` |
| Tableau réactif | `const liste = ref<MonType[]>([])` |
| Objet réactif ou null | `const obj = ref<MonType \| null>(null)` |
