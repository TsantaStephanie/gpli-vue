<script setup lang="ts">
import { ref, computed } from 'vue'
import { importService, type ImportResult, type ImportLogEntry } from '@/services/import/importService'

const sheet1    = ref<File | null>(null)
const sheet2    = ref<File | null>(null)
const sheet3    = ref<File | null>(null)
const photosZip = ref<File | null>(null)

const importing   = ref(false)
const progress    = ref(0)
const progressMsg = ref('')
const result      = ref<ImportResult | null>(null)
const logFilter   = ref<'all' | 'error' | 'warning' | 'success'>('all')

// ─── Phases ───────────────────────────────────────────────────────────────────
const PHASES = [
  { key: 'read',    label: 'Lecture',  from: 0,  to: 10  },
  { key: 'assets',  label: 'Actifs',   from: 10, to: 50  },
  { key: 'tickets', label: 'Tickets',  from: 50, to: 75  },
  { key: 'costs',   label: 'Coûts',    from: 75, to: 85  },
  { key: 'photos',  label: 'Photos',   from: 85, to: 100 },
] as const

const phases = computed(() =>
  PHASES.map(p => ({
    ...p,
    status: (progress.value >= p.to   ? 'done'
            : progress.value >= p.from ? 'active'
            : 'pending') as 'done' | 'active' | 'pending',
  }))
)

// ─── Computed ─────────────────────────────────────────────────────────────────
const canImport = computed(() =>
  (sheet1.value || sheet2.value || sheet3.value) && !importing.value
)

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

// ─── Timeline résultats ───────────────────────────────────────────────────────
const timelineSteps = computed(() => {
  if (!result.value) return []
  const r = result.value
  return [
    { key: 'users',   label: 'Utilisateurs', total: r.stats.users.total,   created: r.stats.users.created,   skipped: 0,                       errors: r.stats.users.errors },
    { key: 'assets',  label: 'Actifs',        total: r.stats.assets.total,  created: r.stats.assets.created,  skipped: r.stats.assets.skipped,  errors: r.stats.assets.errors },
    { key: 'tickets', label: 'Tickets',       total: r.stats.tickets.total, created: r.stats.tickets.created, skipped: r.stats.tickets.skipped, errors: r.stats.tickets.errors },
    { key: 'costs',   label: 'Coûts',         total: r.stats.costs.total,   created: r.stats.costs.created,   skipped: 0,                       errors: r.stats.costs.errors },
    { key: 'photos',  label: 'Photos',        total: r.stats.photos.total,  created: r.stats.photos.uploaded, skipped: 0,                       errors: r.stats.photos.errors },
  ]
})

function stepStatus(s: { total: number; errors: number }) {
  if (s.total === 0) return 'skipped'
  if (s.errors > 0)  return 'error'
  return 'success'
}

