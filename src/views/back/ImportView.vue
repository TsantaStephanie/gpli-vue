<script setup lang="ts">
/**
 * ImportView.vue
 * Interface d'import CSV → GLPI
 * Route suggérée : /import
 */
import { ref, computed } from 'vue'
import { importService, type ImportResult, type ImportLogEntry } from '@/services/import/importService'

// ─── État des fichiers ────────────────────────────────────────────────────────
const sheet1 = ref<File | null>(null)
const sheet2 = ref<File | null>(null)
const sheet3 = ref<File | null>(null)
const photosZip = ref<File | null>(null)

// ─── État de l'import ─────────────────────────────────────────────────────────
const importing   = ref(false)
const progress    = ref(0)
const progressMsg = ref('')
const result      = ref<ImportResult | null>(null)
const logFilter   = ref<'all' | 'error' | 'warning' | 'success'>('all')

// ─── Computed ─────────────────────────────────────────────────────────────────
const canImport = computed(() => sheet1.value && sheet2.value && sheet3.value && !importing.value)

const filteredLogs = computed<ImportLogEntry[]>(() => {
  if (!result.value) return []
  const logs = result.value.logs
  if (logFilter.value === 'all') return logs
  return logs.filter(l => l.level === logFilter.value)
})

const logCounts = computed(() => {
  const logs = result.value?.logs ?? []
  return {
    all:     logs.length,
    error:   logs.filter(l => l.level === 'error').length,
    warning: logs.filter(l => l.level === 'warning').length,
    success: logs.filter(l => l.level === 'success').length,
  }
})

// ─── Handlers fichiers ────────────────────────────────────────────────────────
function onFileChange(event: Event, target: 'sheet1' | 'sheet2' | 'sheet3' | 'photos') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (target === 'sheet1') sheet1.value = file
  else if (target === 'sheet2') sheet2.value = file
  else if (target === 'sheet3') sheet3.value = file
  else photosZip.value = file
}

// ─── Lancement import ─────────────────────────────────────────────────────────
async function runImport() {
  if (!sheet1.value || !sheet2.value || !sheet3.value) return

  importing.value = true
  result.value = null
  progress.value = 0

  try {
    result.value = await importService.runFullImport(
      sheet1.value,
      sheet2.value,
      sheet3.value,
      photosZip.value,
      (pct, step) => {
        progress.value = pct
        progressMsg.value = step
      },
    )
  } catch (e: any) {
    result.value = {
      success: false,
      rolledBack: false,
      logs: [{ level: 'error', message: `Erreur fatale : ${e.message}`, timestamp: new Date().toISOString(), details: e.response?.data }],
      stats: {
        assets:  { total: 0, created: 0, skipped: 0, errors: 1 },
        tickets: { total: 0, created: 0, skipped: 0, errors: 0 },
        costs:   { total: 0, created: 0, errors: 0 },
        photos:  { total: 0, uploaded: 0, errors: 0 },
        users:   { total: 0, created: 0, errors: 0 },
      },
    }
  } finally {
    importing.value = false
    progress.value = 100
  }
}

function reset() {
  sheet1.value = null
  sheet2.value = null
  sheet3.value = null
  photosZip.value = null
  result.value = null
  progress.value = 0
  progressMsg.value = ''
}

function logClass(level: ImportLogEntry['level']) {
  return {
    'log-success': level === 'success',
    'log-error':   level === 'error',
    'log-warning': level === 'warning',
    'log-info':    level === 'info',
  }
}

function logIcon(level: ImportLogEntry['level']) {
  return { success: '✓', error: '✗', warning: '⚠', info: '·' }[level]
}

function formatDetails(details: any): string {
  if (!details) return ''
  if (typeof details === 'string') return details
  try { return JSON.stringify(details, null, 2) } catch { return String(details) }
}
</script>

