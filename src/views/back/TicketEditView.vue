<!-- src/views/TicketEditView.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { fetchTicketById, updateTicket, updateTicketStatus, addTicketFollowup, addTicketSolution } from '@/services/api/ticketService';
import type { Ticket } from '@/models/Ticket';

const router = useRouter();
const route = useRoute();
const ticketId = Number(route.params.id);

const loading = ref(true);
const submitting = ref(false);
const error = ref('');
const success = ref('');
const ticket = ref<Ticket | null>(null);

// Formulaire de modification
const form = ref({
  name: '',
  content: '',
  type: 1 as 1 | 2,
  status: 1,
  priority: 3,
});

// Suivi et solution
const followupContent = ref('');
const solutionContent = ref('');
const isPrivate = ref(false);

onMounted(async () => {
  await loadTicket();
});

async function loadTicket() {
  loading.value = true;
  try {
    ticket.value = await fetchTicketById(ticketId);
    form.value = {
      name: ticket.value.title,
      content: ticket.value.description,
      type: ticket.value.type,
      status: ticket.value.status,
      priority: ticket.value.priority,
    };
  } catch (err: any) {
    error.value = err.message || 'Erreur lors du chargement du ticket';
  } finally {
    loading.value = false;
  }
}

async function saveTicket() {
  if (!form.value.name || !form.value.content) {
    error.value = 'Veuillez remplir le titre et la description';
    return;
  }
  
  submitting.value = true;
  error.value = '';
  success.value = '';
  
  try {
    await updateTicket(ticketId, {
      name: form.value.name,
      content: form.value.content,
      type: form.value.type,
      status: form.value.status,
      priority: form.value.priority,
    });
    
    success.value = 'Ticket mis à jour avec succès';
    
    // Recharger le ticket
    await loadTicket();
    
    // Rediriger après 1.5 secondes
    setTimeout(() => {
      router.push(`/tickets/${ticketId}`);
    }, 1500);
  } catch (err: any) {
    error.value = err.message || 'Erreur lors de la mise à jour';
  } finally {
    submitting.value = false;
  }
}

async function changeStatus(newStatus: number) {
  submitting.value = true;
  error.value = '';
  
  try {
    await updateTicketStatus(ticketId, newStatus);
    form.value.status = newStatus;
    success.value = `Statut mis à jour vers ${getStatusLabel(newStatus)}`;
    
    // Recharger le ticket
    await loadTicket();
  } catch (err: any) {
    error.value = err.message || 'Erreur lors du changement de statut';
  } finally {
    submitting.value = false;
  }
}

async function addFollowup() {
  if (!followupContent.value.trim()) {
    error.value = 'Veuillez saisir un message';
    return;
  }
  
  submitting.value = true;
  error.value = '';
  
  try {
    await addTicketFollowup(ticketId, followupContent.value, isPrivate.value);
    followupContent.value = '';
    success.value = 'Suivi ajouté avec succès';
    
    // Recharger le ticket
    await loadTicket();
  } catch (err: any) {
    error.value = err.message || 'Erreur lors de l\'ajout du suivi';
  } finally {
    submitting.value = false;
  }
}

async function resolveTicket() {
  if (!solutionContent.value.trim()) {
    error.value = 'Veuillez saisir la solution';
    return;
  }
  
  submitting.value = true;
  error.value = '';
  
  try {
    await addTicketSolution(ticketId, solutionContent.value);
    solutionContent.value = '';
    success.value = 'Ticket résolu avec succès';
    
    // Recharger le ticket
    await loadTicket();
  } catch (err: any) {
    error.value = err.message || 'Erreur lors de la résolution';
  } finally {
    submitting.value = false;
  }
}

function getStatusLabel(status: number): string {
  const labels: Record<number, string> = {
    1: 'Nouveau', 2: 'En cours', 3: 'Planifié', 4: 'En attente', 5: 'Résolu', 6: 'Fermé'
  };
  return labels[status] || 'Inconnu';
}