function stepBadge(s: { total: number; errors: number; skipped: number }) {
  if (s.total === 0)   return 'Ignoré'
  if (s.errors > 0)    return 'Erreurs'
  if (s.skipped > 0)   return 'Partiel'
  return 'OK'
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
function onFileChange(event: Event, target: 'sheet1' | 'sheet2' | 'sheet3' | 'photos') {
  const input = event.target as HTMLInputElement
  const file  = input.files?.[0] ?? null
  if (target === 'sheet1')  sheet1.value    = file
  else if (target === 'sheet2')  sheet2.value    = file
  else if (target === 'sheet3')  sheet3.value    = file
  else                           photosZip.value = file
}

async function runImport() {
  if (!sheet1.value && !sheet2.value && !sheet3.value) return
  importing.value = true
  result.value    = null
  progress.value  = 0

  try {
    result.value = await importService.runFullImport(
      sheet1.value, sheet2.value, sheet3.value, photosZip.value,
      (pct, step) => { progress.value = pct; progressMsg.value = step },
    )
  } catch (e: any) {
    result.value = {
      success: false, rolledBack: false,
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
    progress.value  = 100
  }
}

function reset() {
  sheet1.value = null; sheet2.value = null; sheet3.value = null; photosZip.value = null
  result.value = null; progress.value = 0; progressMsg.value = ''
}

function logClass(level: ImportLogEntry['level']) {
  return { 'log-success': level === 'success', 'log-error': level === 'error', 'log-warning': level === 'warning', 'log-info': level === 'info' }
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
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
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

    <!-- ── Sélection fichiers ── -->
    <div v-if="!result && !importing" class="files-section">
      <div class="files-grid">

        <div class="file-card" :class="{ 'file-loaded': sheet1 }">
          <div class="file-card-header">
            <div class="file-icon icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/></svg>
            </div>
            <div>
              <p class="file-label">Feuille 1 — Actifs</p>
              <p class="file-desc">Name, Status, Location, Manufacturer, Item_Type, Model, Inventory_Number, User</p>
            </div>
          </div>
          <label class="file-drop">
            <input type="file" accept=".csv" @change="e => onFileChange(e, 'sheet1')" />
            <span v-if="sheet1" class="file-name">{{ sheet1.name }}</span>
            <span v-else>Choisir le fichier CSV</span>
          </label>
        </div>

        <div class="file-card" :class="{ 'file-loaded': sheet2 }">
          <div class="file-card-header">
            <div class="file-icon icon-orange">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
            </div>
            <div>
              <p class="file-label">Feuille 2 — Tickets</p>
              <p class="file-desc">Ref_Ticket, Date, Heure, Type, Titre, Description, Status, Priority, Items</p>
            </div>
          </div>
          <label class="file-drop">
            <input type="file" accept=".csv" @change="e => onFileChange(e, 'sheet2')" />
            <span v-if="sheet2" class="file-name">{{ sheet2.name }}</span>
            <span v-else>Choisir le fichier CSV</span>
          </label>
        </div>

        <div class="file-card" :class="{ 'file-loaded': sheet3 }">
          <div class="file-card-header">
            <div class="file-icon icon-purple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 0 0 4H8"/><path d="M12 18v2m0-18v2"/></svg>
            </div>
            <div>
              <p class="file-label">Feuille 3 — Coûts</p>
              <p class="file-desc">Num_Ticket, Duration_second, Time_Cost, Fixed_Cost</p>
            </div>
          </div>
          <label class="file-drop">
            <input type="file" accept=".csv" @change="e => onFileChange(e, 'sheet3')" />
            <span v-if="sheet3" class="file-name">{{ sheet3.name }}</span>
            <span v-else>Choisir le fichier CSV</span>
          </label>
        </div>

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

      <div class="import-action">
        <button class="btn-import" :disabled="!canImport" @click="runImport">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Lancer l'import
        </button>
        <p class="import-hint" v-if="!canImport">Fournis au moins un fichier CSV pour lancer l'import</p>
      </div>
    </div>

    <!-- ── Chargement : barre de phases ── -->
    <div v-if="importing" class="phases-progress">

      <div class="phase-steps">
        <template v-for="(phase, i) in phases" :key="phase.key">
          <div class="phase-step" :class="phase.status">
            <div class="phase-node">
              <!-- done -->
              <svg v-if="phase.status === 'done'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              <!-- active -->
              <div v-else-if="phase.status === 'active'" class="phase-pulse"></div>
              <!-- pending -->
              <span v-else class="phase-num">{{ i + 1 }}</span>
            </div>
            <span class="phase-label">{{ phase.label }}</span>
          </div>
          <div v-if="i < phases.length - 1" class="phase-connector"
               :class="{ active: phases[i + 1].status !== 'pending', done: phase.status === 'done' }">
          </div>
        </template>
      </div>

      <div class="phase-bar-wrap">
        <div class="phase-bar-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <p class="phase-msg">{{ progressMsg }} — {{ progress }}%</p>
    </div>

    <!-- ── Résultats : timeline ── -->
    <div v-if="result" class="results-section">

      <!-- Bandeau global -->
      <div class="result-banner" :class="result.success ? 'banner-success' : result.rolledBack ? 'banner-error' : 'banner-warning'">
        <svg v-if="result.success" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span v-if="result.success">Import terminé avec succès</span>
        <span v-else-if="result.rolledBack">Import annulé — erreurs détectées, données réinitialisées</span>
        <span v-else>Import terminé avec des avertissements</span>
      </div>

      <!-- Timeline par étape -->
      <div class="result-timeline">
        <div
          v-for="(step, i) in timelineSteps"
          :key="step.key"
          class="tl-row"
          :class="stepStatus(step)"
        >
          <div class="tl-indicator">
            <div class="tl-dot">
              <svg v-if="stepStatus(step) === 'success'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>
              <svg v-else-if="stepStatus(step) === 'error'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div v-if="i < timelineSteps.length - 1" class="tl-line"></div>
          </div>
          <div class="tl-content">
            <div class="tl-header-row">
              <span class="tl-name">{{ step.label }}</span>
              <span class="tl-badge" :class="'badge-' + stepStatus(step)">{{ stepBadge(step) }}</span>
            </div>
            <div class="tl-stats-row">
              <span class="tl-stat">{{ step.total }} traités</span>
              <span class="tl-stat ok">{{ step.created }} créés</span>
              <span v-if="step.skipped" class="tl-stat muted">{{ step.skipped }} ignorés</span>
              <span v-if="step.errors" class="tl-stat err">{{ step.errors }} erreurs</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Journal d'import -->
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
