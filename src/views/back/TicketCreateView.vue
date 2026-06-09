<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { createTicket, associateItemToTicket } from '@/services/api/ticketService';
import { fetchAllAssets } from '@/services/api/assetService';
import type { Asset } from '@/models/Asset';

const router = useRouter();

const form = ref({
  name: '',
  content: '',
  type: 1 as 1 | 2, // 1=Incident, 2=Demande
  priority: 3,
});

const assets = ref<Asset[]>([]);
const selectedAssets = ref<Set<string>>(new Set());
const loading = ref(false);
const submitting = ref(false);
const error = ref('');

onMounted(async () => {
  loading.value = true;
  try {
    assets.value = await fetchAllAssets();
  } catch (err: any) {
    error.value = "Erreur lors du chargement des éléments.";
  } finally {
    loading.value = false;
  }
});

const toggleAssetSelection = (asset: Asset) => {
  const key = `${asset.itemtype}-${asset.id}`;
  if (selectedAssets.value.has(key)) {
    selectedAssets.value.delete(key);
  } else {
    selectedAssets.value.add(key);
  }
};

const submitTicket = async () => {
  if (!form.value.name || !form.value.content) {
    error.value = "Veuillez remplir le titre et la description.";
    return;
  }
  submitting.value = true;
  error.value = '';

  try {
    const ticketRes = await createTicket({
      name: form.value.name,
      content: form.value.content,
      type: form.value.type,
      priority: form.value.priority,
    });

    const ticketId = ticketRes.id;

    // Associer les éléments
    const associationPromises = Array.from(selectedAssets.value).map(key => {
      const [itemtype, idStr] = key.split('-');
      const id = parseInt(idStr, 10);
      return associateItemToTicket(ticketId, itemtype, id);
    });

    await Promise.all(associationPromises);

    // Vérification: relire le ticket et ses éléments pour valider le contexte métier (droits)
    try {
      const { fetchTicketById, fetchTicketItems } = await import('@/services/api/ticketService');
      const verifiedTicket = await fetchTicketById(ticketId);
      console.log('[GLPI] Ticket vérifié après création :', verifiedTicket);
      const verifiedItems = await fetchTicketItems(ticketId);
      console.log('[GLPI] Items liés vérifiés :', verifiedItems);
    } catch (verifyErr) {
      console.warn("[GLPI] Le ticket a été créé mais pourrait ne pas être visible avec vos droits actuels.", verifyErr);
    }
    
    // Rediriger vers la liste des tickets
    router.push('/tickets');
  } catch (err: any) {
    error.value = err.message || "Erreur de création du ticket.";
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="module-view animate-in">
    <div class="mv-header">
      <div class="mv-title-wrap">
        <div class="mv-icon icon-orange">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        </div>
        <div>
          <h1 class="mv-title">Nouveau Ticket</h1>
          <p class="mv-sub">Déclarer un incident ou faire une demande</p>
        </div>
      </div>
      <div class="mv-actions">
        <button class="btn-secondary" @click="router.push('/tickets')" :disabled="submitting">Annuler</button>
        <button class="btn-primary" @click="submitTicket" :disabled="submitting || !form.name || !form.content">
          {{ submitting ? 'Création...' : 'Valider le ticket' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="alert-error">{{ error }}</div>

    <div class="split-layout">
      <div class="form-section card">
        <h3>Informations</h3>
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
          <label>Titre</label>
          <input type="text" v-model="form.name" placeholder="Titre du ticket" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea v-model="form.content" rows="6" placeholder="Détails..."></textarea>
        </div>
      </div>

      <div class="assets-section card">
        <h3>Lier des éléments ({{ selectedAssets.size }})</h3>
        <div v-if="loading" class="state-msg">Chargement des équipements...</div>
        <div v-else class="assets-list">
          <div 
            v-for="asset in assets" :key="asset.itemtype + asset.id"
            class="asset-item"
            :class="{ selected: selectedAssets.has(`${asset.itemtype}-${asset.id}`) }"
            @click="toggleAssetSelection(asset)"
          >
            <input type="checkbox" :checked="selectedAssets.has(`${asset.itemtype}-${asset.id}`)" readonly />
            <div class="asset-info">
              <span class="asset-name">{{ asset.name }}</span>
              <span class="asset-meta">{{ asset.itemtype }} #{{ asset.id }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '@/styles/tsanta/module.css';
</style>