function getPriorityLabel(priority: number): string {
  const labels: Record<number, string> = {
    1: 'Très basse', 2: 'Basse', 3: 'Moyenne', 4: 'Haute', 5: 'Très haute', 6: 'Majeure'
  };
  return labels[priority] || 'Moyenne';
}

function goBack() {
  router.push(`/tickets/${ticketId}`);
}
</script>

<template>
  <div class="module-view animate-in">
    <div class="mv-header">
      <div class="mv-title-wrap">
        <div class="mv-icon icon-orange">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path d="M16 13H8M16 17H8M10 9H8"/>
          </svg>
        </div>
        <div>
          <h1 class="mv-title">Modifier le ticket #{{ ticketId }}</h1>
          <p class="mv-sub">Mettre à jour les informations du ticket</p>
        </div>
      </div>
      <div class="mv-actions">
        <button class="btn-secondary" @click="goBack" :disabled="submitting">Annuler</button>
        <button class="btn-primary" @click="saveTicket" :disabled="submitting || loading">
          {{ submitting ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div v-if="error" class="alert-error">{{ error }}</div>
    <div v-if="success" class="alert-success">{{ success }}</div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Chargement du ticket...</p>
    </div>

    <div v-else-if="ticket" class="edit-layout">
      <!-- Formulaire principal -->
      <div class="form-section card">
        <h3>Informations générales</h3>
        
        <div class="form-group">
          <label>Titre *</label>
          <input type="text" v-model="form.name" placeholder="Titre du ticket" />
        </div>
        
        <div class="form-group">
          <label>Description *</label>
          <textarea v-model="form.content" rows="6" placeholder="Description détaillée..."></textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Type</label>
            <select v-model="form.type">
              <option :value="1">Incident</option>
              <option :value="2">Demande</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Priorité</label>
            <select v-model="form.priority">
              <option :value="1">Très basse</option>
              <option :value="2">Basse</option>
              <option :value="3">Moyenne</option>
              <option :value="4">Haute</option>
              <option :value="5">Très haute</option>
              <option :value="6">Majeure</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Statut</label>
            <select v-model="form.status">
              <option :value="1">Nouveau</option>
              <option :value="2">En cours</option>
              <option :value="3">Planifié</option>
              <option :value="4">En attente</option>
              <option :value="5">Résolu</option>
              <option :value="6">Fermé</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Changement rapide de statut -->
      <div class="status-section card">
        <h3>Changement rapide de statut</h3>
        <div class="status-buttons">
          <button 
            v-for="s in [1,2,3,4,5,6]" 
            :key="s"
            class="status-btn"
            :class="{ active: form.status === s }"
            @click="changeStatus(s)"
            :disabled="submitting"
          >
            {{ getStatusLabel(s) }}
          </button>
        </div>
      </div>

      <!-- Ajouter un suivi -->
      <div class="followup-section card">
        <h3>Ajouter un suivi</h3>
        <div class="form-group">
          <textarea v-model="followupContent" rows="3" placeholder="Message de suivi..."></textarea>
        </div>
        <div class="form-group checkbox">
          <label>
            <input type="checkbox" v-model="isPrivate" />
            Suivi privé (visible uniquement par les techniciens)
          </label>
        </div>
        <button class="btn-secondary" @click="addFollowup" :disabled="submitting || !followupContent.trim()">
          Ajouter le suivi
        </button>
      </div>

      <!-- Résoudre le ticket -->
      <div class="solution-section card" v-if="form.status !== 5 && form.status !== 6">
        <h3>Résoudre le ticket</h3>
        <div class="form-group">
          <textarea v-model="solutionContent" rows="3" placeholder="Description de la solution apportée..."></textarea>
        </div>
        <button class="btn-success" @click="resolveTicket" :disabled="submitting || !solutionContent.trim()">
          Marquer comme résolu
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../../styles/module.css';


</style>