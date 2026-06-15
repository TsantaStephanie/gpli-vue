# Comment manipuler les données JSON d'une API

## Récupérer et afficher du JSON

```ts
// L'API retourne :
// { id: 1, name: "Mon ticket", status: 2, priority: 3 }

const { data } = await axios.get('/api/tickets/1')
// data est déjà un objet JS, axios parse le JSON automatiquement
console.log(data.name)    // "Mon ticket"
console.log(data.status)  // 2
```

---

## Tableau JSON → afficher dans Vue

```ts
// L'API retourne :
// [ { id: 1, fixedCost: 100 }, { id: 2, fixedCost: 200 } ]

const { data } = await axios.get('/api/ticket-costs')
// data est un tableau JS

// Filtrer
const gros = data.filter((r: any) => r.fixedCost > 150)

// Transformer
const titres = data.map((r: any) => r.ticketTitle)

// Additionner
const total = data.reduce((sum: number, r: any) => sum + r.fixedCost, 0)
```

---

## Champ JSON imbriqué (objet dans objet)

```ts
// L'API retourne :
// { ticket: { id: 5, name: "..." }, cost: { fixed: 100, time: 50 } }

const { data } = await axios.get('/api/details/5')
console.log(data.ticket.name)   // accès imbriqué
console.log(data.cost.fixed)
```

---

## Champ JSON sous forme de string (itemTypes)

Dans ce projet, `itemTypes` est stocké comme string JSON : `'["Computer","Monitor"]'`

```ts
// Lire / parser
const record = await getLatestTicketCost(ticketId)
const types: string[] = JSON.parse(record.itemTypes || '[]')
// types = ["Computer", "Monitor"]

// Écrire / sérialiser (avant d'envoyer à l'API)
const itemTypes = JSON.stringify(["Computer", "Monitor"])
// itemTypes = '["Computer","Monitor"]'

// Toujours protéger le parse avec try/catch
let types: string[] = []
try {
  types = JSON.parse(record.itemTypes || '[]')
} catch {
  types = []
}
```

---

## Envoyer du JSON (POST / PUT)

```ts
// POST — créer une ressource
await axios.post('/api/ticket-costs', {
  ticketId:    5,
  fixedCost:   200,
  itemTypes:   JSON.stringify(['Computer']),
  source:      'kanban',
})

// PUT — modifier une ressource (GLPI utilise { input: { ... } })
await glpiClient.put(`/Ticket/${id}`, {
  input: {
    status: 2,
    priority: 3,
  }
})
```

---

## Typer le JSON avec TypeScript

```ts
// Définir l'interface qui correspond au JSON reçu
interface TicketCostRecord {
  id:          number
  ticketId:    number
  fixedCost:   number
  itemTypes:   string
  source:      'kanban' | 'reopen' | 'glpi'
  createdAt:   string
}

// Typer la réponse axios
const res = await axios.get<TicketCostRecord[]>('/api/ticket-costs')
const records: TicketCostRecord[] = res.data
// TypeScript sait maintenant que records[0].fixedCost est un number
```

---

## Gérer les erreurs JSON (API indisponible)

```ts
try {
  const { data } = await axios.get('/api/ticket-costs')
  records.value = data
} catch (e) {
  console.error('API indisponible :', e)
  records.value = []   // valeur par défaut
}
```

### Avec Promise.allSettled (plusieurs API en parallèle)

```ts
// Charge SQLite ET GLPI en même temps, sans bloquer si l'une échoue
const [sqlite, glpi] = await Promise.allSettled([
  getAllTicketCosts(),      // retourne un tableau
  fetchGlpiTicketCosts(),  // retourne un tableau
])

const sqliteData = sqlite.status === 'fulfilled' ? sqlite.value : []
const glpiData   = glpi.status   === 'fulfilled' ? glpi.value   : []
```

---

## Accès sécurisé (nullish coalescing)

```ts
// Si le champ peut être null/undefined
const cost   = record?.fixedCost ?? 0
const title  = record?.ticketTitle ?? 'Sans titre'
const types  = record?.itemTypes ?? '[]'
```

---

## Formater un nombre JSON avant affichage

```ts
// Nombre brut de l'API : 1234.5678
// Affiché : "1 234,57 Ar"

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

fmt(1234.5678)  // → "1 234,57"
```
