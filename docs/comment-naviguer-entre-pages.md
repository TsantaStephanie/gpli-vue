# Comment naviguer entre les pages

## Naviguer depuis le code (script)

```ts
import { useRouter } from 'vue-router'
const router = useRouter()

// Par nom de route
router.push({ name: 'front-kanban' })

// Par chemin
router.push('/front/kanban')

// Avec paramètre
router.push({ name: 'TicketEdit', params: { id: 42 } })

// Avec query string (?source=glpi)
router.push({ name: 'front-costs', query: { source: 'glpi' } })

// Remplacer (pas d'historique, bouton "retour" ne revient pas)
router.replace({ name: 'login' })

// Retour arrière
router.back()
```

---

## Lien dans le template (RouterLink)

```vue
<template>
  <!-- Lien simple -->
  <RouterLink to="/front/kanban">Kanban</RouterLink>

  <!-- Lien par nom -->
  <RouterLink :to="{ name: 'front-kanban' }">Kanban</RouterLink>

  <!-- Lien avec paramètre -->
  <RouterLink :to="{ name: 'TicketEdit', params: { id: ticket.id } }">
    Modifier
  </RouterLink>
</template>
```

---

## Récupérer les paramètres de la route courante

```ts
import { useRoute } from 'vue-router'
const route = useRoute()

// Paramètre de chemin (/tickets/:id)
const ticketId = Number(route.params.id)

// Query string (?source=glpi)
const source = route.query.source as string

// Nom de la route courante
const nomRoute = route.name   // 'front-kanban'
```

---

## Rediriger après login

```ts
// Dans LoginView.vue, après authentification réussie
const route  = useRoute()
const router = useRouter()

async function login() {
  await initSession(username.value, password.value)
  const redirect = route.query.redirect as string
  router.push(redirect || '/dashboard')
}
```

---

## Noms de routes du projet

| Nom | Chemin | Description |
|-----|--------|-------------|
| `login` | `/login` | Page de connexion |
| `dashboard` | `/dashboard` | Tableau de bord |
| `front-kanban` | `/front/kanban` | Kanban |
| `front-costs` | `/front/costs` | Rapport des coûts |
| `import` | `/import` | Import CSV |
| `kanban-settings` | `/kanban-settings` | Paramètres Kanban |
| `TicketEdit` | `/tickets/:id/edit` | Modifier un ticket |
| `tickets back` | `/tickets` | Liste tickets (back) |
| `tickets` | `/front/tickets` | Liste tickets (front) |

---

## RouterLink actif (style automatique)

Vue Router ajoute automatiquement la classe `router-link-active` sur le lien de la page courante.

```css
.router-link-active {
  font-weight: bold;
  color: #6366f1;
}

/* Correspondance exacte seulement */
.router-link-exact-active {
  text-decoration: underline;
}
```

---

## Naviguer depuis un composant enfant

L'enfant ne doit pas naviguer directement — il émet un événement, le parent navigue.

```vue
<!-- Enfant -->
<script setup lang="ts">
const emit = defineEmits<{ voir: [id: number] }>()
</script>
<template>
  <button @click="emit('voir', ticket.id)">Voir</button>
</template>

<!-- Parent -->
<script setup lang="ts">
const router = useRouter()
function onVoir(id: number) {
  router.push({ name: 'TicketEdit', params: { id } })
}
</script>
<template>
  <TicketCard @voir="onVoir" />
</template>
```
