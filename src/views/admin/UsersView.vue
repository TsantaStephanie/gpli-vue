<template>
  <div class="module-view animate-in">
    <div class="mv-header">
      <div class="mv-title-wrap">
        <div class="mv-icon icon-purple">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div>
          <h1 class="mv-title">Utilisateurs</h1>
          <p class="mv-sub">Comptes & Rôles — <code>GET /User</code></p>
        </div>
      </div>
      <button class="btn-fetch btn-purple" @click="load" :disabled="loading">
        <svg v-if="loading" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        {{ loading ? 'Chargement...' : 'Charger depuis GLPI' }}
      </button>
    </div>
    <div class="empty-module">
      <div class="em-icon icon-purple">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </div>
      <h2>Utilisateurs GLPI</h2>
      <p>Comptes utilisateurs, techniciens, groupes et rôles (profils) GLPI.</p>
      <div class="model-fields">
        <h3>Modèle <code>User</code></h3>
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
  { name: 'id',        type: 'number',  desc: 'Identifiant unique' },
  { name: 'username',  type: 'string',  desc: 'Login GLPI' },
  { name: 'firstname', type: 'string',  desc: 'Prénom' },
  { name: 'lastname',  type: 'string',  desc: 'Nom' },
  { name: 'email',     type: 'string',  desc: 'Adresse e-mail' },
  { name: 'entityId',  type: 'number',  desc: 'Entité principale' },
  { name: 'profileId', type: 'number',  desc: 'Profil / rôle' },
  { name: 'groupId',   type: 'number?', desc: 'Groupe d\'appartenance' },
  { name: 'isActive',  type: 'boolean', desc: 'Compte actif' },
  { name: 'isDeleted', type: 'boolean', desc: 'Soft delete' },
]
async function load() { loading.value = true; await new Promise(r => setTimeout(r, 1000)); loading.value = false }
</script>
<style scoped>@import '../../styles/module.css';</style>
