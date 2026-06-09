<!-- src/components/layout/AppFrontLayout.vue -->
<template>
  <div class="front-shell">

    <!-- ── Header ──────────────────────────────────────────────── -->
    <header class="front-header">

      <!-- Gauche : logo seul -->
      <div class="header-left">
        <router-link to="/front/tickets" class="logo" tabindex="-1">
          <div class="logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span class="logo-name">GLPI</span>
        </router-link>
      </div>

      <!-- Centre : navigation -->
      <nav class="front-nav" aria-label="Navigation principale">
        <router-link to="/front/tickets/create" class="nav-link" active-class="nav-active">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          Créer un ticket
        </router-link>

        <router-link to="/front/assets" class="nav-link" active-class="nav-active">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          Mes équipements
        </router-link>

        <router-link to="/front/kanban" class="nav-link" active-class="nav-active">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="5" height="18" rx="1"/>
            <rect x="10" y="3" width="5" height="12" rx="1"/>
            <rect x="17" y="3" width="4" height="7" rx="1"/>
          </svg>
          Mes tickets
        </router-link>
      </nav>

      <!-- Droite : bouton créer + menu utilisateur -->
      <div class="header-right">

        <!-- Menu utilisateur -->
        <div class="user-btn" @click.stop="toggleUserMenu" ref="userMenuEl">
          <div class="user-avatar">{{ userInitials }}</div>
          <span class="user-name">{{ userFullName }}</span>
          <svg
            class="chevron"
            :class="{ open: showUserMenu }"
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2.5"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>

          <!-- Dropdown -->
          <Transition name="dd">
            <div v-if="showUserMenu" class="user-dropdown">
              <div class="dd-user-header">
                <div class="dd-avatar-lg">{{ userInitials }}</div>
                <div class="dd-user-info">
                  <span class="dd-fullname">{{ userFullName }}</span>
                  <span class="dd-role">{{ userProfile }}</span>
                </div>
              </div>

              <div class="dd-divider"></div>

              <button class="dd-item dd-logout" @click.stop="logout">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Déconnexion
              </button>
            </div>
          </Transition>
        </div>

      </div>
    </header>

    <!-- ── Contenu principal ───────────────────────────────────── -->
    <main class="front-content">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="$route.path" />
        </Transition>
      </RouterView>
    </main>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { killSession, clearSessionToken } from '@/services/api/glpiClient'
import { getCurrentSession, fetchFullSession } from '@/services/api/sessionService'

const router      = useRouter()
const showUserMenu = ref(false)
const userMenuEl   = ref<HTMLElement | null>(null)

// ── Infos utilisateur depuis la session GLPI ────────────────────
const sessionData = ref(getCurrentSession())

onMounted(async () => {
  if (!sessionData.value) {
    try { sessionData.value = await fetchFullSession() } catch { /* ignore */ }
  }
})

const userFullName = computed(() => {
  const s = sessionData.value
  if (!s) return 'Utilisateur'
  const first = s.glpifirstname?.trim() ?? ''
  const last  = s.glpirealname?.trim()  ?? ''
  if (first && last) return `${first} ${last}`
  return s.glpiname || 'Utilisateur'
})

const userInitials = computed(() => {
  const parts = userFullName.value.split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return userFullName.value.slice(0, 2).toUpperCase()
})

const userProfile = computed(() => {
  return sessionData.value?.glpiactiveprofile?.name ?? ''
})

// ── Menu dropdown ───────────────────────────────────────────────
function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}

function handleOutsideClick(e: MouseEvent) {
  if (userMenuEl.value && !userMenuEl.value.contains(e.target as Node)) {
    showUserMenu.value = false
  }
}

onMounted  (() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))

// ── Déconnexion ─────────────────────────────────────────────────
async function logout() {
  showUserMenu.value = false
  try { await killSession() } catch { /* ignore */ }
  finally {
    clearSessionToken()
    router.push('/login')
  }
}
</script>

<style scoped>
/* ════════════════════════════════════════════════════════════════
   SHELL
   ════════════════════════════════════════════════════════════════ */
.front-shell {
  min-height: 100vh;
  background: #f1f5f9;
  display: flex;
  flex-direction: column;
}

/* ════════════════════════════════════════════════════════════════
   HEADER — GLASSMORPHISM SOMBRE
   ════════════════════════════════════════════════════════════════ */
.front-header {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  height: 72px;
  padding: 0 2rem;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, .35),
    inset 0 1px 0 rgba(255, 255, 255, .05);
}

/* ── Logo ──────────────────────────────────────────────────────── */
.logo {
  display: flex;
  align-items: center;
  gap: .625rem;
  text-decoration: none;
  flex-shrink: 0;
}

.logo-icon {
  width: 34px;
  height: 34px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 1px rgba(255,255,255,.1), 0 4px 12px rgba(99,102,241,.5);
}

.logo-name {
  font-size: .9375rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -.02em;
}

.logo-tag {
  font-size: .625rem;
  font-weight: 700;
  color: rgba(255, 255, 255, .4);
  background: rgba(255, 255, 255, .08);
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 4px;
  padding: .15rem .4rem;
  letter-spacing: .06em;
  text-transform: uppercase;
}

/* ── Navigation ────────────────────────────────────────────────── */
.header-left {
  display: flex;
  align-items: center;
}

