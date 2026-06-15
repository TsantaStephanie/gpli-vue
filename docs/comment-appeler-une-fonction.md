# Comment appeler une fonction

## 1. Fonction définie dans le même fichier

```vue
<script setup lang="ts">
function direBonjour(nom: string) {
  console.log('Bonjour', nom)
}

// Appel direct
direBonjour('Alice')
</script>

<template>
  <!-- Appel depuis le template -->
  <button @click="direBonjour('Alice')">Dire bonjour</button>
</template>
```

---

## 2. Fonction importée depuis un service

```ts
// src/services/api/ticketCostService.ts
export async function getAllTicketCosts() {
  const res = await axios.get('/api/ticket-costs')
  return res.data
}
```

```vue
<script setup lang="ts">
// Importer la fonction
import { getAllTicketCosts } from '@/services/api/ticketCostService'

// L'appeler
const couts = await getAllTicketCosts()
</script>
```

---

## 3. Fonction async (avec await)

Toute fonction qui appelle une API doit être `async`.

```ts
async function charger() {
  const data = await getAllTicketCosts()   // attend la réponse
  records.value = data
  console.log('Chargé :', data.length, 'records')
}

// Appel
charger()           // sans await si on ne veut pas bloquer
await charger()     // avec await si on veut attendre la fin
```

---

## 4. Appel au chargement de la page (onMounted)

```vue
<script setup lang="ts">
import { onMounted } from 'vue'

async function charger() {
  // ...
}

// Sera appelée automatiquement quand la page s'affiche
onMounted(charger)

// Ou en inline :
onMounted(async () => {
  const data = await getAllTicketCosts()
  records.value = data
})
</script>
```

---

## 5. Appel depuis le template (événement)

```vue
<template>
  <!-- Au clic -->
  <button @click="charger">Actualiser</button>

  <!-- Au clic avec argument -->
  <button @click="supprimer(ticket.id)">Supprimer</button>

  <!-- Au clic avec événement natif -->
  <button @click="(e) => { e.preventDefault(); charger() }">OK</button>

  <!-- Au changement d'un input -->
  <input @change="onInputChange" />

  <!-- À la saisie en temps réel -->
  <input @input="onInput" />
</template>
```

---

## 6. Appel conditionnel

```ts
async function traiter(ticketId: number) {
  const record = await getLatestTicketCost(ticketId)

  // Appel seulement si la condition est remplie
  if (record && record.fixedCost > 0) {
    await deleteLatestTicketCost(ticketId)
  }
}
```

---

## 7. Appel en parallèle (Promise.all / Promise.allSettled)

```ts
// Les deux fonctions s'exécutent en même temps (plus rapide)
const [resultA, resultB] = await Promise.all([
  getAllTicketCosts(),
  fetchGlpiTicketCosts(),
])

// Avec gestion d'erreur indépendante
const [a, b] = await Promise.allSettled([
  getAllTicketCosts(),
  fetchGlpiTicketCosts(),
])
if (a.status === 'fulfilled') console.log(a.value)
if (b.status === 'rejected')  console.warn('GLPI indisponible')
```

---

## 8. Passer une fonction en paramètre (callback)

```ts
// Définir une fonction qui accepte un callback
async function importData(onProgress: (pct: number, msg: string) => void) {
  onProgress(10, 'Lecture des fichiers...')
  // ...
  onProgress(50, 'Import des actifs...')
}

// L'appeler avec un callback
await importData((pct, msg) => {
  progress.value    = pct
  progressMsg.value = msg
})
```

---

## 9. Gestion d'erreur autour d'un appel

```ts
async function sauvegarder() {
  try {
    await saveTicketCost({ ticketId: 5, fixedCost: 200, ... })
    console.log('[OK] Coût sauvegardé')
  } catch (e) {
    console.warn('[Erreur] Impossible de sauvegarder :', e)
  }
}
```

---

## Récapitulatif rapide

| Quand appeler | Comment |
|---------------|---------|
| À l'ouverture de la page | `onMounted(maFonction)` |
| Au clic d'un bouton | `@click="maFonction"` |
| Au clic avec argument | `@click="maFonction(valeur)"` |
| En parallèle | `await Promise.all([fn1(), fn2()])` |
| Uniquement si condition | `if (condition) await maFonction()` |
| Depuis un autre fichier | `import { maFonction } from '@/services/...'` |
