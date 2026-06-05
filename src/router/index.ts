import { createRouter, createWebHistory } from 'vue-router'
import { getSessionToken } from '@/services/api/glpiClient'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/admin/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      children: [
        {
          path: '',
          redirect: '/dashboard',
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/admin/DashboardView.vue'),
          meta: { title: 'Tableau de bord' },
        },
        {
          path: 'assets',
          name: 'assets',
          component: () => import('@/views/admin/AssetsView.vue'),
          meta: { title: 'Actifs' },
        },
        {
          path: 'tickets',
          name: 'tickets',
          component: () => import('@/views/admin/TicketsView.vue'),
          meta: { title: 'Tickets' },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/admin/UsersView.vue'),
          meta: { title: 'Utilisateurs' },
        },
        {
          path: 'entities',
          name: 'entities',
          component: () => import('@/views/admin/EntitiesView.vue'),
          meta: { title: 'Entités' },
        },
        {
          path: 'locations',
          name: 'locations',
          component: () => import('@/views/admin/LocationsView.vue'),
          meta: { title: 'Localisations' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/admin/SettingsView.vue'),
          meta: { title: 'Configuration' },
        },
        {
          path: 'reset',
          name: 'reset',
          component: () => import('@/views/admin/ResetView.vue'),
          meta: { title: 'Réinitialisation' },
        },
      ],
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