.front-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .25rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: .425rem;
  padding: .4rem .875rem;
  border-radius: 8px;
  font-size: .8125rem;
  font-weight: 500;
  color: rgba(255, 255, 255, .5);
  text-decoration: none;
  transition: background .15s, color .15s;
  white-space: nowrap;
}

.nav-link:hover {
  background: rgba(255, 255, 255, .08);
  color: rgba(255, 255, 255, .9);
}

.nav-link.nav-active {
  background: rgba(99, 102, 241, .25);
  color: #a5b4fc;
  font-weight: 600;
}

.nav-link.nav-active svg {
  stroke: #a5b4fc;
}

/* ── Droite du header ──────────────────────────────────────────── */
.header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: .875rem;
}

/* Bouton "Nouveau ticket" */
.btn-create {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: .45rem 1.125rem;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  border-radius: 20px;
  font-size: .8125rem;
  font-weight: 700;
  text-decoration: none;
  letter-spacing: .01em;
  box-shadow: 0 0 0 1px rgba(255,255,255,.1), 0 4px 14px rgba(99,102,241,.4);
  transition: box-shadow .15s, transform .1s, filter .15s;
  white-space: nowrap;
}

.btn-create:hover {
  filter: brightness(1.1);
  box-shadow: 0 0 0 1px rgba(255,255,255,.15), 0 6px 20px rgba(99,102,241,.55);
  transform: translateY(-1px);
}

/* ── Menu utilisateur ──────────────────────────────────────────── */
.user-btn {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .3rem .625rem .3rem .3rem;
  border-radius: 10px;
  cursor: pointer;
  position: relative;
  transition: background .15s;
  user-select: none;
}

.user-btn:hover {
  background: rgba(255, 255, 255, .08);
}

.user-avatar {
  width: 30px;
  height: 30px;
  background: rgba(255, 255, 255, .15);
  border: 1px solid rgba(255, 255, 255, .2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: .6875rem;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: .04em;
}

.user-name {
  font-size: .8125rem;
  font-weight: 600;
  color: rgba(255, 255, 255, .82);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  color: rgba(255, 255, 255, .35);
  transition: transform .15s;
  flex-shrink: 0;
}

.chevron.open {
  transform: rotate(180deg);
  color: rgba(255, 255, 255, .6);
}

/* ── Dropdown utilisateur ──────────────────────────────────────── */
.user-dropdown {
  position: absolute;
  top: calc(100% + .625rem);
  right: 0;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, .5), 0 0 0 1px rgba(255,255,255,.04);
  min-width: 230px;
  overflow: hidden;
  z-index: 200;
}

.dd-user-header {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: 1rem 1rem .875rem;
  background: rgba(255, 255, 255, .04);
  border-bottom: 1px solid rgba(255, 255, 255, .07);
}

.dd-avatar-lg {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: .9375rem;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: .04em;
  box-shadow: 0 0 0 2px rgba(99,102,241,.4);
}

.dd-user-info {
  display: flex;
  flex-direction: column;
  gap: .2rem;
  min-width: 0;
}

.dd-fullname {
  font-size: .875rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dd-role {
  font-size: .6875rem;
  color: rgba(255, 255, 255, .4);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dd-divider {
  height: 1px;
  background: rgba(255, 255, 255, .07);
}

.dd-item {
  display: flex;
  align-items: center;
  gap: .625rem;
  padding: .75rem 1rem;
  width: 100%;
  background: none;
  border: none;
  text-align: left;
  font-size: .8125rem;
  font-weight: 500;
  color: rgba(255, 255, 255, .65);
  cursor: pointer;
  transition: background .12s, color .12s;
  text-decoration: none;
}

.dd-item:hover {
  background: rgba(255, 255, 255, .06);
  color: rgba(255, 255, 255, .9);
}

.dd-logout {
  color: #f87171;
}

.dd-logout:hover {
  background: rgba(239, 68, 68, .12);
  color: #fca5a5;
}

/* ── Dropdown animation ────────────────────────────────────────── */
.dd-enter-active,
.dd-leave-active { transition: opacity .18s, transform .18s; }

.dd-enter-from,
.dd-leave-to { opacity: 0; transform: translateY(-8px) scale(.97); }

/* ════════════════════════════════════════════════════════════════
   CONTENU PRINCIPAL
   ════════════════════════════════════════════════════════════════ */
.front-content {
  flex: 1;
  padding: 1.75rem 1.5rem;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

/* ── Transitions de page ───────────────────────────────────────── */
.page-enter-active,
.page-leave-active { transition: opacity .18s ease, transform .18s ease; }

.page-enter-from { opacity: 0; transform: translateY(6px); }
.page-leave-to   { opacity: 0; transform: translateY(-6px); }

/* ════════════════════════════════════════════════════════════════
   RESPONSIVE
   ════════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .front-header {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    height: auto;
    padding: .75rem 1rem;
    gap: .625rem;
  }

  .header-left  { grid-column: 1; grid-row: 1; }
  .header-right { grid-column: 2; grid-row: 1; }

  .front-nav {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: flex-start;
    gap: .25rem;
  }

  .logo-tag  { display: none; }
  .user-name { display: none; }
  .front-content { padding: 1rem; }
}

@media (max-width: 480px) {
  .nav-link   { padding: .4rem .75rem; font-size: .75rem; }
  .btn-create { padding: .4rem .75rem; font-size: .75rem; }
}
</style>
