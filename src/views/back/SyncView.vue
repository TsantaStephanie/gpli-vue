<!-- views/SyncView.vue -->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { GlpiToSQLiteSync, type SyncResult } from '@/services/import/glpiToSqlite'
import { SqliteToGLPISync, type PushResult } from '@/services/import/SqliteToGlpi'
import { SQLiteService } from '@/services/import/sqliteService'

// État
const syncing = ref(false)
const pushing = ref(false)
const syncDirection = ref<'backup' | 'restore' | null>(null)
const syncResult = ref<SyncResult | null>(null)
const pushResult = ref<PushResult | null>(null)
const dbStats = ref<any>(null)
const syncHistory = ref<any[]>([])
const dbPath = ref('./glpi_backup.db')

// Computed
const hasStats = computed(() => dbStats.value !== null)
const lastSyncDate = computed(() => {
  if (!dbStats.value?.lastSync?.completed_at) return 'Jamais'
  return new Date(dbStats.value.lastSync.completed_at).toLocaleString('fr-FR')
})

// Méthodes
async function loadStats() {
  const sqlite = new SQLiteService(dbPath.value)
  try {
    await sqlite.initialize()
    dbStats.value = await sqlite.getStats()
    syncHistory.value = await sqlite.getSyncHistory(10)
  } catch (err: any) {
    console.error('Erreur chargement stats:', err)
  } finally {
    await sqlite.close()
  }
}

async function backupToSQLite() {
  syncing.value = true
  syncDirection.value = 'backup'
  syncResult.value = null

  try {
    const syncService = new GlpiToSQLiteSync(dbPath.value)
    syncResult.value = await syncService.sync()
    await loadStats()
    
    if (syncResult.value.success) {
      alert(`✅ Backup réussi !\nActifs: ${syncResult.value.assetsStored}\nTickets: ${syncResult.value.ticketsStored}\nCoûts: ${syncResult.value.costsStored}`)
    } else {
      alert(`⚠️ Backup terminé avec erreurs\n${syncResult.value.errors.slice(0, 3).join('\n')}`)
    }
  } catch (err: any) {
    console.error('Erreur backup:', err)
    alert(`❌ Erreur: ${err.message}`)
  } finally {
    syncing.value = false
    syncDirection.value = null
  }
}

async function restoreToGLPI() {
  if (!confirm('⚠️ Attention : Cette opération va pousser les données SQLite vers GLPI. Les actifs et tickets non synchronisés seront créés dans GLPI. Continuer ?')) {
    return
  }

  pushing.value = true
  syncDirection.value = 'restore'
  pushResult.value = null

  try {
    const pushService = new SqliteToGLPISync(dbPath.value)
    pushResult.value = await pushService.push()
    await loadStats()
    
    if (pushResult.value.success) {
      alert(`✅ Restauration réussie !\nActifs: ${pushResult.value.assetsPushed}\nTickets: ${pushResult.value.ticketsPushed}\nCoûts: ${pushResult.value.costsPushed}`)
    } else {
      alert(`⚠️ Restauration terminée avec erreurs\n${pushResult.value.errors.slice(0, 3).join('\n')}`)
    }
  } catch (err: any) {
    console.error('Erreur restauration:', err)
    alert(`❌ Erreur: ${err.message}`)
  } finally {
    pushing.value = false
    syncDirection.value = null
  }
}

onMounted(() => {
  loadStats()
})
</script>

