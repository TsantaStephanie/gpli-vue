<template>
  <div class="app-shell">
    <AppSidebar :collapsed="sidebarCollapsed" @toggle="sidebarCollapsed = !sidebarCollapsed" />

    <div class="app-main" :class="{ 'sidebar-collapsed': sidebarCollapsed }">

      <!-- ─── Topbar ─────────────────────────────────────────────────────────── -->
      <header class="topbar">
        <!-- Gauche : burger + breadcrumb -->
        <div class="topbar-left">
          <button class="icon-btn" @click="sidebarCollapsed = !sidebarCollapsed" title="Menu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6"  x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div class="breadcrumb">
            <span class="bc-root">GLPI</span>
            <svg class="bc-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span class="bc-current">{{ currentTitle }}</span>
          </div>
        </div>

        <!-- Centre : barre de recherche -->
        <div class="topbar-search">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="search" class="search-input" placeholder="Rechercher un actif, un ticket…" />
          <kbd class="search-kbd">⌘K</kbd>
        </div>

        <!-- Droite : statut API + notifs + utilisateur -->
        <div class="topbar-right">
          <div class="api-status" :class="apiOnline ? 'online' : 'offline'">
            <span class="status-dot" />
            {{ apiOnline ? 'Connecté' : 'Hors ligne' }}
          </div>

          <button class="icon-btn notif-btn" title="Notifications">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span class="notif-dot"></span>
          </button>

          <div class="user-chip">
            <div class="topbar-avatar">AD</div>
            <div class="user-info">
              <span class="user-name">Admin</span>
              <span class="user-role">Administrateur</span>
            </div>
          </div>
        </div>
      </header>

      <!-- ─── Contenu ───────────────────────────────────────────────────────── -->
      <main class="page-content">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="$route.path" />
          </Transition>
        </RouterView>
      </main>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './AppSidebar.vue'

const sidebarCollapsed = ref(false)
const route = useRoute()

const currentTitle = computed(() => (route.meta.title as string) ?? 'Tableau de bord')
const apiOnline = ref(true)
</script>

<style scoped>
@import '../../styles/AppLayout.css';
</style>