<template>
  <div class="import-view animate-in">

    <!-- ── Header ── -->
    <div class="mv-header">
      <div class="mv-title-wrap">
        <div class="mv-icon icon-green">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div>
          <h1 class="mv-title">Import de données</h1>
          <p class="mv-sub">Importer des actifs, tickets et coûts depuis des fichiers CSV</p>
        </div>
      </div>
      <div class="mv-actions" v-if="result">
        <button class="btn-secondary" @click="reset">Nouvel import</button>
      </div>
    </div>

    <!-- ── Sélection fichiers (si pas encore importé) ── -->
    <div v-if="!result" class="files-section">
      <div class="files-grid">

        <!-- Feuille 1 : Assets -->
        <div class="file-card" :class="{ 'file-loaded': sheet1 }">
          <div class="file-card-header">
            <div class="file-icon icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/></svg>
            </div>
            <div>
              <p class="file-label">Feuille 1 — Actifs <span class="required">*</span></p>
              <p class="file-desc">Name, Status, Location, Manufacturer, Item_Type, Model, Inventory_Number, User</p>
            </div>
          </div>
          <label class="file-drop">
            <input type="file" accept=".csv" @change="e => onFileChange(e, 'sheet1')" />
            <span v-if="sheet1" class="file-name">{{ sheet1.name }}</span>
            <span v-else>Choisir le fichier CSV</span>
          </label>
        </div>

        <!-- Feuille 2 : Tickets -->
        <div class="file-card" :class="{ 'file-loaded': sheet2 }">
          <div class="file-card-header">
            <div class="file-icon icon-orange">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
            </div>
            <div>
              <p class="file-label">Feuille 2 — Tickets <span class="required">*</span></p>
              <p class="file-desc">Ref_Ticket, Date, Heure, Type, Titre, Description, Status, Priority, Items</p>
            </div>
          </div>
          <label class="file-drop">
            <input type="file" accept=".csv" @change="e => onFileChange(e, 'sheet2')" />
            <span v-if="sheet2" class="file-name">{{ sheet2.name }}</span>
            <span v-else>Choisir le fichier CSV</span>
          </label>
        </div>

        <!-- Feuille 3 : Coûts -->
        <div class="file-card" :class="{ 'file-loaded': sheet3 }">
          <div class="file-card-header">
            <div class="file-icon icon-purple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 0 0 4H8"/><path d="M12 18v2m0-18v2"/></svg>
            </div>
            <div>
              <p class="file-label">Feuille 3 — Coûts <span class="required">*</span></p>
              <p class="file-desc">Num_Ticket, Duration_second, Time_Cost, Fixed_Cost</p>
            </div>
          </div>
          <label class="file-drop">
            <input type="file" accept=".csv" @change="e => onFileChange(e, 'sheet3')" />
            <span v-if="sheet3" class="file-name">{{ sheet3.name }}</span>
            <span v-else>Choisir le fichier CSV</span>
          </label>
        </div>

        <!-- Photos ZIP (optionnel) -->
        <div class="file-card" :class="{ 'file-loaded': photosZip }">
          <div class="file-card-header">
            <div class="file-icon icon-cyan">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
            <div>
              <p class="file-label">Photos <span class="optional">(optionnel)</span></p>
              <p class="file-desc">ZIP contenant les photos nommées par Name de l'actif (ex: PC-ADM-001.jpg)</p>
            </div>
          </div>
          <label class="file-drop">
            <input type="file" accept=".zip" @change="e => onFileChange(e, 'photos')" />
            <span v-if="photosZip" class="file-name">{{ photosZip.name }}</span>
            <span v-else>Choisir le fichier ZIP</span>
          </label>
        </div>

      </div>

      <!-- Bouton lancer -->
      <div class="import-action">
        <button class="btn-import" :disabled="!canImport" @click="runImport">
          <svg v-if="importing" class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          {{ importing ? 'Import en cours...' : 'Lancer l\'import' }}
        </button>
        <p class="import-hint" v-if="!canImport && !importing">Les 3 fichiers CSV sont obligatoires</p>
      </div>

      <!-- Barre de progression -->
      <div v-if="importing" class="progress-section">
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" :style="{ width: progress + '%' }"></div>
        </div>
        <p class="progress-label">{{ progressMsg }} ({{ progress }}%)</p>
      </div>
    </div>

    <!-- ── Résultats ── -->
    <div v-if="result" class="results-section">

      <!-- Bandeau succès / rollback / avertissement -->
      <div class="result-banner" :class="result.success ? 'banner-success' : result.rolledBack ? 'banner-error' : 'banner-warning'">
        <svg v-if="result.success" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span v-if="result.success">Import terminé avec succès</span>
        <span v-else-if="result.rolledBack">Import annulé — des erreurs ont été détectées, les données ont été réinitialisées</span>
        <span v-else>Import terminé avec des avertissements</span>
      </div>

      <!-- Statistiques -->
      <div class="stats-grid">
        <!-- Ajoutez cette carte dans stats-grid -->
        <div class="stat-card">
        <p class="stat-title">Utilisateurs</p>
        <div class="stat-row"><span>Total traités</span><strong>{{ result.stats.users.total }}</strong></div>
        <div class="stat-row success"><span>Créés</span><strong>{{ result.stats.users.created }}</strong></div>
        <div class="stat-row error" v-if="result.stats.users.errors"><span>Erreurs</span><strong>{{ result.stats.users.errors }}</strong></div>
        </div>
        
        <div class="stat-card">
          <p class="stat-title">Actifs</p>
          <div class="stat-row"><span>Total</span><strong>{{ result.stats.assets.total }}</strong></div>
          <div class="stat-row success"><span>Créés</span><strong>{{ result.stats.assets.created }}</strong></div>
          <div class="stat-row muted"><span>Ignorés</span><strong>{{ result.stats.assets.skipped }}</strong></div>
          <div class="stat-row error" v-if="result.stats.assets.errors"><span>Erreurs</span><strong>{{ result.stats.assets.errors }}</strong></div>
        </div>
        <div class="stat-card">
          <p class="stat-title">Tickets</p>
          <div class="stat-row"><span>Total</span><strong>{{ result.stats.tickets.total }}</strong></div>
          <div class="stat-row success"><span>Créés</span><strong>{{ result.stats.tickets.created }}</strong></div>
          <div class="stat-row muted"><span>Ignorés</span><strong>{{ result.stats.tickets.skipped }}</strong></div>
          <div class="stat-row error" v-if="result.stats.tickets.errors"><span>Erreurs</span><strong>{{ result.stats.tickets.errors }}</strong></div>
        </div>
        <div class="stat-card">
          <p class="stat-title">Coûts</p>
          <div class="stat-row"><span>Total</span><strong>{{ result.stats.costs.total }}</strong></div>
          <div class="stat-row success"><span>Créés</span><strong>{{ result.stats.costs.created }}</strong></div>
          <div class="stat-row error" v-if="result.stats.costs.errors"><span>Erreurs</span><strong>{{ result.stats.costs.errors }}</strong></div>
        </div>
        <div class="stat-card" v-if="result.stats.photos.total > 0">
          <p class="stat-title">Photos</p>
          <div class="stat-row"><span>Total</span><strong>{{ result.stats.photos.total }}</strong></div>
          <div class="stat-row success"><span>Uploadées</span><strong>{{ result.stats.photos.uploaded }}</strong></div>
          <div class="stat-row error" v-if="result.stats.photos.errors"><span>Erreurs</span><strong>{{ result.stats.photos.errors }}</strong></div>
        </div>
      </div>

      <!-- Journal -->
      <div class="log-section">
        <div class="log-header">
          <h3>Journal d'import</h3>
          <div class="log-filters">
            <button
              v-for="f in (['all','success','warning','error'] as const)"
              :key="f"
              class="log-filter-btn"
              :class="{ active: logFilter === f }"
              @click="logFilter = f"
            >
              {{ f === 'all' ? 'Tous' : f === 'success' ? 'Succès' : f === 'warning' ? 'Alertes' : 'Erreurs' }}
              <span class="log-count">{{ logCounts[f] }}</span>
            </button>
          </div>
        </div>
        <div class="log-body">
          <div
            v-for="(entry, i) in filteredLogs"
            :key="i"
            class="log-entry"
            :class="logClass(entry.level)"
          >
            <span class="log-icon">{{ logIcon(entry.level) }}</span>
            <span class="log-msg">
              {{ entry.message }}
              <pre v-if="entry.details" class="log-details">{{ formatDetails(entry.details) }}</pre>
            </span>
          </div>
          <div v-if="filteredLogs.length === 0" class="log-empty">Aucune entrée pour ce filtre</div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
@import '@/styles/tsanta/ImportView.css';
</style>