<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { 
  SearchAssets, 
  GetAssetTypes, 
  GetStatusOptions,
  // GetAssetById,
  type Asset, 
  type AssetSearchParams 
} from '@/services/assets/assetsService'
import { fetchAllEntities } from '@/services/api/entityService'
import { fetchAllLocations } from '@/services/api/locationService'
import { fetchAllUsers } from '@/services/api/userService'

const router = useRouter()

// ===== ÉTAT =====
const loading = ref(false)
const loadingFilters = ref(false)
const error = ref('')
const assets = ref<Asset[]>([])
const selectedAsset = ref<Asset | null>(null)

// Données pour les dropdowns de FILTRES
const entities = ref<any[]>([])
const locations = ref<any[]>([])
const users = ref<any[]>([])
const assetTypes = ref<any[]>([])
const statusOptions = ref<any[]>([])

// ===== FILTRES AVEC SAUVEGARDE =====
const loadFiltersFromStorage = () => {
  const saved = sessionStorage.getItem('assets_filters')
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      return {}
    }
  }
  return {}
}

const filters = ref({
  text: '',
  type: '',
  status: '',
  entityId: '',
  locationId: '',
  userId: '',
  serial: '',
  inventoryNumber: '',
  includeDeleted: false,
  ...loadFiltersFromStorage()
})

// Sauvegarde automatique des filtres
watch(filters, (newFilters) => {
  sessionStorage.setItem('assets_filters', JSON.stringify(newFilters))
}, { deep: true })

// ===== COMPUTED =====
const totalLabel = computed(() => {
  if (loading.value) return 'Chargement...'
  return `${assets.value.length} élément${assets.value.length > 1 ? 's' : ''}`
})

// ===== CHARGEMENT INITIAL =====
onMounted(async () => {
  await loadInitialData()
  await load()
})

async function loadInitialData() {
  loadingFilters.value = true
  try {
    const [allEntities, allLocations, allUsers, types, statuses] = await Promise.all([
      fetchAllEntities(),
      fetchAllLocations(),
      fetchAllUsers({ isActive: true }),
      GetAssetTypes(),
      GetStatusOptions()
    ])
    
    entities.value = allEntities
    locations.value = allLocations
    users.value = allUsers
    assetTypes.value = types
    statusOptions.value = statuses
    
    console.log('📋 Types chargés:', types)
    console.log('📋 Statuts disponibles:', statuses)
    
  } catch (e) {
    console.error('Erreur chargement données initiales:', e)
    error.value = 'Erreur lors du chargement des données'
  } finally {
    loadingFilters.value = false
  }
}

// ===== FONCTIONS DE RECHERCHE =====
function toNumber(value: string): number | undefined {
  return value === '' ? undefined : Number(value)
}

function buildSearchParams(): AssetSearchParams {
  return {
    text: filters.value.text.trim() || undefined,
    type: filters.value.type || undefined,
    status: filters.value.status || undefined,
    entityId: toNumber(filters.value.entityId),
    locationId: toNumber(filters.value.locationId),
    userId: toNumber(filters.value.userId),
    serial: filters.value.serial.trim() || undefined,
    inventoryNumber: filters.value.inventoryNumber.trim() || undefined,
    includeDeleted: filters.value.includeDeleted,
  }
}

