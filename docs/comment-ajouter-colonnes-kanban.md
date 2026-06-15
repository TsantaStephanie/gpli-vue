# Comment ajouter des colonnes dans le Kanban

## Statuts GLPI disponibles

| Statut | Valeur | Colonne actuelle |
|--------|--------|-----------------|
| Nouveau | `1` | ✅ `'new'` |
| En cours (assigné) | `2` | ✅ `'progress'` |
| En cours (planifié) | `3` | ❌ manquant |
| En attente | `4` | ❌ manquant |
| Résolu | `5` | ❌ manquant |
| Fermé | `6` | ✅ `'done'` |

---

## 3 fichiers à modifier

```
src/views/front/KanbanView.vue        ← COLUMNS + onDrop
src/styles/tsanta/KanbanView.css      ← classes CSS des nouvelles couleurs
```

---

## Étape 1 — Ajouter les colonnes dans COLUMNS (ligne 44)

Remplacer le bloc `COLUMNS` actuel (lignes 44–69) par ceci :

```ts
const COLUMNS = [
  {
    id: 'new',
    label: 'Nouveau',
    statuses: [1] as number[],
    targetStatus: 1,
    color: 'blue',
    needsDialog: false,
  },
  {
    id: 'progress',
    label: 'En cours',
    statuses: [2] as number[],
    targetStatus: 2,
    color: 'orange',
    needsDialog: false,
  },
  {
    id: 'planned',           // ← nouveau
    label: 'Planifié',
    statuses: [3] as number[],
    targetStatus: 3,
    color: 'cyan',
    needsDialog: false,
  },
  {
    id: 'waiting',           // ← nouveau
    label: 'En attente',
    statuses: [4] as number[],
    targetStatus: 4,
    color: 'gray',
    needsDialog: false,
  },
  {
    id: 'resolved',          // ← nouveau
    label: 'Résolu',
    statuses: [5] as number[],
    targetStatus: 5,
    color: 'purple',
    needsDialog: true,       // affiche le dialog coût + note
  },
  {
    id: 'done',
    label: 'Terminé',
    statuses: [6] as number[],
    targetStatus: 6,
    color: 'green',
    needsDialog: true,
  },
] as const
```

---

## Étape 2 — Mettre à jour onDrop (ligne 115)

La ligne actuelle `draggingFromCol.value === 'done' && col.id === 'progress'` est codée en dur.
Il faut la généraliser pour couvrir tous les cas de retour arrière depuis une colonne terminale.

Remplacer `onDrop` (lignes 115–132) par :

```ts
// Colonnes "terminales" : ticket résolu ou fermé
const TERMINAL_COLS = ['resolved', 'done']
// Colonnes "actives" : ticket en cours de traitement
const ACTIVE_COLS   = ['new', 'progress', 'planned', 'waiting']

function onDrop(e: DragEvent, col: typeof COLUMNS[number]) {
  e.preventDefault()
  dragOverCol.value = null
  if (!dragging.value || draggingFromCol.value === col.id) {
    dragging.value = null
    return
  }
  const ticket = dragging.value
  dragging.value = null

  if (col.needsDialog) {
    // → colonne Résolu ou Terminé : dialog coût + note
    openStatusDialog(ticket, col.targetStatus)
  } else if (
    TERMINAL_COLS.includes(draggingFromCol.value!) &&
    ACTIVE_COLS.includes(col.id)
  ) {
    // → retour depuis une colonne terminale vers une colonne active : dialog réouverture
    openCancelDialog(ticket)
  } else {
    // → déplacement normal entre colonnes actives
    applyStatusChange(ticket, col.targetStatus)
  }
}
```

---

## Étape 3 — Ajouter les classes CSS (KanbanView.css)

Ouvrir `src/styles/tsanta/KanbanView.css`.

Les classes existantes (ligne ~156) :
```css
.col-blue   { border-top: 3px solid #3b82f6; }
.col-orange { border-top: 3px solid #f59e0b; }
.col-green  { border-top: 3px solid #22c55e; }
```

Ajouter juste en dessous :
```css
.col-cyan   { border-top: 3px solid #06b6d4; }
.col-gray   { border-top: 3px solid #94a3b8; }
.col-purple { border-top: 3px solid #a855f7; }
```

---

## Ce qui marche automatiquement après ces 3 étapes

| Fonctionnalité | Automatique ? |
|----------------|---------------|
| Tickets des nouveaux statuts affichés dans leurs colonnes | ✅ via `colTickets(col)` |
| Drag & drop vers les nouvelles colonnes | ✅ via `onDrop` |
| Dialog coût au passage en Résolu | ✅ `needsDialog: true` |
| Dialog réouverture si retour depuis Résolu/Terminé | ✅ `TERMINAL_COLS` |
| Couleur personnalisée depuis KanbanSettings | ✅ via `colColor(col.id)` |
| Label malgache depuis KanbanSettings | ✅ via `colLabelMg(col.id)` |
| Compteur de tickets par colonne | ✅ `colTickets(col).length` |

---

## Résultat final — ordre des colonnes

```
Nouveau → En cours → Planifié → En attente → Résolu → Terminé
  (1)        (2)       (3)          (4)         (5)      (6)
  blue      orange     cyan         gray       purple    green
```

---

## Cas particulier — regrouper plusieurs statuts dans une colonne

Si tu veux que "En cours" affiche les statuts 2 ET 3 ensemble :

```ts
{
  id: 'progress',
  label: 'En cours',
  statuses: [2, 3] as number[],   // ← les deux statuts dans la même colonne
  targetStatus: 2,                 // statut cible quand on dépose ici
  color: 'orange',
  needsDialog: false,
},
```

`colTickets(col)` filtre avec `col.statuses.includes(t.status)`, donc ça marche immédiatement.
