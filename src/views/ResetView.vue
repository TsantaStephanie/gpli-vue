<template>
  <div class="reset-view">
    <h1>Réinitialiser la base de données</h1>
    <button @click="confirmReset" :disabled="isResetting">
      {{ isResetting ? 'Réinitialisation en cours...' : 'Lancer la réinitialisation' }}
    </button>

    <div v-if="results.length > 0" class="results">
      <h2>Résultats de la réinitialisation :</h2>
      <ul>
        <li v-for="result in results" :key="result.itemtype" :class="{ success: result.success, error: !result.success }">
          <strong>{{ result.itemtype }}:</strong> 
          <span v-if="result.success">Supprimé avec succès</span>
          <span v-else>Échec de la suppression ({{ result.error?.message || 'Erreur inconnue' }})</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { resetService } from '@/services/api/resetService';

interface ResetResult {
  itemtype: string;
  success: boolean;
  data?: any;
  error?: any;
}

export default defineComponent({
  name: 'ResetView',
  setup() {
    const isResetting = ref(false);
    const results = ref<ResetResult[]>([]);

    const confirmReset = () => {
      if (window.confirm("Êtes-vous sûr de vouloir réinitialiser la base de données ? Cette action est irréversible.")) {
        handleReset();
      }
    };

    const handleReset = async () => {
      isResetting.value = true;
      results.value = [];
      const resetResults = await resetService.resetDatabase();
      results.value = resetResults;
      isResetting.value = false;
    };

    return {
      isResetting,
      results,
      confirmReset,
    };
  },
});
</script>

<style scoped>
.reset-view {
  padding: 2rem;
  text-align: center;
}

.warning {
  color: #d9534f;
  background-color: #f2dede;
  border: 1px solid #ebccd1;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
}

button {
  background-color: #d9534f;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  font-size: 1rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.3s;
}

button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #c9302c;
}

.results {
  margin-top: 2rem;
  text-align: left;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.results ul {
  list-style-type: none;
  padding: 0;
}

.results li {
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
}

.results li.success {
  color: #5cb85c;
}

.results li.error {
  color: #d9534f;
}
</style>
