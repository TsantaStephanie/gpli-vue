# Comment afficher des données dans le template

## Afficher une valeur

```vue
<template>
  <p>{{ titre }}</p>             <!-- string -->
  <p>{{ montant }} Ar</p>       <!-- number -->
  <p>{{ ticket.title }}</p>     <!-- propriété d'un objet -->
  <p>{{ ticket?.title }}</p>    <!-- accès sécurisé si ticket peut être null -->
</template>
```

---

## Affichage conditionnel

### v-if / v-else-if / v-else

```vue
<template>
  <div v-if="loading">Chargement…</div>

  <div v-else-if="erreur">Erreur : {{ erreur }}</div>

  <div v-else-if="records.length === 0">Aucun résultat</div>

  <div v-else>
    <!-- les données -->
  </div>
</template>
```

> `v-if` **retire** l'élément du DOM. Utiliser `v-show` si l'élément alterne souvent (il reste dans le DOM mais est masqué avec `display:none`).

---

## Boucle sur un tableau (v-for)

```vue
<script setup lang="ts">
const records = ref([
  { id: 1, ticketTitle: 'Ticket A', fixedCost: 100 },
  { id: 2, ticketTitle: 'Ticket B', fixedCost: 200 },
])
</script>

<template>
  <div v-for="r in records" :key="r.id">
    {{ r.ticketTitle }} — {{ r.fixedCost }} Ar
  </div>
</template>
```

> `:key` est obligatoire. Mettre un identifiant unique (l'id de l'objet).

### v-for avec index

```vue
<template>
  <div v-for="(r, index) in records" :key="r.id">
    {{ index + 1 }}. {{ r.ticketTitle }}
  </div>
</template>
```

---

## Lier un attribut HTML dynamique

```vue
<template>
  <!-- :class → applique une classe selon une condition -->
  <div :class="{ actif: isActif, rouge: montant < 0 }">...</div>

  <!-- :style → style inline dynamique -->
  <div :style="{ color: couleur, fontSize: '14px' }">...</div>

  <!-- :disabled → désactiver un bouton -->
  <button :disabled="loading">Enregistrer</button>

  <!-- :href → lien dynamique -->
  <a :href="`/ticket/${ticket.id}`">Voir</a>
</template>
```

---

## Afficher selon une valeur (switch visuel)

```vue
<template>
  <span v-if="ticket.status === 1" class="badge-new">Nouveau</span>
  <span v-else-if="ticket.status === 2" class="badge-progress">En cours</span>
  <span v-else-if="ticket.status === 5" class="badge-done">Résolu</span>
  <span v-else>Statut {{ ticket.status }}</span>
</template>
```

Ou avec un computed :

```ts
const statusLabel = computed(() => {
  const labels: Record<number, string> = {
    1: 'Nouveau', 2: 'En cours', 5: 'Résolu', 6: 'Fermé'
  }
  return labels[ticket.value.status] ?? 'Inconnu'
})
```

```vue
<template>
  <span>{{ statusLabel }}</span>
</template>
```

---

## Tableau HTML avec v-for

```vue
<template>
  <table>
    <thead>
      <tr>
        <th>Catégorie</th>
        <th>Coût</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in tableRows" :key="row.itemType">
        <td>{{ row.itemType }}</td>
        <td>{{ row.superCost }} Ar</td>
        <td>{{ row.total }} Ar</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        <td>{{ totalSuper }} Ar</td>
        <td>{{ totalAll }} Ar</td>
      </tr>
    </tfoot>
  </table>
</template>
```

---

## Appeler une fonction dans le template

```vue
<template>
  <!-- Résultat d'une fonction directement -->
  <p>{{ typeLabel('Computer') }}</p>

  <!-- Avec computed (préférable si calcul lourd) -->
  <p>{{ labelComputed }}</p>

  <!-- Formatage d'un nombre -->
  <p>{{ fmt(1234.56) }} Ar</p>
</template>
```

---

## Récapitulatif

| Besoin | Syntaxe |
|--------|---------|
| Afficher une valeur | `{{ valeur }}` |
| Afficher si condition | `v-if="condition"` |
| Masquer (sans retirer) | `v-show="condition"` |
| Sinon | `v-else` / `v-else-if="..."` |
| Boucler un tableau | `v-for="item in liste" :key="item.id"` |
| Attribut dynamique | `:attribut="valeur"` |
| Classe conditionnelle | `:class="{ maClasse: condition }"` |
| Désactiver bouton | `:disabled="loading"` |
