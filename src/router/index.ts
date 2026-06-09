import { createRouter, createWebHistory } from 'vue-router'
import { getSessionToken } from '@/services/api/glpiClient'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      children: [
        {
          path: '',
          redirect: '/login',
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/back/DashboardView.vue'),
          meta: { title: 'Tableau de bord' },
        },
        {
          path: 'tickets',
          name: 'tickets back',
          component: () => import('@/views/back/TicketsView.vue'),
          meta: { title: 'Tickets' },
        },
        {
          path: 'tickets/create',
          name: 'ticket-create-back',
          component: () => import('@/views/back/TicketCreateView.vue'),
          meta: { title: 'Créer un Ticket' },
        },
        // Ajouter cette route
        {
          path: '/tickets/:id/edit',
          name: 'TicketEdit',
          component: () => import('@/views/back/TicketEditView.vue'),
          meta: { title: 'Modifier le ticket' }
        },
         {
          path: 'assets',
          name: 'assets back',
          component: () => import('@/views/back/AssetsView.vue'),
          meta: { title: 'Actifs' },
        },
        // Ajoutez cette route
        {
          path: '/sync',
          name: 'Sync',
          component: () => import('@/views/back/SyncView.vue'),
          meta: { title: 'Synchronisation GLPI ↔ SQLite' }
        },
        {
          path: 'reset',
          name: 'reset',
          component: () => import('@/views/ResetView.vue'),
          meta: { title: 'Réinitialiser' },
        },
        // router/index.ts — ajouter la route
        {
          path: 'import',
          name: 'import',
          component: () => import('@/views/back/ImportView.vue'),
          meta: { title: 'Import de données' },
        },
      ],
    },
    {
      path: '/front',
      component: () => import('@/components/layout/AppFrontLayout.vue'),
      children: [
        {
          path: '',
          name: 'front-home',
          component: () => import('@/views/front/HomeView.vue'),
          meta: { title: 'Accueil' },
        },
        {
          path: 'tickets',
          name: 'tickets',
          component: () => import('@/views/front/TicketsView.vue'),
          meta: { title: 'Tickets' },
        },
        {
          path: 'tickets/create',
          name: 'ticket-create',
          component: () => import('@/views/front/TicketCreateView.vue'),
          meta: { title: 'Créer un Ticket' },
        },
         {
          path: 'assets',
          name: 'assets',
          component: () => import('@/views/front/AssetsView.vue'),
          meta: { title: 'Actifs' },
        },
        {
          path: 'kanban',
          name: 'front-kanban',
          component: () => import('@/views/front/KanbanView.vue'),
          meta: { title: 'Kanban' },
        },
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

// Guard : rediriger vers /login si pas de session
router.beforeEach((to) => {
  if (!to.meta.public && !getSessionToken()) {
    return { name: 'login' }
  }
})

export default router
