<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentSession, fetchFullSession } from '@/services/api/sessionService'
import { glpiClient } from '@/services/api/glpiClient'

const router = useRouter()

// ── Utilisateur ─────────────────────────────────────────────────
const sessionData = ref(getCurrentSession())

onMounted(async () => {
  if (!sessionData.value) {
    try { sessionData.value = await fetchFullSession() } catch { /* ignore */ }
  }
  loadStats()
})

const userFirstName = computed(() => {
  const s = sessionData.value
  if (!s) return ''
  return s.glpifirstname?.trim() || s.glpiname || ''
})

// ── Stats rapides ───────────────────────────────────────────────
const openTickets   = ref<number | null>(null)
const totalTickets  = ref<number | null>(null)
const statsLoading  = ref(true)

async function loadStats() {
  statsLoading.value = true
  try {
    const { data } = await glpiClient.get('/Ticket?range=0-9999', { timeout: 60_000 })
    const list: any[] = Array.isArray(data)
      ? (typeof data[0] === 'number' ? [] : data)
      : (data?.data ?? [])

    totalTickets.value = list.length
    openTickets.value  = list.filter((t: any) => {
      const s = Number(t.status) || 0
      return s >= 1 && s <= 4
    }).length
  } catch {
    totalTickets.value = null
    openTickets.value  = null
  } finally {
    statsLoading.value = false
  }
}

// ── Heure de la journée ─────────────────────────────────────────
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
})
</script>

<template>
  <div class="home-page">

    <!-- ── Hero ─────────────────────────────────────────────────── -->
    <div class="hero">
      <div class="hero-body">
        <p class="hero-greeting">
          {{ greeting }}<span v-if="userFirstName">, {{ userFirstName }}</span> 👋
        </p>
        <h1 class="hero-title">Comment pouvons-nous vous aider ?</h1>
        <p class="hero-sub">Créez un ticket, suivez vos demandes ou consultez votre parc informatique.</p>

        <router-link to="/front/tickets/create" class="hero-cta">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Créer un ticket
        </router-link>
      </div>

      <!-- Illustration décorative -->
      <div class="hero-illo" aria-hidden="true">
        <svg width="160" height="140" viewBox="0 0 160 140" fill="none">
          <rect x="10" y="30" width="100" height="80" rx="10" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1.5"/>
          <rect x="20" y="46" width="60" height="6" rx="3" fill="#93c5fd"/>
          <rect x="20" y="58" width="80" height="4" rx="2" fill="#e0f2fe"/>
          <rect x="20" y="68" width="70" height="4" rx="2" fill="#e0f2fe"/>
          <rect x="20" y="78" width="50" height="4" rx="2" fill="#e0f2fe"/>
          <rect x="20" y="92" width="36" height="14" rx="6" fill="#3b82f6"/>
          <circle cx="128" cy="36" r="26" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="1.5"/>
          <path d="M118 36l7 7 14-14" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="140" cy="100" r="14" fill="#fef9c3" stroke="#fde68a" stroke-width="1.5"/>
          <line x1="140" y1="94" x2="140" y2="100" stroke="#ca8a04" stroke-width="2" stroke-linecap="round"/>
          <circle cx="140" cy="104" r="1.5" fill="#ca8a04"/>
        </svg>
      </div>
    </div>

    <!-- ── Cartes d'action rapide ────────────────────────────────── -->
    <div class="quick-grid">

      <router-link to="/front/tickets/create" class="quick-card quick-primary">
        <div class="qc-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
        <div class="qc-body">
          <span class="qc-title">Nouveau ticket</span>
          <span class="qc-desc">Signalez un incident ou faites une demande</span>
        </div>
        <svg class="qc-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </router-link>

      <router-link to="/front/tickets" class="quick-card">
        <div class="qc-icon qc-icon-indigo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <div class="qc-body">
          <span class="qc-title">Mes tickets</span>
          <span class="qc-desc">
            <template v-if="statsLoading">Chargement…</template>
            <template v-else-if="openTickets !== null">
              {{ openTickets }} ticket{{ openTickets !== 1 ? 's' : '' }} en cours
            </template>
            <template v-else>Voir tous vos tickets</template>
          </span>
        </div>
        <svg class="qc-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </router-link>

      <router-link to="/front/assets" class="quick-card">
        <div class="qc-icon qc-icon-green">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <div class="qc-body">
          <span class="qc-title">Mes équipements</span>
          <span class="qc-desc">Consultez votre parc informatique</span>
        </div>
        <svg class="qc-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </router-link>

    </div>

  </div>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* ── Hero ──────────────────────────────────────────────────────── */
