<template>
  <div class="module-view animate-in">
    <div class="mv-header">
      <div class="mv-title-wrap">
        <div class="mv-icon icon-green">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
        </div>
        <div>
          <h1 class="mv-title">Localisations</h1>
          <p class="mv-sub">Bâtiments, Salles & Sites — <code>GET /Location</code></p>
        </div>
      </div>
      <button class="btn-fetch btn-green" @click="load" :disabled="loading">
        <svg v-if="loading" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        {{ loading ? 'Chargement...' : 'Charger depuis GLPI' }}
      </button>
    </div>
    <div class="empty-module">
      <div class="em-icon icon-green">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
      </div>
      <h2>Localisations GLPI</h2>
      <p>Lieux physiques hiérarchiques : site → bâtiment → salle. Liées aux actifs et aux utilisateurs.</p>
      <div class="model-fields">
        <h3>Modèle <code>Location</code></h3>
        <div class="fields-grid">
          <div class="field-item" v-for="f in fields" :key="f.name">
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
const fields = [
  { name: 'id',       type: 'number',  desc: 'Identifiant unique' },
  { name: 'name',     type: 'string',  desc: 'Nom de la localisation' },
  { name: 'entityId', type: 'number',  desc: 'Entité parente' },
  { name: 'parentId', type: 'number',  desc: 'Localisation parente (0 = racine)' },
  { name: 'fullPath', type: 'string?', desc: 'Ex : Bâtiment A > Salle 101' },
  { name: 'level',    type: 'number?', desc: 'Niveau hiérarchique' },
  { name: 'building', type: 'string?', desc: 'Bâtiment' },
  { name: 'room',     type: 'string?', desc: 'Salle / bureau' },
  { name: 'isDeleted',type: 'boolean', desc: 'Soft delete' },
]
async function load() { loading.value = true; await new Promise(r => setTimeout(r, 1000)); loading.value = false }
</script>
<style scoped>@import '../../styles/module.css';</style>
