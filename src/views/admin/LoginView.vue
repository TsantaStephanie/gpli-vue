<template>
  <div class="login-page">
    <div class="login-bg">
      <div class="bg-blob b1" /><div class="bg-blob b2" /><div class="bg-blob b3" />
    </div>
    <div class="login-card">
      <!-- Logo -->
      <div class="login-brand">
        <div class="login-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
        </div>
        <div class="login-brand-block">
          <span class="login-brand-name">GLPI</span>
        </div>
      </div>

      <h1 class="login-title">Connexion</h1>
      <p class="login-subtitle">Accédez à votre espace de gestion</p>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="field">
          <label for="login-username">Identifiant</label>
          <input
            id="login-username"
            v-model="form.username"
            type="text"
            placeholder="admin"
            autocomplete="username"
            :disabled="loading"
          />
        </div>
        <div class="field">
          <label for="login-password">Mot de passe</label>
          <div class="input-wrap">
            <input
              id="login-password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              autocomplete="current-password"
              :disabled="loading"
            />
            <button type="button" class="eye-btn" @click="showPassword = !showPassword" tabindex="-1">
              <svg v-if="!showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
        </div>

        <div v-if="error" class="error-msg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {{ error }}
        </div>

        <button type="submit" class="btn-login" :disabled="loading || !form.username || !form.password">
          <svg v-if="loading" class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          {{ loading ? 'Connexion en cours...' : 'Se connecter' }}
        </button>
      </form>

      <div class="login-meta">
        <code>{{ apiUrl }}</code>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { initSession } from '@/services/api/glpiClient'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)
const apiUrl = import.meta.env.VITE_GLPI_BASE_URL ?? 'http://glpi.local:8082/apirest.php'

const form = ref({ username: '', password: '' })

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    await initSession()
    router.push('/dashboard')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Identifiants incorrects ou service indisponible'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@import '../../styles/LoginView.css';
</style>
