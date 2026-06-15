# Comment manipuler les dialogues du Kanban

## Les 3 dialogues existants

| Dialog | Ref de contrôle | S'ouvre quand |
|--------|-----------------|---------------|
| **Terminé** | `showDialog` | Ticket glissé vers "Terminé" |
| **Réouverture** | `showCancelDialog` | Ticket glissé de "Terminé" → "En cours" |
| **Détail ticket** | `selectedTicket` | Clic sur une carte |

---

## Anatomie d'un dialogue

Tous les dialogues suivent la même structure dans le template :

```vue
<Teleport to="body">                           <!-- injecté dans <body>, hors du DOM Vue -->
  <Transition name="modal">                    <!-- animation d'ouverture/fermeture -->
    <div v-if="showDialog"                     <!-- ref boolean qui contrôle l'affichage -->
         class="modal-overlay"
         @click.self="cancelDialog">           <!-- clic sur le fond sombre = fermer -->
      <div class="dialog-card">

        <!-- Icône (optionnel) -->
        <div class="dialog-icon">...</div>

        <!-- Titre + sous-titre -->
        <h3 class="dialog-title">Titre</h3>
        <p class="dialog-sub">Description</p>

        <!-- Champs du formulaire -->
        <div class="dialog-field">
          <label>Mon champ</label>
          <input v-model="maValeur" type="text" />
        </div>

        <!-- Boutons d'action -->
        <div class="dialog-actions">
          <button class="btn-ghost" @click="cancelDialog">Annuler</button>
          <button class="btn-confirm" @click="confirmDialog">Confirmer</button>
        </div>

      </div>
    </div>
  </Transition>
</Teleport>
```

---

## Dialog 1 — "Terminé" (showDialog)

### Refs associées

```ts
const showDialog         = ref(false)
const dialogTicket       = ref<Ticket | null>(null)   // ticket concerné
const dialogStatus       = ref(5)                      // statut cible
const resolutionNote     = ref('')                     // textarea
const dialogCost         = ref<number | ''>('')        // input coût
const dialogItems        = ref<any[]>([])              // actifs liés (GLPI)
const loadingDialogItems = ref(false)
```

### Ouvrir le dialog

```ts
// Appelé dans onDrop() quand col.needsDialog === true
async function openStatusDialog(ticket: Ticket, status: number) {
  dialogTicket.value   = ticket
  dialogStatus.value   = status
  resolutionNote.value = ''
  dialogCost.value     = ''
  dialogItems.value    = []
  showDialog.value     = true                          // ← ouvre le dialog
  loadingDialogItems.value = true
  try {
    dialogItems.value = (await fetchTicketItems(ticket.id)) || []
  } finally {
    loadingDialogItems.value = false
  }
}
```

### Fermer sans action

```ts
function cancelDialog() {
  showDialog.value   = false
  dialogTicket.value = null
}
```

### Confirmer (action)

```ts
async function confirmDialog() {
  if (!dialogTicket.value) return
  const ticket = dialogTicket.value

  // 1. Changer le statut dans GLPI
  await applyStatusChange(ticket, dialogStatus.value, resolutionNote.value)

  // 2. Enregistrer le coût dans SQLite
  const cost = Number(dialogCost.value)
  if (cost > 0) {
    const types = dialogItems.value.map((i: any) => i.itemtype).filter(Boolean)
    await saveTicketCost({
      ticketId:    ticket.id,
      ticketTitle: ticket.title,
      fixedCost:   cost,
      itemCount:   types.length || 1,
      itemTypes:   JSON.stringify(types),
      source:      'kanban',
    })
  }

  showDialog.value   = false
  dialogTicket.value = null
}
```

---

## Dialog 2 — "Réouverture" (showCancelDialog)

### Refs associées

```ts
const showCancelDialog   = ref(false)
const cancelDialogTicket = ref<Ticket | null>(null)
const cancelCostBase     = ref(0)           // dernier coût SQLite
const cancelCostLoading  = ref(false)
const cancelDialogItems  = ref<any[]>([])
const reopenPct          = ref<number | ''>(10)   // input %

const reopenCost = computed(() => {           // coût calculé automatiquement
  const pct = Number(reopenPct.value)
  if (!pct || !cancelCostBase.value) return 0
  return Math.round(cancelCostBase.value * pct / 100 * 100) / 100
})
```

### 3 boutons et leurs actions

| Bouton | Fonction | Ce qu'elle fait |
|--------|----------|-----------------|
| **Fermer** | `dismissCancelDialog()` | Ferme, rien ne change |
| **Annuler — supprimer le coût** | `annulerFermeture()` | Statut → En cours + supprime dernier coût SQLite |
| **Réouverture +X%** | `confirmCancelDialog()` | Statut → En cours + ajoute coût `source:'reopen'` |