async function load() {
  loading.value = true
  error.value = ''
  selectedAsset.value = null

  try {
    const params = buildSearchParams()
    console.log('🔍 Paramètres de recherche:', params)
    
    // 1. Récupérer TOUS les assets
    let results = await SearchAssets(params)
    
    // 2. Appliquer les filtres supplémentaires (car SearchAssets ne les gère pas)
    
    // Filtre par ENTITÉ
    if (params.entityId && params.entityId > 0) {
      const selectedEntity = entities.value.find(e => e.id === params.entityId)
      if (selectedEntity) {
        const entityNameToMatch = selectedEntity.fullPath || selectedEntity.name
        results = results.filter(a => a.entityName === entityNameToMatch)
      }
    }
    
    // Filtre par LOCALISATION
    if (params.locationId && params.locationId > 0) {
      const selectedLocation = locations.value.find(l => l.id === params.locationId)
      if (selectedLocation) {
        const locationNameToMatch = selectedLocation.fullPath || selectedLocation.name
        results = results.filter(a => a.locationName === locationNameToMatch)
      }
    }
    
    // Filtre par UTILISATEUR
    if (params.userId && params.userId > 0) {
      const selectedUser = users.value.find(u => u.id === params.userId)
      if (selectedUser) {
        const userNameToMatch = `${selectedUser.firstname} ${selectedUser.lastname}`.trim() || selectedUser.username
        results = results.filter(a => a.userName === userNameToMatch)
      }
    }
    
    assets.value = results
    
    console.log('✅ Résultats trouvés:', assets.value.length)
    
  } catch (e: any) {
    console.error(e)
    error.value = e.message || 'Erreur lors de la recherche'
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.value = {
    text: '',
    type: '',
    status: '',
    entityId: '',
    locationId: '',
    userId: '',
    serial: '',
    inventoryNumber: '',
    includeDeleted: false,
  }
  load()
}

// ===== ACTIONS =====
function selectAsset(asset: Asset) {
  selectedAsset.value = asset
}

function createTicketForAsset(asset: Asset) {
  router.push({
    path: '/tickets/create',
    query: {
      itemtype: asset.type,
      itemId: String(asset.id),
    },
  })
}

// ===== FONCTIONS D'AFFICHAGE =====

function getTypeLabel(type: string): string {
  const found = assetTypes.value.find(t => t.value === type)
  return found?.label || type
}

function getStatusLabel(status: string): string {
  return status || 'Inconnu'
}

function getEntityName(asset: Asset): string {
  if (asset.entityName && asset.entityName !== '-') return asset.entityName
  const found = entities.value.find(e => e.id === asset.entityId)
  return found?.fullPath || found?.name || `Entité #${asset.entityId}`
}

function getLocationName(asset: Asset): string {
  if (asset.locationName && asset.locationName !== '-') return asset.locationName
  const found = locations.value.find(l => l.id === asset.locationId)
  return found?.fullPath || found?.name || `Lieu #${asset.locationId}`
}

function getUserName(asset: Asset): string {
  if (asset.userName && asset.userName !== '-') return asset.userName
  const found = users.value.find(u => u.id === asset.userId)
  if (found) return `${found.firstname} ${found.lastname}`.trim() || found.username
  return `Utilisateur #${asset.userId}`
}

function formatDate(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getTypeBadgeClass(type: string): string {
  const map: Record<string, string> = {
    'Computer': 'badge-computer',
    'Monitor': 'badge-monitor',
    'Printer': 'badge-printer',
    'Phone': 'badge-phone',
    'NetworkEquipment': 'badge-network',
  }
  return map[type] || 'badge-computer'
}

function getStatusClass(status: string): string {
  const statusMap: Record<string, number> = {
    'En service': 1,
    'En production': 1,
    'En stock': 2,
    'Réformé': 3,
    'En maintenance': 4,
    'En attente': 4,
    'En panne': 5,
    'Hors service': 6,
  }
  const id = statusMap[status] || 0
  return `status-${id}`
}
</script>

<template>
  <div class="module-view animate-in">
    <!-- EN-TÊTE -->
    <div class="mv-header">
      <div class="mv-title-wrap">
        <div class="mv-icon icon-blue">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <div>
          <h1 class="mv-title">Éléments du parc</h1>
          <p class="mv-sub">Recherche multi-critères via GLPI</p>
        </div>
      </div>
      <div class="mv-actions">
        <span class="result-count">{{ totalLabel }}</span>
        <button class="btn-secondary" @click="resetFilters" :disabled="loading">Réinitialiser</button>
        <button class="btn-fetch" @click="load" :disabled="loading">
          <svg v-if="loading" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          {{ loading ? 'Chargement...' : 'Rechercher' }}
        </button>
      </div>
    </div>

    <!-- ERREUR -->
    <div v-if="error" class="alert-error">{{ error }}</div>

    <!-- FILTRES -->
    <div class="filters-card">
      <div class="filter-group">
        <label>Recherche</label>
        <input v-model="filters.text" type="text" placeholder="Nom de l'élément" @keyup.enter="load" />
      </div>

      <div class="filter-group">
        <label>Type</label>
        <select v-model="filters.type">
          <option v-for="type in assetTypes" :key="type.value" :value="type.value">
            {{ type.label }} ({{ type.count }})
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label>Statut</label>
        <select v-model="filters.status">
          <option v-for="status in statusOptions" :key="status.value" :value="status.value">
            {{ status.label }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label>Entité</label>
        <select v-model="filters.entityId" :disabled="loadingFilters">
          <option value="">Toutes les entités</option>
          <option v-for="entity in entities" :key="entity.id" :value="String(entity.id)">
            {{ entity.fullPath || entity.name }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label>Localisation</label>
        <select v-model="filters.locationId" :disabled="loadingFilters">
          <option value="">Toutes les localisations</option>
          <option v-for="location in locations" :key="location.id" :value="String(location.id)">
            {{ location.fullPath || location.name }}
          </option>
        </select>
      </div>

      <!-- <div class="filter-group">
        <label>Utilisateur</label>
        <select v-model="filters.userId" :disabled="loadingFilters">
          <option value="">Tous les utilisateurs</option>
          <option v-for="user in users" :key="user.id" :value="String(user.id)">
            {{ `${user.firstname} ${user.lastname}`.trim() || user.username }}
          </option>
        </select>
      </div> -->

      <div class="filter-group">
        <label>Série</label>
        <input v-model="filters.serial" type="text" placeholder="Numéro de série" @keyup.enter="load" />
      </div>

      <!-- <div class="filter-group">
        <label>Inventaire</label>
        <input v-model="filters.inventoryNumber" type="text" placeholder="Numéro interne" @keyup.enter="load" />
      </div> -->

      <label class="checkbox-filter">
        <input v-model="filters.includeDeleted" type="checkbox" />
        <span>Afficher supprimés</span>
      </label>
    </div>

    <!-- LISTE DES ASSETS -->
    <div class="assets-layout">
      <div class="table-container" v-if="assets.length > 0">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Nom</th>
              <th>Statut</th>
              <th>Entité</th>
              <th>Localisation</th>
              <th>Utilisateur</th>
              <th>Série</th>
              <th>Inventaire</th>
              <th>Créé le</th>
              <th>Modifié le</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="asset in assets"
              :key="`${asset.type}-${asset.id}`"
              :class="{ selected: selectedAsset?.id === asset.id }"
              @click="selectAsset(asset)"
            >
              <td>
                <span :class="['badge', getTypeBadgeClass(asset.type)]">
                  {{ getTypeLabel(asset.type) }}
                </span>
              </td>
              <td class="fw-bold">#{{ asset.id }} - {{ asset.name }}</td>
              <td>
                <span :class="['status-dot', getStatusClass(asset.status)]"></span>
                {{ getStatusLabel(asset.status) }}
              </td>
              <td>{{ getEntityName(asset) }}</td>
              <td>{{ getLocationName(asset) }}</td>
              <td>{{ getUserName(asset) }}</td>
              <td>{{ asset.serial || '-' }}</td>
              <td>{{ asset.inventoryNumber || '-' }}</td>
              <td>{{ formatDate(asset.createdAt) }}</td>
              <td>{{ formatDate(asset.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ÉTAT VIDE -->
      <div v-else class="empty-module">
        <div class="em-icon icon-blue">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2" />
          </svg>
        </div>
        <h2>Aucun élément</h2>
        <p>Lancez une recherche ou modifiez vos critères.</p>
      </div>

      <!-- DÉTAIL DE L'ASSET SÉLECTIONNÉ -->
      <aside class="asset-detail" v-if="selectedAsset">
        <div class="detail-header">
          <div>
            <span :class="['badge', getTypeBadgeClass(selectedAsset.type)]">
              {{ getTypeLabel(selectedAsset.type) }}
            </span>
            <h2>{{ selectedAsset.name }}</h2>
          </div>
          <button class="btn-close" @click="selectedAsset = null">×</button>
        </div>

        <dl>
          <dt>ID GLPI</dt>
          <dd>#{{ selectedAsset.id }}</dd>
          <dt>Statut</dt>
          <dd>{{ getStatusLabel(selectedAsset.status) }}</dd>
          <dt>Entité</dt>
          <dd>{{ getEntityName(selectedAsset) }}</dd>
          <dt>Localisation</dt>
          <dd>{{ getLocationName(selectedAsset) }}</dd>
          <dt>Utilisateur affecté</dt>
          <dd>{{ getUserName(selectedAsset) }}</dd>
          <dt>Numéro de série</dt>
          <dd>{{ selectedAsset.serial || '-' }}</dd>
          <dt>Numéro d'inventaire</dt>
          <dd>{{ selectedAsset.inventoryNumber || '-' }}</dd>
          <dt>Date de création</dt>
          <dd>{{ formatDate(selectedAsset.createdAt) }}</dd>
          <dt>Dernière modification</dt>
          <dd>{{ formatDate(selectedAsset.updatedAt) }}</dd>
        </dl>

        <button class="btn-primary full-width" @click="createTicketForAsset(selectedAsset)">
          Créer un ticket avec cet élément
        </button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
@import '@/styles/tsanta/AssetsList.css';
</style>