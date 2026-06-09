<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { GetAssets, RefreshCache, type Asset } from '@/services/assets/assetsService'

const router   = useRouter()
const loading   = ref(false)
const loadError = ref('')
const allAssets = ref<Asset[]>([])
const selected  = ref<Asset | null>(null)
const activeType = ref<string>('all')
const searchText = ref('')

// ── Chargement ─────────────────────────────────────────────────
async function load(force = false) {
  loading.value  = true
  loadError.value = ''
  try {
    if (force) await RefreshCache()
    allAssets.value = await GetAssets()
  } catch (e: any) {
    loadError.value = e.message || 'Impossible de charger les équipements.'
    console.error(e)
  } finally {
    loading.value = false
  }
}

// ── Filtres par type ────────────────────────────────────────────
const TYPE_FILTERS = [
  { key: 'all',              label: 'Tous' },
  { key: 'Computer',         label: 'Ordinateurs' },
  { key: 'Monitor',          label: 'Écrans' },
  { key: 'Printer',          label: 'Imprimantes' },
  { key: 'Phone',            label: 'Téléphones' },
  { key: 'NetworkEquipment', label: 'Réseau' },
] as const

function typeCount(key: string): number {
  if (key === 'all') return allAssets.value.length
  return allAssets.value.filter(a => a.type === key).length
}

const visibleFilters = computed(() =>
  TYPE_FILTERS.filter(f => f.key === 'all' || typeCount(f.key) > 0)
)

const assets = computed(() => {
  let result = allAssets.value
  if (activeType.value !== 'all') {
    result = result.filter(a => a.type === activeType.value)
  }
  const t = searchText.value.trim().toLowerCase()
  if (t) {
    result = result.filter(a =>
      a.name.toLowerCase().includes(t) ||
      a.serial?.toLowerCase().includes(t) ||
      a.inventoryNumber?.toLowerCase().includes(t)
    )
  }
  return result
})

// ── Sélection / modal ───────────────────────────────────────────
function openAsset(asset: Asset) { selected.value = asset }
function closeModal()            { selected.value = null  }

function createTicketForAsset(asset: Asset) {
  router.push({
    path: '/front/tickets/create',
    query: { itemtype: asset.type, itemId: String(asset.id) },
  })
}

// ── Helpers d'affichage ─────────────────────────────────────────
const TYPE_META: Record<string, { label: string; color: string; short: string }> = {
  Computer:         { label: 'Ordinateur',  color: 'blue',   short: 'PC'  },
  Monitor:          { label: 'Écran',        color: 'green',  short: 'MON' },
  Printer:          { label: 'Imprimante',   color: 'orange', short: 'IMP' },
  Phone:            { label: 'Téléphone',    color: 'purple', short: 'TÉL' },
  NetworkEquipment: { label: 'Réseau',       color: 'cyan',   short: 'NET' },
}

function typeMeta(type: string) {
  return TYPE_META[type] ?? { label: type, color: 'gray', short: type.slice(0, 3).toUpperCase() }
}

const STATUS_COLORS: Record<string, string> = {
  'En production':  'green',
  'En stock':       'yellow',
  'En maintenance': 'orange',
  'En panne':       'red',
  'Réformé':        'gray',
  'Hors service':   'gray',
}

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'gray'
}

function relativeDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return "À l'instant"
  if (mins  < 60) return `il y a ${mins} min`
  if (hours < 24) return `il y a ${hours}h`
  if (days  < 30) return `il y a ${days}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatFull(dateStr?: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

// ── Photos d'actifs ─────────────────────────────────────────────
// Set des clés d'actifs dont l'image a échoué — remplacé pour déclencher la réactivité
const failedPictures = ref<Set<string>>(new Set())

function onPictureError(asset: Asset) {
  const key = `${asset.type}-${asset.id}`
  failedPictures.value = new Set([...failedPictures.value, key])
}

function hasPicture(asset: Asset): boolean {
  return !!asset.picture && !failedPictures.value.has(`${asset.type}-${asset.id}`)
}

function getAssetPictureUrl(picture: string): string {
  // GLPI renvoie p. ex. "_pictures/ComputerFront_8.png"
  const path = picture.startsWith('_pictures/') ? picture : `_pictures/${picture}`
  return `/front/document.send.php?file=${encodeURIComponent(path)}`
}

onMounted(() => load())
</script>

<template>
  <div class="portal-page">

    <!-- ── Hero ─────────────────────────────────────────────── -->
    <div class="portal-hero">
      <div class="hero-text">
        <h1>Mon parc informatique</h1>
        <p>Consultez les équipements qui vous sont affectés</p>
      </div>
    </div>

    <!-- ── Barre de filtres ──────────────────────────────────── -->
    <div class="filter-bar">
      <div class="filter-pills">
        <button
          v-for="f in visibleFilters" :key="f.key"
          class="pill" :class="{ active: activeType === f.key }"
          @click="activeType = f.key"
        >
          {{ f.label }}
          <span class="pill-count">{{ typeCount(f.key) }}</span>
        </button>
      </div>
      <div class="filter-right">
        <div class="search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            v-model="searchText"
            type="text"
            placeholder="Rechercher…"
          />
          <button v-if="searchText" class="search-clear" @click="searchText = ''">×</button>
        </div>
        <button class="btn-refresh" @click="load(true)" :disabled="loading">
          <svg :class="{ spin: loading }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Actualiser
        </button>
      </div>
    </div>

    <!-- ── Erreur ───────────────────────────────────────────────── -->
    <div v-if="loadError" class="load-error">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {{ loadError }}
      <button class="err-retry" @click="load(true)">Réessayer</button>
    </div>

    <!-- ── Skeleton loader ───────────────────────────────────── -->
    <div v-if="loading" class="assets-grid">
      <div v-for="n in 9" :key="n" class="skeleton-card"></div>
    </div>

    <!-- ── Grille de cartes ──────────────────────────────────── -->
    <div v-else-if="assets.length" class="assets-grid">
      <button
        v-for="asset in assets" :key="`${asset.type}-${asset.id}`"
        class="asset-card"
        @click="openAsset(asset)"
      >
        <!-- Photo ou couleur de type -->
        <div class="card-photo" :class="`photo-bg-${typeMeta(asset.type).color}`">
          <img
            v-if="hasPicture(asset)"
            :src="getAssetPictureUrl(asset.picture!)"
            :alt="asset.name"
            class="card-photo-img"
            @error="onPictureError(asset)"
          />
          <span v-else class="photo-placeholder-text">{{ typeMeta(asset.type).short }}</span>
        </div>

        <div class="card-top">
          <span class="type-chip" :class="`chip-${typeMeta(asset.type).color}`">
            {{ typeMeta(asset.type).short }}
          </span>
          <span class="asset-num">#{{ asset.id }}</span>
        </div>

        <h3 class="card-title">{{ asset.name }}</h3>

        <div class="card-meta">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span class="card-location">{{ asset.locationName && asset.locationName !== '-' ? asset.locationName : '—' }}</span>
        </div>

        <div class="card-bottom">
          <span class="status-chip" :class="`chip-${statusColor(asset.status)}`">
            <span class="chip-dot"></span>
            {{ asset.status || 'Inconnu' }}
          </span>
          <span class="card-date">{{ relativeDate(asset.updatedAt) }}</span>
        </div>
      </button>
    </div>

    <!-- ── État vide ─────────────────────────────────────────── -->
    <div v-else class="empty-portal">
      <div class="empty-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
      <p class="empty-title">Aucun équipement</p>
      <p class="empty-sub">Aucun matériel ne correspond à votre recherche.</p>
      <button v-if="searchText || activeType !== 'all'" class="btn-ghost" @click="searchText = ''; activeType = 'all'">
        Réinitialiser les filtres
      </button>
    </div>



  <!-- ── Modal détail (Teleport à l'intérieur du root pour éviter le warning Transition) -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="selected" class="modal-overlay" @click.self="closeModal">
        <div class="modal-card">

          <div class="modal-header">
            <div class="modal-chips">
              <span class="type-chip" :class="`chip-${typeMeta(selected.type).color}`">
                {{ typeMeta(selected.type).label }}
              </span>
              <span class="status-chip" :class="`chip-${statusColor(selected.status)}`">
                <span class="chip-dot"></span>
                {{ selected.status || 'Inconnu' }}
              </span>
              <span class="asset-num">#{{ selected.id }}</span>
            </div>
            <button class="modal-close" @click="closeModal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Photo de l'actif (si disponible) -->
          <div v-if="hasPicture(selected!)" class="modal-photo">
            <img
              :src="getAssetPictureUrl(selected!.picture!)"
              :alt="selected!.name"
              class="modal-photo-img"
              @error="onPictureError(selected!)"
            />
          </div>

          <h2 class="modal-title">{{ selected.name }}</h2>

          <div class="modal-meta">
            <div class="meta-item" v-if="selected.locationName && selected.locationName !== '-'">
              <span class="meta-label">Localisation</span>
              <span class="meta-val">{{ selected.locationName }}</span>
            </div>
            <div class="meta-item" v-if="selected.userName && selected.userName !== '-'">
              <span class="meta-label">Utilisateur</span>
              <span class="meta-val">{{ selected.userName }}</span>
            </div>
            <div class="meta-item" v-if="selected.entityName && selected.entityName !== '-'">
              <span class="meta-label">Entité</span>
              <span class="meta-val">{{ selected.entityName }}</span>
            </div>
            <div class="meta-item" v-if="selected.serial">
              <span class="meta-label">N° de série</span>
              <span class="meta-val meta-mono">{{ selected.serial }}</span>
            </div>
            <div class="meta-item" v-if="selected.inventoryNumber">
              <span class="meta-label">N° d'inventaire</span>
              <span class="meta-val meta-mono">{{ selected.inventoryNumber }}</span>
            </div>
            <div class="meta-item" v-if="selected.updatedAt">
              <span class="meta-label">Dernière mise à jour</span>
              <span class="meta-val">{{ formatFull(selected.updatedAt) }}</span>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-ghost" @click="closeModal">Fermer</button>
            <button class="btn-cta" @click="createTicketForAsset(selected)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Créer un ticket
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</div>
</template>

<style scoped>
/* ── Page ──────────────────────────────────────────────────── */
.portal-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 2rem;
}

/* ── Hero ──────────────────────────────────────────────────── */
.portal-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero-text h1 {
  font-size: 1.625rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -.03em;
  margin: 0;
}

.hero-text p {
  font-size: .875rem;
  color: #64748b;
  margin: .25rem 0 0;
}

/* ── Filtres ───────────────────────────────────────────────── */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter-pills {
  display: flex;
  gap: .375rem;
  background: #f1f5f9;
  padding: .25rem;
  border-radius: 12px;
  flex-wrap: wrap;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: .375rem;
  padding: .4rem .875rem;
  border-radius: 9px;
  border: none;
  background: none;
  font-size: .8125rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all .15s;
}
.pill:hover  { background: #e2e8f0; color: #334155; }
.pill.active { background: #fff; color: #3b82f6; box-shadow: 0 1px 3px rgba(0,0,0,.08); }

.pill-count {
  background: #e2e8f0;
  color: #64748b;
  font-size: .625rem;
  font-weight: 700;
  padding: .1rem .375rem;
  border-radius: 100px;
  min-width: 18px;
  text-align: center;
}
.pill.active .pill-count { background: #dbeafe; color: #1d4ed8; }

.filter-right {
  display: flex;
  align-items: center;
  gap: .5rem;
}

/* search box */
.search-box {
  display: flex;
  align-items: center;
  gap: .375rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  padding: 0 .75rem;
  height: 34px;
  color: #94a3b8;
  transition: border-color .15s;
}
.search-box:focus-within {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(59,130,246,.08);
}

.search-box input {
  border: none;
  outline: none;
  font-size: .8125rem;
  color: #0f172a;
  background: transparent;
  width: 140px;
}
.search-box input::placeholder { color: #94a3b8; }

.search-clear {
  background: none;
  border: none;
  font-size: 1rem;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color .1s;
}
.search-clear:hover { color: #475569; }

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: .375rem;
  padding: .4rem .875rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  font-size: .8125rem;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: background .15s;
}
.btn-refresh:hover:not(:disabled) { background: #f8fafc; }
.btn-refresh:disabled { opacity: .5; cursor: not-allowed; }
.btn-refresh svg.spin { animation: spin .8s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Grille de cartes ──────────────────────────────────────── */
.assets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: .875rem;
}

.asset-card {
  background: #fff;
  border: 1px solid #e8edf2;
  border-radius: 14px;
  padding: 1.125rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: .625rem;
  cursor: pointer;
  text-align: left;
  transition: box-shadow .15s, transform .1s, border-color .15s;
}
.asset-card:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,.08);
  border-color: #c7d2fe;
  transform: translateY(-2px);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.asset-num {
  font-size: .75rem;
  font-weight: 700;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.card-title {
  font-size: .9375rem;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: .3rem;
  color: #94a3b8;
  min-height: 16px;
}

.card-location {
  font-size: .75rem;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.card-date {
  font-size: .75rem;
  color: #94a3b8;
}

/* ── Chips de type & statut ────────────────────────────────── */
.type-chip, .status-chip {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  font-size: .6875rem;
  font-weight: 700;
  padding: .2rem .5rem;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.chip-blue   { background: #dbeafe; color: #1d4ed8; }
.chip-green  { background: #dcfce7; color: #15803d; }
.chip-orange { background: #ffedd5; color: #c2410c; }
.chip-purple { background: #f3e8ff; color: #7e22ce; }
.chip-cyan   { background: #cffafe; color: #0e7490; }
.chip-yellow { background: #fef9c3; color: #854d0e; }
.chip-red    { background: #fee2e2; color: #b91c1c; }
.chip-gray   { background: #f1f5f9; color: #475569; }

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

/* ── Photo de la carte ─────────────────────────────────────── */
.card-photo {
  height: 110px;
  border-radius: 9px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-placeholder-text {
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: .05em;
  opacity: .3;
  user-select: none;
}

/* Fonds dégradés par type */
.photo-bg-blue   { background: linear-gradient(135deg, #eff6ff, #dbeafe); color: #1d4ed8; }
.photo-bg-green  { background: linear-gradient(135deg, #f0fdf4, #dcfce7); color: #15803d; }
.photo-bg-orange { background: linear-gradient(135deg, #fff7ed, #ffedd5); color: #c2410c; }
.photo-bg-purple { background: linear-gradient(135deg, #faf5ff, #f3e8ff); color: #7e22ce; }
.photo-bg-cyan   { background: linear-gradient(135deg, #ecfeff, #cffafe); color: #0e7490; }
.photo-bg-gray   { background: linear-gradient(135deg, #f8fafc, #f1f5f9); color: #475569; }

/* ── Skeleton loader ───────────────────────────────────────── */
.skeleton-card {
  height: 252px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e8edf2 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 14px;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Empty state ───────────────────────────────────────────── */
.empty-portal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .875rem;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  width: 72px;
  height: 72px;
  background: #f1f5f9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

.empty-title { font-size: 1.125rem; font-weight: 700; color: #334155; margin: 0; }
.empty-sub   { font-size: .875rem;  color: #94a3b8; margin: 0; }

/* ── Modal ─────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15,23,42,.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

@media (min-width: 640px) {
  .modal-overlay { align-items: center; }
}

.modal-card {
  background: #fff;
  border-radius: 20px;
  width: 100%;
  max-width: 520px;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  box-shadow: 0 24px 60px rgba(0,0,0,.2);
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.modal-chips { display: flex; align-items: center; gap: .375rem; flex-wrap: wrap; }

.modal-close {
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  cursor: pointer;
  flex-shrink: 0;
  transition: background .15s;
}
.modal-close:hover { background: #e2e8f0; color: #0f172a; }

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.4;
  margin: 0;
}

.modal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: .75rem 1.5rem;
  padding: .875rem 1rem;
  background: #f8fafc;
  border-radius: 10px;
}

.meta-item  { display: flex; flex-direction: column; gap: .125rem; }
.meta-label { font-size: .6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; }
.meta-val   { font-size: .875rem; font-weight: 500; color: #334155; }
.meta-mono  { font-family: ui-monospace, 'Cascadia Code', monospace; font-size: .8125rem; color: #1e293b; }

/* ── Photo dans le modal ───────────────────────────────────── */
.modal-photo {
  height: 200px;
  border-radius: 12px;
  overflow: hidden;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
}

.modal-photo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: .75rem;
  padding-top: .25rem;
  border-top: 1px solid #f1f5f9;
}

.btn-ghost {
  padding: .5rem 1.25rem;
  border: 1px solid #e2e8f0;
  background: none;
  border-radius: 8px;
  font-size: .875rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: background .15s;
}
.btn-ghost:hover { background: #f8fafc; }

.btn-cta {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  padding: .5rem 1.125rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 9px;
  font-weight: 600;
  font-size: .875rem;
  cursor: pointer;
  transition: background .15s, box-shadow .15s, transform .1s;
}
.btn-cta:hover { background: #2563eb; box-shadow: 0 4px 12px rgba(59,130,246,.3); transform: translateY(-1px); }

/* ── Transition modal ──────────────────────────────────────── */
.modal-enter-active, .modal-leave-active { transition: opacity .2s, transform .2s; }
.modal-enter-from, .modal-leave-to       { opacity: 0; transform: translateY(16px); }

/* ── Bannière d'erreur ─────────────────────────────────────── */
.load-error {
  display: flex;
  align-items: center;
  gap: .625rem;
  padding: .75rem 1rem;
  background: #fef2f2;
  border: 1px solid rgba(239,68,68,.2);
  border-left: 3px solid #ef4444;
  border-radius: 10px;
  font-size: .875rem;
  color: #b91c1c;
}
.err-retry {
  margin-left: auto;
  padding: .3rem .75rem;
  border: 1px solid rgba(239,68,68,.3);
  background: none;
  border-radius: 6px;
  font-size: .8125rem;
  font-weight: 600;
  color: #b91c1c;
  cursor: pointer;
  transition: background .15s;
}
.err-retry:hover { background: rgba(239,68,68,.08); }

/* ── Responsive ────────────────────────────────────────────── */
@media (max-width: 640px) {
  .filter-bar  { flex-direction: column; align-items: stretch; }
  .filter-right { justify-content: space-between; }
  .search-box input { width: 100px; }
}
</style>