---

## Dialog 3 — Détail ticket (selectedTicket)

### Contrôlé par un ref objet (pas un boolean)

```ts
const selectedTicket = ref<Ticket | null>(null)   // null = fermé

// Ouvrir
async function openDetail(ticket: Ticket) {
  selectedTicket.value = ticket    // ← ouvre le modal
  linkedItems.value    = []
  loadingItems.value   = true
  try {
    linkedItems.value = (await fetchTicketItems(ticket.id)) || []
  } finally {
    loadingItems.value = false
  }
}

// Fermer
function closeDetail() {
  selectedTicket.value = null    // ← ferme le modal
}
```

Dans le template : `v-if="selectedTicket"` (truthy si objet, falsy si null).

---

## Ajouter un champ à un dialogue existant

### Exemple : ajouter un champ "Technicien" au dialog "Terminé"

**Étape 1 — Ajouter le ref dans le script**

```ts
// Ligne ~165, après les autres refs du dialog
const dialogTechnicien = ref('')
```

**Étape 2 — Réinitialiser à l'ouverture (dans openStatusDialog)**

```ts
async function openStatusDialog(ticket: Ticket, status: number) {
  // ...
  dialogTechnicien.value = ''    // ← ajouter ici
  showDialog.value = true
}
```

**Étape 3 — Utiliser la valeur dans confirmDialog**

```ts
async function confirmDialog() {
  // ...
  console.log('[Dialog] Technicien :', dialogTechnicien.value)
  // Tu peux l'envoyer à l'API ici
}
```

**Étape 4 — Ajouter le champ dans le template**

```vue
<!-- Dans le dialog "Terminé", après le champ "Coût fixe" (~ligne 662) -->
<div class="dialog-field">
  <label>Technicien</label>
  <input
    v-model="dialogTechnicien"
    type="text"
    placeholder="Nom du technicien"
  />
</div>
```

---

## Créer un nouveau dialogue de zéro

### Étape 1 — Les refs de contrôle (dans `<script setup>`)

```ts
// Contrôle l'affichage
const showMonDialog  = ref(false)
const monDialogTicket = ref<Ticket | null>(null)

// Données du formulaire
const monChamp = ref('')

// Ouvrir
function openMonDialog(ticket: Ticket) {
  monDialogTicket.value = ticket
  monChamp.value        = ''
  showMonDialog.value   = true
}

// Fermer sans action
function fermerMonDialog() {
  showMonDialog.value   = false
  monDialogTicket.value = null
}

// Confirmer
async function confirmerMonDialog() {
  if (!monDialogTicket.value) return
  console.log('[MonDialog] Ticket :', monDialogTicket.value.id, '| Champ :', monChamp.value)
  // → appel API ici
  fermerMonDialog()
}
```

### Étape 2 — Le template (copier-coller à la fin avant `</template>`)

```vue
<Teleport to="body">
  <Transition name="modal">
    <div v-if="showMonDialog" class="modal-overlay" @click.self="fermerMonDialog">
      <div class="dialog-card">

        <h3 class="dialog-title">Mon titre</h3>
        <p class="dialog-sub">Ticket #{{ monDialogTicket?.id }}</p>

        <div class="dialog-field">
          <label>Mon champ</label>
          <input v-model="monChamp" type="text" placeholder="Saisir..." />
        </div>

        <div class="dialog-actions">
          <button class="btn-ghost"   @click="fermerMonDialog">Annuler</button>
          <button class="btn-confirm" @click="confirmerMonDialog">Confirmer</button>
        </div>

      </div>
    </div>
  </Transition>
</Teleport>
```

### Étape 3 — Déclencher l'ouverture

```ts
// Dans onDrop() par exemple, selon la colonne cible
function onDrop(e: DragEvent, col: typeof COLUMNS[number]) {
  // ...
  if (col.id === 'maColonne') {
    openMonDialog(ticket)       // ← ouvre ton dialog
  }
}

// Ou au clic sur un bouton
// @click="openMonDialog(ticket)"
```

---

## Points clés à retenir

| Concept | Explication |
|---------|-------------|
| `Teleport to="body"` | Le dialog est rendu dans `<body>` pour éviter les problèmes de z-index |
| `Transition name="modal"` | Ajoute une animation CSS à l'ouverture/fermeture |
| `@click.self="fermer"` | Ferme uniquement si on clique sur l'overlay (pas sur la card) |
| `v-if="showDialog"` | Boolean pour les dialogs simples |
| `v-if="selectedTicket"` | Objet nullable pour le modal détail |
| Toujours réinitialiser les refs à l'ouverture | Évite d'afficher les données du ticket précédent |
| Fermer avant l'action async | `showDialog.value = false` en premier pour une UI réactive |
