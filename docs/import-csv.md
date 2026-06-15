# Import CSV

## Vue d'ensemble

Fichier : `src/views/back/ImportView.vue`
Route : `/import`
Service : `src/services/import/importService.ts`

L'import permet de charger des données depuis des fichiers CSV (3 feuilles Excel exportées) et de les envoyer dans GLPI via l'API REST.

---

## Fichiers attendus

| Fichier | Contenu |
|---------|---------|
| **Feuille 1** | Utilisateurs / demandeurs |
| **Feuille 2** | Actifs (ordinateurs, écrans, etc.) |
| **Feuille 3** | Tickets (titre, description, statut, actifs liés) |
| **Photos ZIP** | Archive ZIP avec les photos des actifs (optionnel) |

---

## Phases d'import

L'import se déroule en 5 phases avec une barre de progression :

```
0%  →  10%  →  50%  →  75%  →  85%  →  100%
Lecture   Actifs   Tickets   Coûts   Photos
```

| Phase | Plage | Description |
|-------|-------|-------------|
| Lecture | 0–10% | Parsing des CSV |
| Actifs | 10–50% | Création des actifs dans GLPI |
| Tickets | 50–75% | Création des tickets + association actifs |
| Coûts | 75–85% | Import des coûts dans GLPI |
| Photos | 85–100% | Upload des photos des actifs |

---

## Résultats et statistiques

Après import, `ImportResult` contient :

```ts
interface ImportResult {
  stats: {
    users:   { total, created, errors }
    assets:  { total, created, skipped, errors }
    tickets: { total, created, skipped, errors }
    costs:   { total, created, errors }
    photos:  { total, uploaded, errors }
  }
  logs: ImportLogEntry[]  // journal détaillé
}

interface ImportLogEntry {
  level:   'success' | 'warning' | 'error'
  message: string
  details?: string
}
```

---

## Filtrer les logs

Les logs peuvent être filtrés par niveau dans l'interface :

```ts
// Tous / Erreurs / Avertissements / Succès
const logFilter = ref<'all' | 'error' | 'warning' | 'success'>('all')
```

---

## Lancer un import depuis le code

```ts
import { importService } from '@/services/import/importService'

const result = await importService.run({
  sheet1: fichierCSV1,
  sheet2: fichierCSV2,
  sheet3: fichierCSV3,
  photosZip: archiveZIP,
  onProgress: (pct, msg) => {
    progress.value    = pct
    progressMsg.value = msg
  },
})
```

---

## Points d'attention

- L'import est **idempotent** pour les actifs : si un actif existe déjà (même nom/serial), il est skippé (`skipped++`) plutôt que dupliqué.
- Les tickets sont aussi dédupliqués par titre si déjà existants dans GLPI.
- Un import partiel (certaines phases échouent) est possible : les données importées avant l'erreur restent dans GLPI.
- L'upload de photos nécessite que les actifs aient déjà été créés (leur ID GLPI est requis).
