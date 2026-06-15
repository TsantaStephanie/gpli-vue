# Comment typer avec TypeScript dans Vue

## Typer un ref

```ts
import { ref } from 'vue'

const loading   = ref<boolean>(false)         // ou juste ref(false)
const montant   = ref<number>(0)
const titre     = ref<string>('')
const ticket    = ref<Ticket | null>(null)    // objet ou null
const records   = ref<TicketCostRecord[]>([]) // tableau d'objets
```

> Si la valeur initiale suffit à TypeScript pour inférer le type (`ref(false)` → boolean), inutile de l'écrire.

---

## Définir une interface (shape d'un objet)

```ts
// Décrit ce qu'un objet doit contenir
interface TicketCostRecord {
  id:          number
  ticketId:    number
  ticketTitle: string
  fixedCost:   number
  itemTypes:   string         // JSON string
  source:      CostSource
  createdAt:   string
}

// Utilisation
const record: TicketCostRecord = {
  id: 1, ticketId: 5, ticketTitle: 'Réseau',
  fixedCost: 200, itemTypes: '[]', source: 'kanban', createdAt: '2024-01-01'
}
```

---

## Propriété optionnelle dans une interface

```ts
interface Ticket {
  id:         number
  title:      string
  locationId?: number    // optionnel — peut être undefined
  closedAt?:  string
}

// locationId peut être absent :
const t: Ticket = { id: 1, title: 'Mon ticket' }   // OK
```

---

## Définir un type union (valeurs possibles)

```ts
// Seulement ces 3 valeurs sont acceptées
type CostSource = 'kanban' | 'reopen' | 'glpi'

const source: CostSource = 'kanban'   // OK
const source: CostSource = 'autre'    // ERREUR TypeScript
```

---

## Typer les props d'un composant

```ts
const props = defineProps<{
  ticketId:    number
  ticketTitle: string
  source:      CostSource     // union type
  cost?:       number         // optionnel
}>()
```

---

## Typer les emits d'un composant

```ts
const emit = defineEmits<{
  confirmer: [cost: number]   // émet un nombre
  annuler:   []               // émet rien
  changer:   [id: number, source: CostSource]  // émet deux valeurs
}>()

emit('confirmer', 150)
emit('annuler')
emit('changer', 5, 'glpi')
```

---

## Typer une fonction

```ts
// Paramètres et valeur de retour typés
function fmt(n: number): string {
  return n.toFixed(2)
}

// Fonction async → retourne Promise<Type>
async function charger(): Promise<void> {
  records.value = await getAllTicketCosts()
}

async function getRecord(id: number): Promise<TicketCostRecord | null> {
  return await getLatestTicketCost(id)
}
```

---

## Record<K, V> — objet avec clés et valeurs typées

```ts
// Clé = string, Valeur = string
const labels: Record<string, string> = {
  Computer: 'Ordinateur',
  Monitor:  'Écran',
}

// Clé = TicketStatus (number), Valeur = string
const statusLabels: Record<TicketStatus, string> = {
  1: 'Nouveau',
  2: 'En cours',
  5: 'Résolu',
  6: 'Fermé',
}
```

---

## Partial<T> — toutes les propriétés deviennent optionnelles

```ts
interface Ticket {
  id: number
  title: string
  status: number
}

// Pour une mise à jour partielle (on ne veut pas tout envoyer)
async function updateTicket(id: number, changes: Partial<Ticket>) {
  await axios.put(`/Ticket/${id}`, { input: changes })
}

// Appel : on peut n'envoyer que le status
updateTicket(5, { status: 2 })
```

---

## Caster un type inconnu (any → type précis)

```ts
// Réponse GLPI : on ne sait pas exactement ce qu'elle contient
const { data } = await glpiClient.get('/TicketCost')

// Cast explicite
const costs = data as any[]

// Accès sécurisé sur un any
const items = Array.isArray(itemsRes.data) ? itemsRes.data : []
const types = items.map((i: any) => i.itemtype).filter(Boolean)
```

---

## Récapitulatif

| Besoin | Syntaxe |
|--------|---------|
| Type simple | `ref<number>(0)` |
| Objet avec shape fixée | `interface MonType { ... }` |
| Valeurs limitées | `type Source = 'a' \| 'b' \| 'c'` |
| Propriété optionnelle | `champ?: type` |
| Objet clé→valeur | `Record<string, number>` |
| Mise à jour partielle | `Partial<MonType>` |
| Tableau | `MonType[]` ou `Array<MonType>` |
| Objet ou null | `MonType \| null` |
