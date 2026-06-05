<template>
  <div class="module-view animate-in">
    <div class="mv-header">
      <div class="mv-title-wrap">
        <div class="mv-icon icon-cyan">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <div>
          <h1 class="mv-title">Entités</h1>
          <p class="mv-sub">Organisations & Hiérarchie — <code>GET /Entity</code></p>
        </div>
      </div>
      <button class="btn-fetch btn-cyan" @click="load" :disabled="loading">
        <svg v-if="loading" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        {{ loading ? 'Chargement...' : 'Charger depuis GLPI' }}
      </button>
    </div>
    <div class="empty-module">
      <div class="em-icon icon-cyan">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
      </div>
      <h2>Entités GLPI</h2>
      <p>Structure organisationnelle hiérarchique. La fonction <code>buildEntityTree()</code> reconstruit l'arbre parent/enfant.</p>
      <div class="model-fields">
        <h3>Modèle <code>Entity</code></h3>
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
  { name: 'name',     type: 'string',  desc: 'Nom de l\'entité' },
  { name: 'parentId', type: 'number',  desc: '0 = entité racine' },
  { name: 'fullPath', type: 'string?', desc: 'Chemin complet hiérarchique' },
  { name: 'level',    type: 'number?', desc: 'Niveau dans l\'arbre' },
  { name: 'town',     type: 'string?', desc: 'Ville' },
  { name: 'country',  type: 'string?', desc: 'Pays' },
  { name: 'email',    type: 'string?', desc: 'Email de contact' },
  { name: 'isDeleted',type: 'boolean', desc: 'Soft delete' },
]
async function load() { loading.value = true; await new Promise(r => setTimeout(r, 1000)); loading.value = false }
</script>
<style scoped>@import '../../styles/module.css';</style>