<template>
  <div class="sync-view">
    <!-- Header -->
    <div class="sync-header">
      <div class="sync-title-wrap">
        <div class="sync-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M20 12A8 8 0 0 1 4 12m16 0-4-4m4 4-4 4M4 12a8 8 0 0 1 16 0m-16 0 4-4m-4 4 4 4"/>
            <path d="M12 8v4l2 2"/>
          </svg>
        </div>
        <div>
          <h1 class="sync-title">Synchronisation GLPI ↔ SQLite</h1>
          <p class="sync-sub">Synchronisez vos données entre GLPI et votre base SQLite de secours</p>
        </div>
      </div>
    </div>

    <!-- Configuration DB -->
    <div class="db-config">
      <label>Chemin base SQLite :</label>
      <input type="text" v-model="dbPath" class="db-path-input" disabled />
      <span class="db-badge">{{ dbPath.includes('.db') ? '✅ Base SQLite' : '📁 Fichier .db' }}</span>
    </div>

    <!-- Stats -->
    <div v-if="hasStats" class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon assets">📦</div>
        <div class="stat-content">
          <div class="stat-number">{{ dbStats.assets.total }}</div>
          <div class="stat-label">Actifs</div>
          <div class="stat-detail">
            <span class="synced">✓ {{ dbStats.assets.synced }} synchronisés</span>
            <span v-if="dbStats.assets.notSynced > 0" class="not-synced">⏳ {{ dbStats.assets.notSynced }} en attente</span>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon tickets">🎫</div>
        <div class="stat-content">
          <div class="stat-number">{{ dbStats.tickets.total }}</div>
          <div class="stat-label">Tickets</div>
          <div class="stat-detail">
            <span class="synced">✓ {{ dbStats.tickets.synced }} synchronisés</span>
            <span v-if="dbStats.tickets.notSynced > 0" class="not-synced">⏳ {{ dbStats.tickets.notSynced }} en attente</span>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon costs">💰</div>
        <div class="stat-content">
          <div class="stat-number">{{ dbStats.costs }}</div>
          <div class="stat-label">Coûts associés</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon history">📅</div>
        <div class="stat-content">
          <div class="stat-number">{{ lastSyncDate }}</div>
          <div class="stat-label">Dernière synchronisation</div>
        </div>
      </div>
    </div>

    <!-- Actions principales -->
    <div class="actions-container">
      <!-- Backup: GLPI → SQLite -->
      <div class="action-card backup">
        <div class="action-icon">⬇️</div>
        <h3>Sauvegarde GLPI → SQLite</h3>
        <p>Récupère les données depuis GLPI et les stocke dans votre base SQLite locale.</p>
        <button 
          class="btn-backup" 
          :disabled="syncing || pushing"
          @click="backupToSQLite"
        >
          <span v-if="syncing && syncDirection === 'backup'" class="spinner"></span>
          <span v-else>⬇️ Sauvegarder vers SQLite</span>
        </button>
      </div>

      <!-- Restore: SQLite → GLPI -->
      <div class="action-card restore">
        <div class="action-icon">⬆️</div>
        <h3>Restauration SQLite → GLPI</h3>
        <p>Pousse les données depuis SQLite vers GLPI. Les éléments non synchronisés seront créés.</p>
        <button 
          class="btn-restore" 
          :disabled="syncing || pushing"
          @click="restoreToGLPI"
        >
          <span v-if="pushing && syncDirection === 'restore'" class="spinner"></span>
          <span v-else>⬆️ Restaurer vers GLPI</span>
        </button>
      </div>
    </div>

    <!-- Résultats -->
    <div v-if="syncResult || pushResult" class="result-section">
      <h3>Résultat de la synchronisation</h3>
      
      <!-- Backup Result -->
      <div v-if="syncResult" class="result-details">
        <div :class="['result-status', syncResult.success ? 'success' : 'error']">
          {{ syncResult.success ? '✅ Succès' : '⚠️ Terminé avec erreurs' }}
        </div>
        <div class="result-stats">
          <div class="stat-line">📦 Actifs: {{ syncResult.assetsStored }} / {{ syncResult.assetsFetched }}</div>
          <div class="stat-line">🎫 Tickets: {{ syncResult.ticketsStored }} / {{ syncResult.ticketsFetched }}</div>
          <div class="stat-line">💰 Coûts: {{ syncResult.costsStored }}</div>
          <div class="stat-line">⏱️ Durée: {{ (syncResult.duration / 1000).toFixed(2) }}s</div>
        </div>
        <div v-if="syncResult.errors.length > 0" class="result-errors">
          <strong>⚠️ Erreurs:</strong>
          <ul>
            <li v-for="err in syncResult.errors.slice(0, 5)" :key="err">{{ err }}</li>
            <li v-if="syncResult.errors.length > 5">... et {{ syncResult.errors.length - 5 }} autres</li>
          </ul>
        </div>
      </div>

      <!-- Restore Result -->
      <div v-if="pushResult" class="result-details">
        <div :class="['result-status', pushResult.success ? 'success' : 'error']">
          {{ pushResult.success ? '✅ Succès' : '⚠️ Terminé avec erreurs' }}
        </div>
        <div class="result-stats">
          <div class="stat-line">📦 Actifs pushés: {{ pushResult.assetsPushed }} ({{ pushResult.assetsFailed }} échecs)</div>
          <div class="stat-line">🎫 Tickets pushés: {{ pushResult.ticketsPushed }} ({{ pushResult.ticketsFailed }} échecs)</div>
          <div class="stat-line">💰 Coûts pushés: {{ pushResult.costsPushed }}</div>
          <div class="stat-line">⏱️ Durée: {{ (pushResult.duration / 1000).toFixed(2) }}s</div>
        </div>
        <div v-if="pushResult.errors.length > 0" class="result-errors">
          <strong>⚠️ Erreurs:</strong>
          <ul>
            <li v-for="err in pushResult.errors.slice(0, 5)" :key="err">{{ err }}</li>
            <li v-if="pushResult.errors.length > 5">... et {{ pushResult.errors.length - 5 }} autres</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Historique -->
    <div v-if="syncHistory.length > 0" class="history-section">
      <h3>📜 Historique des synchronisations</h3>
      <table class="history-table">
        <thead>
          <tr><th>Date</th><th>Direction</th><th>Entités</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr v-for="entry in syncHistory" :key="entry.id">
            <td>{{ new Date(entry.started_at).toLocaleString('fr-FR') }}</td>
            <td>
              <span :class="['badge', entry.direction === 'GLPI_TO_SQLITE' ? 'badge-backup' : 'badge-restore']">
                {{ entry.direction === 'GLPI_TO_SQLITE' ? '⬇️ GLPI → SQLite' : '⬆️ SQLite → GLPI' }}
              </span>
            </td>
            <td>{{ entry.entity_type }}</td>
            <td>
              <span :class="['badge', entry.status === 'success' ? 'badge-success' : 'badge-error']">
                {{ entry.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>

</style>