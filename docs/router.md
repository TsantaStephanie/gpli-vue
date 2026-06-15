# Routing — Vue Router

## Structure des routes

Le router est défini dans `src/router/index.ts`.

```
/login                       ← LoginView (public, pas de guard)
/
├── dashboard                ← DashboardView (back-office)
├── tickets                  ← TicketsView (back-office)
├── tickets/create           ← TicketCreateView
├── tickets/:id/edit         ← TicketEditView
├── assets                   ← AssetsView (back-office)
├── sync                     ← SyncView
├── reset                    ← ResetView
├── import                   ← ImportView
└── kanban-settings          ← KanbanSettingsView

/front
├── (index)                  ← HomeView (front-office)
├── tickets                  ← TicketsView (front-office)
├── tickets/create           ← TicketCreateView (front)
├── assets                   ← AssetsView (front)
├── kanban                   ← KanbanView
└── costs                    ← CostReportView
```

---

## Guard de navigation

Toutes les routes sont protégées par défaut. Si aucun `Session-Token` n'est dans le localStorage, l'utilisateur est redirigé vers `/login`.

```ts
// src/router/index.ts
router.beforeEach((to) => {
  if (!to.meta.public && !getSessionToken()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
})
```

La route `/login` possède `meta: { public: true }` pour être exemptée.

---

## Rendre une route publique

```ts
{
  path: '/ma-page-publique',
  name: 'ma-page',
  component: () => import('@/views/MaPage.vue'),
  meta: { public: true },
}
```

---

## Naviguer depuis le code

```ts
import { useRouter } from 'vue-router'
const router = useRouter()

// Naviguer par nom
router.push({ name: 'front-kanban' })

// Naviguer avec paramètre
router.push({ name: 'TicketEdit', params: { id: 42 } })

// Rediriger après login
const redirect = route.query.redirect as string
router.push(redirect || '/dashboard')
```

---

## Récupérer un paramètre de route

```ts
import { useRoute } from 'vue-router'
const route = useRoute()

const ticketId = Number(route.params.id)
```

---

## Layouts

- Back-office (`/`, `/dashboard`, etc.) → `AppLayout.vue`
- Front-office (`/front/**`) → `AppFrontLayout.vue`

Les layouts sont définis comme routes parentes avec `component` et `children`.

---

## Noms de routes utiles

| Nom                  | Chemin               |
|----------------------|----------------------|
| `login`              | `/login`             |
| `dashboard`          | `/dashboard`         |
| `front-kanban`       | `/front/kanban`      |
| `front-costs`        | `/front/costs`       |
| `import`             | `/import`            |
| `kanban-settings`    | `/kanban-settings`   |
| `TicketEdit`         | `/tickets/:id/edit`  |
