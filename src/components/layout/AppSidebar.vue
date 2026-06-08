<template>
  <aside class="sidebar" :class="{ collapsed }">

    <!-- ─── Brand ─────────────────────────────────────────────────────────────── -->
    <div class="sidebar-brand">
      <div class="brand-icon">
        <!-- Icône casque / support IT -->
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
          <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
        </svg>
      </div>
      <Transition name="label">
        <div v-if="!collapsed" class="brand-text">
          <span class="brand-name">DeskFlow</span>
          <span class="brand-tag">ITSM</span>
        </div>
      </Transition>
    </div>

    <!-- ─── Navigation ────────────────────────────────────────────────────────── -->
    <nav class="sidebar-nav">
      <div class="nav-section">
        <Transition name="label">
          <p v-if="!collapsed" class="nav-section-label">Opérations</p>
        </Transition>
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
          to="/reset"
          class="nav-item"
          :class="{ active: isActive('/reset') }"
          :title="collapsed ? 'Réinitialiser' : ''"
        >
          <span class="nav-icon" v-html="icons.reset" />
          <Transition name="label">
            <span v-if="!collapsed" class="nav-label">Réinitialiser</span>
          </Transition>
        </RouterLink>
      </div>
    </nav>

    <!-- ─── Footer ────────────────────────────────────────────────────────────── -->
    <div class="sidebar-footer">
      <button class="nav-item collapse-btn" @click="$emit('toggle')" :title="collapsed ? 'Développer' : 'Réduire'">
        <span class="nav-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline :points="collapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6'" />
          </svg>
        </span>
        <Transition name="label">
          <span v-if="!collapsed" class="nav-label">Réduire le menu</span>
        </Transition>
      </button>
    </div>

  </aside>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

defineProps<{ collapsed: boolean }>()
defineEmits<{ toggle: [] }>()

const route = useRoute()
const isActive = (path: string) => route.path === path || route.path.startsWith(path + '/')

const icons = {
  dashboard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  assets:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  tickets:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/></svg>`,
  reset:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.5 2v6h6M21.5 22v-6h-6"/><path d="M22 11.5A10 10 0 0 0 3.5 12.5"/><path d="M2 12.5a10 10 0 0 0 18.5-1"/></svg>`,
  import:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
}

const mainNav = [
  { to: '/dashboard', label: 'Dashboard',  icon: icons.dashboard },
  { to: '/assets',    label: 'Parc matériel',    icon: icons.assets,  count: null },
  { to: '/tickets',   label: 'Tickets',        icon: icons.tickets, count: null },
  // AppSidebar.vue — ajouter dans orgNav ou adminNav
  { to: '/import', label: 'Import CSV', icon: icons.import },
]
</script>

<style scoped>
@import '../../styles/AppSidebar.css';
</style>
