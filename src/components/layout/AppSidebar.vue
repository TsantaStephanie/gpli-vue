<template>
  <aside class="sidebar" :class="{ collapsed }">

    <!-- ─── Brand ─────────────────────────────────────────────────────────────── -->
    <div class="sidebar-brand">
      <img src="/favicon.svg" class="brand-logo" alt="GLPI" />
      <Transition name="label">
        <span v-if="!collapsed" class="brand-name">GLPI</span>
      </Transition>
    </div>

    <!-- ─── Navigation ────────────────────────────────────────────────────────── -->
    <nav class="sidebar-nav">
      <div class="nav-section">
        <RouterLink
          v-for="item in mainNav"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: isActive(item.to) }"
          :title="collapsed ? item.label : ''"
        >
          <span class="nav-icon" v-html="item.icon" />
          <Transition name="label">
            <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
          </Transition>
          <Transition name="label">
            <span v-if="!collapsed && item.count" class="nav-count">{{ item.count }}</span>
          </Transition>
        </RouterLink>
      </div>

      <div class="nav-section">
        <RouterLink
          v-for="item in orgNav"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: isActive(item.to) }"
          :title="collapsed ? item.label : ''"
        >
          <span class="nav-icon" v-html="item.icon" />
          <Transition name="label">
            <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
          </Transition>
        </RouterLink>
      </div>

      <div class="nav-section">
        <RouterLink
          to="/reset"
          class="nav-item"
          :class="{ active: isActive('/reset') }"
          :title="collapsed ? 'Réinitialiser' : ''"
        >
          <span class="nav-icon" v-html="icons.reset" />
          <Transition name="label">
            <span v-if="!collapsed" class="nav-label">Réinitialisation</span>
          </Transition>
        </RouterLink>
      </div>
    </nav>

    <!-- ─── Footer ──────────────────────────────────────────────────────────────
    <div class="sidebar-footer">
      <button class="nav-item collapse-btn" @click="$emit('toggle')" :title="collapsed ? 'Développer' : 'Réduire'">
        <span class="nav-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline :points="collapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6'" />
          </svg>
        </span>
      </button>
    </div> -->

  </aside>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

defineProps<{ collapsed: boolean }>()
defineEmits<{ toggle: [] }>()

const route = useRoute()
const isActive = (path: string) => route.path === path || route.path.startsWith(path + '/')

const icons = {
  // Barres croissantes — analytics / vue d'ensemble
  dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="4" width="4" height="17" rx="1"/></svg>`,

  // Rack serveur avec voyants — actifs / éléments
  assets: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="6" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>`,

  // Bulle de conversation — tickets / support
  tickets: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,

  // Nuage avec flèche bas — import
  import: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>`,

  // Rotation CCW — réinitialisation
  reset: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.95"/></svg>`,

  // Sliders — paramètres kanban
  kanbanSettings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,

  // Icônes secondaires (non utilisées dans le nav mais conservées)
  users:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  entities:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  locations: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
}

const mainNav = [
  { to: '/dashboard', label: 'Vue d/ensemble',  icon: icons.dashboard },
  { to: '/assets',    label: 'Eléments',    icon: icons.assets,  count: null },
  { to: '/tickets',   label: 'Tickets',        icon: icons.tickets, count: null },
  // AppSidebar.vue — ajouter dans orgNav ou adminNav
  { to: '/import',           label: 'Import de données',  icon: icons.import },
  { to: '/kanban-settings', label: 'Paramètres Kanban',  icon: icons.kanbanSettings },
]
</script>

<style scoped>
@import '../../styles/tsanta/AppSidebar.css';
</style>
