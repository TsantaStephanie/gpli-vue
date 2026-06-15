# Dates — Formatage et manipulation

## Format renvoyé par GLPI

GLPI renvoie les dates sous forme de chaîne ISO 8601 :

```
"2024-11-15T08:30:00+02:00"
"2024-11-15 08:30:00"   ← parfois sans le T
```

---

## Afficher une date lisible (format français)

```ts
// Affichage court : "15/11/2024"
new Date(dateString).toLocaleDateString('fr-FR')

// Affichage long : "vendredi 15 novembre 2024"
new Date(dateString).toLocaleDateString('fr-FR', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
})

// Avec heure : "15/11/2024 à 08:30"
new Date(dateString).toLocaleString('fr-FR', {
  dateStyle: 'short', timeStyle: 'short',
})
```

---

## Date relative ("il y a X jours")

```ts
function relativeDate(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const days  = Math.floor(diff / 86_400_000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 30)  return `il y a ${days} jours`
  const months = Math.floor(days / 30)
  return `il y a ${months} mois`
}
```

---

## Formater un nombre en monnaie (Intl)

Dans `CostReportView.vue` :

```ts
function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

// Résultat : "1 234,56"
// Affiché : "1 234,56 Ar"
```

---

## Formater un temps (secondes → heures/minutes)

```ts
function formatTime(seconds: number): string {
  const hours   = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`
  if (hours > 0)                return `${hours}h`
  if (minutes > 0)              return `${minutes}min`
  return '0 min'
}
```

---

## Date du jour (pour les formulaires)

```ts
// Format YYYY-MM-DD (input type="date")
const today = new Date().toISOString().split('T')[0]
// → "2024-11-15"
```

---

## Points d'attention

- GLPI stocke ses dates en **UTC** mais les affiche dans le fuseau de l'entité. Toujours passer par `new Date()` pour convertir.
- Ne pas comparer des chaînes de date directement (`"2024-11-15" > "2024-02-01"` marche mais fragile). Utiliser `new Date(a).getTime() - new Date(b).getTime()`.