.hero {
  background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
  border: 1px solid #e0f2fe;
  border-radius: 20px;
  padding: 2.5rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  overflow: hidden;
  position: relative;
}

.hero-body {
  display: flex;
  flex-direction: column;
  gap: .625rem;
  z-index: 1;
}

.hero-greeting {
  font-size: .9375rem;
  font-weight: 600;
  color: #3b82f6;
  margin: 0;
}

.hero-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -.03em;
  line-height: 1.2;
  margin: 0;
}

.hero-sub {
  font-size: .9375rem;
  color: #64748b;
  margin: 0;
  max-width: 440px;
}

.hero-cta {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  margin-top: .5rem;
  padding: .6rem 1.375rem;
  background: #3b82f6;
  color: #fff;
  border-radius: 10px;
  font-size: .9375rem;
  font-weight: 700;
  text-decoration: none;
  width: fit-content;
  transition: background .15s, box-shadow .15s, transform .1s;
}

.hero-cta:hover {
  background: #2563eb;
  box-shadow: 0 6px 16px rgba(59,130,246,.3);
  transform: translateY(-1px);
}

.hero-illo {
  flex-shrink: 0;
  opacity: .85;
}

/* ── Grille d'actions rapides ───────────────────────────────────── */
.quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: .875rem;
}

.quick-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.125rem 1.25rem;
  background: #fff;
  border: 1px solid #e8edf2;
  border-radius: 14px;
  text-decoration: none;
  cursor: pointer;
  transition: box-shadow .15s, border-color .15s, transform .1s;
}

.quick-card:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,.08);
  border-color: #c7d2fe;
  transform: translateY(-2px);
}

.quick-primary {
  border-color: #bfdbfe;
  background: linear-gradient(135deg, #eff6ff, #fff);
}

.quick-primary:hover {
  border-color: #93c5fd;
  box-shadow: 0 4px 20px rgba(59,130,246,.12);
}

.qc-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #dbeafe;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.qc-icon-indigo { background: #e0e7ff; color: #4338ca; }
.qc-icon-green  { background: #dcfce7; color: #15803d; }

.qc-body {
  display: flex;
  flex-direction: column;
  gap: .2rem;
  flex: 1;
  min-width: 0;
}

.qc-title {
  font-size: .9375rem;
  font-weight: 700;
  color: #0f172a;
}

.qc-desc {
  font-size: .8125rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qc-arrow {
  color: #cbd5e1;
  flex-shrink: 0;
  transition: color .12s, transform .12s;
}

.quick-card:hover .qc-arrow {
  color: #64748b;
  transform: translateX(3px);
}

/* ── Bande de stats ─────────────────────────────────────────────── */
.stat-row {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 1.125rem 1.5rem;
  background: #fff;
  border: 1px solid #e8edf2;
  border-radius: 14px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: .1rem;
}

.stat-val {
  font-size: 1.5rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1;
}

.stat-open   { color: #2563eb; }
.stat-closed { color: #16a34a; }

.stat-label {
  font-size: .75rem;
  color: #94a3b8;
  font-weight: 500;
}

.stat-sep {
  width: 1px;
  height: 32px;
  background: #e2e8f0;
  flex-shrink: 0;
}

/* ── Responsive ─────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .hero         { flex-direction: column; padding: 1.75rem 1.25rem; }
  .hero-illo    { display: none; }
  .hero-title   { font-size: 1.375rem; }
  .stat-row     { gap: 1.25rem; }
}
</style>
