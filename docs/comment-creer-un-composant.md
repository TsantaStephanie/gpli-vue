# Comment créer un composant réutilisable

## Principe

Un composant est un fichier `.vue` dans `src/components/`. Il reçoit des données via des **props** et signale des actions via des **emits**.

```
src/components/
├── layout/          ← AppLayout, AppFrontLayout
├── TicketCard.vue   ← exemple de composant réutilisable
├── CostBadge.vue
└── MonComposant.vue
```

---

## Créer un composant simple (affichage seul)

```vue
<!-- src/components/CostBadge.vue -->
<script setup lang="ts">
const props = defineProps<{
  montant: number
  source:  'kanban' | 'glpi' | 'reopen'
}>()

const couleur = {
  kanban: '#6366f1',
  glpi:   '#f59e0b',
  reopen: '#b45309',
}
</script>

<template>
  <span :style="{ color: couleur[props.source] }">
    {{ props.montant.toFixed(2) }} Ar
  </span>
</template>
```

### Utiliser dans une page

```vue
<!-- src/views/front/CostReportView.vue -->
<script setup lang="ts">
import CostBadge from '@/components/CostBadge.vue'
</script>

<template>
  <CostBadge :montant="150" source="kanban" />
  <CostBadge :montant="80"  source="glpi" />
</template>
```

---

## Composant avec action (emit)

```vue
<!-- src/components/ConfirmDialog.vue -->
<script setup lang="ts">
defineProps<{
  titre:   string
  message: string
}>()

const emit = defineEmits<{
  confirmer: []
  annuler:   []
}>()
</script>

<template>
  <div class="dialog-overlay">
    <div class="dialog-box">
      <h2>{{ titre }}</h2>
      <p>{{ message }}</p>
      <button @click="emit('annuler')">Annuler</button>
      <button @click="emit('confirmer')">Confirmer</button>
    </div>
  </div>
</template>
```

### Utiliser avec émits

```vue
<script setup lang="ts">
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { ref } from 'vue'

const showDialog = ref(false)

function onConfirmer() {
  showDialog.value = false
  console.log('Confirmé !')
}
</script>

<template>
  <button @click="showDialog = true">Supprimer</button>

  <ConfirmDialog
    v-if="showDialog"
    titre="Confirmation"
    message="Voulez-vous vraiment supprimer ?"
    @confirmer="onConfirmer"
    @annuler="showDialog = false"
  />
</template>
```

---

## Composant avec slot (contenu personnalisable)

```vue
<!-- src/components/Card.vue -->
<template>
  <div class="card">
    <div class="card-header">
      <slot name="header">Titre par défaut</slot>
    </div>
    <div class="card-body">
      <slot />   <!-- slot par défaut -->
    </div>
  </div>
</template>
```

```vue
<!-- Utilisation -->
<Card>
  <template #header>Mon titre personnalisé</template>
  <p>Contenu de la carte</p>
</Card>
```

---

## Composant avec props optionnelles

```vue
<script setup lang="ts">
const props = withDefaults(defineProps<{
  titre:    string
  montant?: number      // optionnel
  actif?:   boolean     // optionnel
}>(), {
  montant: 0,           // valeur par défaut
  actif:   true,
})
</script>
```

---

## Règles de nommage

| Type | Convention | Exemple |
|------|-----------|---------|
| Fichier | PascalCase | `TicketCard.vue` |
| Dans template | PascalCase ou kebab | `<TicketCard />` ou `<ticket-card />` |
| Props | camelCase | `ticketTitle`, `fixedCost` |
| Emits | camelCase | `@confirmer`, `@annuler` |

---

## Récapitulatif

```
Composant = fichier .vue dans src/components/
  ├── defineProps<{...}>()     ← reçoit des données du parent
  ├── defineEmits<{...}>()     ← signale des actions au parent
  └── <slot />                  ← contenu injecté par le parent
```
