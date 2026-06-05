<template>
  <div class="module-view animate-in">
    <div class="mv-header">
      <div class="mv-title-wrap">
        <div class="mv-icon icon-blue">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div>
          <h1 class="mv-title">Actifs</h1>
          <p class="mv-sub">Computers · Monitors · Printers — <code>GET /Computer /Monitor /Printer</code></p>
        </div>
      </div>
      <div class="mv-actions">
        <div class="filter-tabs">
          <button v-for="t in types" :key="t.key" class="tab" :class="{ active: activeType === t.key }" @click="activeType = t.key">{{ t.label }}</button>
        </div>
        <button class="btn-fetch" @click="load" :disabled="loading">
          <svg v-if="loading" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          {{ loading ? 'Chargement...' : 'Charger depuis GLPI' }}
        </button>
      </div>
    </div>

    <!-- Empty / info state -->
    <div class="empty-module">
      <div class="em-icon icon-blue">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      </div>
      <h2>Actifs GLPI</h2>
      <p>Clique sur <strong>Charger depuis GLPI</strong> pour récupérer les ordinateurs, écrans et imprimantes via l'API.</p>
      <div class="model-fields">
        <h3>Modèle <code>Asset</code></h3>
        <div class="fields-grid">
          <div class="field-item" v-for="f in assetFields" :key="f.name">
            <span class="field-name">{{ f.name }}</span>
            <span class="field-type">{{ f.type }}</span>
            <span class="field-desc">{{ f.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const loading = ref(false)
const activeType = ref('all')
const types = [
  { key: 'all',      label: 'Tous' },
  { key: 'computer', label: 'Ordinateurs' },
  { key: 'monitor',  label: 'Écrans' },
  { key: 'printer',  label: 'Imprimantes' },
]

const assetFields = [
  { name: 'id',           type: 'number',    desc: 'Identifiant unique' },
  { name: 'type',         type: 'AssetType', desc: 'computer | monitor | printer' },
  { name: 'name',         type: 'string',    desc: 'Nom de l\'actif' },
  { name: 'serial',       type: 'string?',   desc: 'Numéro de série' },
  { name: 'entityId',     type: 'number',    desc: 'Entité GLPI parente' },
  { name: 'locationId',   type: 'number?',   desc: 'Localisation' },
  { name: 'userId',       type: 'number?',   desc: 'Utilisateur affecté' },
  { name: 'status',       type: 'AssetStatus','desc': '1=En service … 5=Hors service' },
  { name: 'isDeleted',    type: 'boolean',   desc: 'Soft delete GLPI' },
  { name: 'updatedAt',    type: 'string?',   desc: 'Date modification' },
]

async function load() {
  loading.value = true
  // TODO: await fetchAllAssets()
  await new Promise(r => setTimeout(r, 1000))
  loading.value = false
}
</script>

<style scoped>
@import '../../styles/module.css';
</style>
