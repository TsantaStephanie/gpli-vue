/**
 * importService.ts
 * Version avec création automatique des utilisateurs
 */

import glpiClient from '../api/glpiClient'
import { resetService } from '../api/resetService'

// ─── Types internes ───────────────────────────────────────────────────────────

export interface ImportLogEntry {
  level: 'info' | 'success' | 'warning' | 'error' | 'debug'
  message: string
  timestamp: string
  details?: any
}

export interface ImportResult {
  success: boolean
  rolledBack: boolean
  logs: ImportLogEntry[]
  stats: {
    assets: { total: number; created: number; skipped: number; errors: number }
    tickets: { total: number; created: number; skipped: number; errors: number }
    costs: { total: number; created: number; errors: number }
    photos: { total: number; uploaded: number; errors: number }
    users: { total: number; created: number; errors: number }
  }
}

// ─── Correspondances statuts / types ─────────────────────────────────────────

const ASSET_STATUS_MAP: Record<string, number> = {
  'En production': 1,
  'En stock':      2,
  'Réformé':       3,
  'Maintenance':   4,
  'En panne':      5,
  'Hors service':  6,
}

const ITEM_TYPE_MAP: Record<string, string> = {
  'Computer':          'Computer',
  'Monitor':           'Monitor',
  'Printer':           'Printer',
  'Phone':             'Phone',
  'NetworkEquipment':  'NetworkEquipment',
  'Peripheral':        'Peripheral',
}

const TICKET_STATUS_MAP: Record<string, number> = {
  'New':                  1,
  'Assigned':             2,
  'In progress':          2,
  'In progress (assigned)': 2,
  'Planned':              3,
  'Pending':              4,
  'Solved':               5,
  'Closed':               6,
}

/**
 * Résout un libellé de statut ticket vers son ID GLPI.
 * Gère : anglais, français, insensible à la casse et aux accents.
 * Ex: "Résolu" | "résolu" | "resolu" | "Solved" | "solved" → 5
 */
function resolveTicketStatus(raw: string): number | null {
  if (!raw || !raw.trim()) return null
  const key = raw.trim()
  // 1. Essai exact
  if (TICKET_STATUS_MAP[key] !== undefined) return TICKET_STATUS_MAP[key]
  // 2. Correspondances insensibles à la casse / accents
  const lower = key.toLowerCase()
  const map: Record<string, number> = {
    // Anglais
    'new': 1, 'assigned': 2, 'in progress': 2, 'in progress (assigned)': 2,
    'planned': 3, 'pending': 4, 'solved': 5, 'closed': 6,
    // Français avec accents
    'nouveau': 1, 'assigné': 2, 'en cours': 2, 'planifié': 3, 'en attente': 4, 'résolu': 5, 'fermé': 6,
    // Français sans accents
    'assigne': 2, 'planifie': 3, 'resolu': 5, 'ferme': 6,
  }
  return map[lower] ?? null  // null = statut inconnu → erreur à l'import
}

const TICKET_PRIORITY_MAP: Record<string, number> = {
  'Very Low': 1,
  'Low':      2,
  'Medium':   3,
  'High':     4,
  'Very High':5,
  'Major':    6,
}

const TICKET_TYPE_MAP: Record<string, number> = {
  'Incident': 1,
  'Request':  2,
  'Demande':  2,
}

// ─── Utilitaires CSV ──────────────────────────────────────────────────────────

/**
 * Sépare une ligne par ';' en respectant les guillemets.
 * Utilisé pour éclater les lignes multi-entrées.
 * Ex: `entree1 ; entree2` → ['entree1', 'entree2']
 */
function splitBySemicolon(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      // Guillemet doublé ("") = guillemet littéral, pas de changement d'état
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; continue }
      inQuotes = !inQuotes
      current += char
    } else if (char === ';' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) result.push(current.trim())
  return result
}

/**
 * Pré-traitement : éclate les lignes contenant des ';' en lignes individuelles.
 * Permet d'écrire plusieurs entrées sur une même ligne :
 *   1,01/06/2026,New,"[...]" ; 1,02/06/2026,Solved,"[...]"
 * → deux lignes distinctes traitées normalement par parseCSV.
 * L'en-tête (ligne 1) est conservé tel quel.
 */
export function expandMultiEntryLines(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return content

  const header = lines[0]
  const expanded: string[] = [header]

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const entries = splitBySemicolon(line)
    for (const entry of entries) {
      if (entry) expanded.push(entry)
    }
  }

  return expanded.join('\n')
}

export function parseCSV(content: string): Record<string, string>[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx]?.trim() ?? ''
    })
    rows.push(row)
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'))
    reader.readAsText(file, 'UTF-8')
  })
}

// ─── Gestion des Utilisateurs - CRÉATION AUTOMATIQUE ─────────────────────────

/**
 * Extrait le prénom et le nom à partir d'un nom complet
 * Format attendu: "NOM Prénom" (ex: "Rakoto Jean")
 * 
 * @param fullName - Nom complet au format "NOM Prénom"
 * @returns { firstname: string, lastname: string, login: string }
 */
function parseFullName(fullName: string): { firstname: string; lastname: string; login: string } {
  const trimmed = fullName.trim()
  const parts = trimmed.split(' ')
  
  if (parts.length === 1) {
    // Nom unique, pas de prénom
    return {
      firstname: '',
      lastname: trimmed,
      login: trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')
    }
  }
  
  // Format: "NOM Prénom" → le premier mot est le NOM, le reste est le PRÉNOM
  // Ex: "Rakoto Jean" → lastname = "Rakoto", firstname = "Jean"
  const lastname = parts[0]      // Premier mot = NOM
  const firstname = parts.slice(1).join(' ')  // Le reste = PRÉNOM
  
  // Générer un login: prenom.nom (format standard GLPI)
  // Ex: "Rakoto Jean" → login = "jean.rakoto"
  let login = ''
  if (firstname) {
    login = `${firstname.toLowerCase()}.${lastname.toLowerCase()}`
  } else {
    login = lastname.toLowerCase()
  }
  // Nettoyer les caractères spéciaux
  login = login.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.]/g, '')
  
  return { firstname, lastname, login }
}

/**
 * Recherche un utilisateur par différents critères
 * Si non trouvé, le crée automatiquement avec mot de passe "123"
 */
async function resolveOrCreateUser(
  fullName: string,
  cache: Map<string, number>,
  addLog: (level: ImportLogEntry['level'], message: string, details?: any) => void,
  userStats: { total: number; created: number; errors: number }
): Promise<number | undefined> {
  if (!fullName || fullName.trim() === '') return undefined
  
  const trimmedName = fullName.trim()
  
  // Vérifier le cache
  if (cache.has(trimmedName)) {
    addLog('debug', `[User] Cache hit pour "${trimmedName}" → ID=${cache.get(trimmedName)}`)
    return cache.get(trimmedName)!
  }

  addLog('debug', `[User] Recherche/création de l'utilisateur "${trimmedName}"...`)
  userStats.total++

  const { firstname, lastname, login } = parseFullName(trimmedName)
  addLog('debug', `[User] Parsing: firstname="${firstname}", lastname="${lastname}", login="${login}"`)

  try {
    // 1. D'abord, essayer de trouver l'utilisateur par login
    const { data: searchByLogin } = await glpiClient.get('/User', {
      params: { 'searchText[name]': login, range: '0-1' },
    })
    
    if (Array.isArray(searchByLogin) && searchByLogin.length > 0) {
      addLog('success', `[User] Utilisateur trouvé par login: "${trimmedName}" (ID=${searchByLogin[0].id})`)
      cache.set(trimmedName, searchByLogin[0].id)
      return searchByLogin[0].id
    }
    
    // 2. Essayer par nom et prénom (recherche exacte)
    const { data: searchByName } = await glpiClient.get('/User', {
      params: { 
        'searchText[realname]': lastname,
        'searchText[firstname]': firstname,
        range: '0-10' 
      },
    })

    if (Array.isArray(searchByName) && searchByName.length > 0) {
      // Chercher une correspondance exacte sur nom ET prénom
      const match = searchByName.find((u: any) => {
        const userLast = u.realname || ''
        const userFirst = u.firstname || ''
        return userLast.toLowerCase() === lastname.toLowerCase() && 
               userFirst.toLowerCase() === firstname.toLowerCase()
      })
      
      if (match) {
        addLog('success', `[User] Utilisateur trouvé par nom/prénom: "${lastname} ${firstname}" (ID=${match.id})`)
        cache.set(trimmedName, match.id)
        return match.id
      }
    }

    // 3. Si non trouvé, CRÉER l'utilisateur avec mot de passe "123"
    addLog('info', `[User] Utilisateur non trouvé, création: "${lastname} ${firstname}" (login: ${login})`)
    
    const userPayload = {
      name:     login,                           // login unique (ex: jean.rakoto)
      realname: lastname,                       // nom (ex: Rakoto)
      firstname: firstname,                     // prénom (ex: Jean)
      password: "123",                          // Mot de passe par défaut
      password2: "123",                         // Confirmation du mot de passe
      is_active: 1,                             // Compte actif
      profiles_id: 0,                           // Profil par défaut
      entities_id: 0,                           // Entité par défaut
    }
    
    addLog('debug', `[User] Payload création: ${JSON.stringify(userPayload)}`)
    
    const { data: created } = await glpiClient.post('/User', {
      input: userPayload
    })
    
    addLog('success', `[User] Utilisateur créé: "${lastname} ${firstname}" (login: ${login}, mot de passe: 123, ID=${created.id})`)
    cache.set(trimmedName, created.id)
    userStats.created++
    return created.id
    
  } catch (e: any) {
    // Si l'erreur est due à un login déjà existant, essayer avec un login modifié
    if (e.response?.data?.[0]?.message?.includes('name already exists') || 
        e.response?.status === 400) {
      addLog('warning', `[User] Login "${login}" déjà existant, tentative avec variante...`)
      
      // Générer un login alternatif
      const alternativeLogin = `${login}${Date.now()}`.slice(0, 50)
      addLog('debug', `[User] Login alternatif: ${alternativeLogin}`)
      
      try {
        const userPayloadAlt = {
          name:     alternativeLogin,
          realname: lastname,
          firstname: firstname,
          password: "123",
          password2: "123",
          is_active: 1,
          profiles_id: 0,
          entities_id: 0,
        }
        
        const { data: created } = await glpiClient.post('/User', {
          input: userPayloadAlt
        })
        
        addLog('success', `[User] Utilisateur créé avec login alternatif: "${lastname} ${firstname}" (login: ${alternativeLogin}, mot de passe: 123, ID=${created.id})`)
        cache.set(trimmedName, created.id)
        userStats.created++
        return created.id
      } catch (e2: any) {
        addLog('error', `[User] Erreur pour "${trimmedName}": ${e2.message}`, e2.response?.data)
        userStats.errors++
        return undefined
      }
    }
    
    addLog('error', `[User] Erreur pour "${trimmedName}": ${e.message}`, e.response?.data)
    userStats.errors++
    return undefined
  }
}

// ─── Helpers GLPI ─────────────────────────────────────────────────────────────

async function resolveLocation(
  name: string, 
  cache: Map<string, number>,
  addLog?: (msg: string, details?: any) => void
): Promise<number | undefined> {
  if (!name) return undefined
  if (cache.has(name)) return cache.get(name)!

  addLog?.(`[Location] Recherche de "${name}"...`)

  try {
    const { data } = await glpiClient.get('/Location', {
      params: { 'searchText[name]': name, range: '0-1' },
    })
    if (Array.isArray(data) && data.length > 0) {
      addLog?.(`[Location] Trouvée: "${name}" (ID=${data[0].id})`)
      cache.set(name, data[0].id)
      return data[0].id
    }
    
    addLog?.(`[Location] Création de "${name}"...`)
    const { data: created } = await glpiClient.post('/Location', {
      input: { name },
    })
    addLog?.(`[Location] Créée: ID=${created.id}`)
    cache.set(name, created.id)
    return created.id
  } catch (e: any) {
    addLog?.(`[Location] Erreur: ${e.message}`)
    return undefined
  }
}

async function resolveManufacturer(
  name: string, 
  cache: Map<string, number>,
  addLog?: (msg: string, details?: any) => void
): Promise<number | undefined> {
  if (!name) return undefined
  if (cache.has(name)) return cache.get(name)!

  addLog?.(`[Manufacturer] Recherche de "${name}"...`)

  try {
    const { data } = await glpiClient.get('/Manufacturer', {
      params: { 'searchText[name]': name, range: '0-1' },
    })
    if (Array.isArray(data) && data.length > 0) {
      addLog?.(`[Manufacturer] Trouvé: "${name}" (ID=${data[0].id})`)
      cache.set(name, data[0].id)
      return data[0].id
    }
    
    addLog?.(`[Manufacturer] Création de "${name}"...`)
    const { data: created } = await glpiClient.post('/Manufacturer', {
      input: { name },
    })
    addLog?.(`[Manufacturer] Créé: ID=${created.id}`)
    cache.set(name, created.id)
    return created.id
  } catch (e: any) {
    addLog?.(`[Manufacturer] Erreur: ${e.message}`)
    return undefined
  }
}

async function findAssetByInventory(
  inventoryNumber: string,
  itemtype: string,
  addLog?: (msg: string, details?: any) => void
): Promise<number | null> {
  if (!inventoryNumber) return null
  
  addLog?.(`[Asset] Recherche par inventaire "${inventoryNumber}" dans ${itemtype}...`)
  
  try {
    const { data } = await glpiClient.get(`/${itemtype}`, {
      params: { 'searchText[otherserial]': inventoryNumber, range: '0-1' },
    })
    if (Array.isArray(data) && data.length > 0) {
      addLog?.(`[Asset] Trouvé: ID=${data[0].id}`)
      return data[0].id
    }
  } catch (e: any) {
    addLog?.(`[Asset] Erreur recherche: ${e.message}`)
  }
  return null
}

/**
 * Recherche ou crée un modèle (ComputerModel, MonitorModel, etc.)
 * Retourne son ID
 */
async function resolveModel(
  name: string,
  itemtype: string,
  cache: Map<string, number>,
  logDebug?: (msg: string, details?: any) => void
): Promise<number | undefined> {
  if (!name) return undefined
  
  const cacheKey = `${itemtype}_${name}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)!

  // Déterminer l'endpoint selon le type d'asset
  let endpoint = ''
  if (itemtype === 'Computer') endpoint = 'ComputerModel'
  else if (itemtype === 'Monitor') endpoint = 'MonitorModel'
  else if (itemtype === 'Printer') endpoint = 'PrinterModel'
  else if (itemtype === 'Phone') endpoint = 'PhoneModel'
  else if (itemtype === 'NetworkEquipment') endpoint = 'NetworkEquipmentModel'
  else return undefined

  logDebug?.(`[Model] Recherche de "${name}" dans ${endpoint}...`)

  try {
    // Rechercher le modèle existant
    const { data } = await glpiClient.get(`/${endpoint}`, {
      params: { 'searchText[name]': name, range: '0-1' },
    })
    
    if (Array.isArray(data) && data.length > 0) {
      logDebug?.(`[Model] Trouvé: "${name}" (ID=${data[0].id})`)
      cache.set(cacheKey, data[0].id)
      return data[0].id
    }
    
    // Créer le modèle s'il n'existe pas
    logDebug?.(`[Model] Création de "${name}" dans ${endpoint}...`)
    const { data: created } = await glpiClient.post(`/${endpoint}`, {
      input: { 
        name: name,
        entities_id: 0,
        is_recursive: 0
      },
    })
    logDebug?.(`[Model] Créé: ID=${created.id}`)
    cache.set(cacheKey, created.id)
    return created.id
    
  } catch (e: any) {
    logDebug?.(`[Model] Erreur pour "${name}": ${e.message}`)
    return undefined
  }
}

// ─── Recherche doublon ticket dans GLPI ──────────────────────────────────────
async function findExistingTicket(
  title: string,
  date: string,
  logDebug?: (msg: string) => void
): Promise<number | null> {
  if (!title) return null
  try {
    const { data } = await glpiClient.get('/Ticket', {
      params: { 'searchText[name]': title, range: '0-10' },
    })
    if (Array.isArray(data) && data.length > 0) {
      // Affiner : même titre ET même date (YYYY-MM-DD)
      const datePrefix = date.substring(0, 10)
      const match = data.find((t: any) =>
        t.date && String(t.date).startsWith(datePrefix)
      )
      if (match) {
        logDebug?.(`[Ticket] Doublon GLPI: "${title}" date=${datePrefix} → ID=${match.id}`)
        return match.id
      }
      // Fallback : même titre seulement (sécurité)
      logDebug?.(`[Ticket] Doublon potentiel (titre seul): "${title}" → ID=${data[0].id}`)
      return data[0].id
    }
  } catch { /* silencieux */ }
  return null
}

async function findAssetByName(
  name: string,
  nameToIdCache: Map<string, { itemtype: string; id: number }>,
  addLog?: (msg: string, details?: any) => void
): Promise<{ itemtype: string; id: number } | null> {
  if (nameToIdCache.has(name)) {
    addLog?.(`[Asset] Cache hit pour "${name}"`)
    return nameToIdCache.get(name)!
  }

  addLog?.(`[Asset] Recherche de "${name}" dans GLPI...`)

  const typesToSearch = ['Computer', 'Monitor', 'Printer', 'Phone', 'NetworkEquipment', 'Peripheral']
  for (const itemtype of typesToSearch) {
    try {
      const { data } = await glpiClient.get(`/${itemtype}`, {
        params: { 'searchText[name]': name, range: '0-1' },
      })
      if (Array.isArray(data) && data.length > 0) {
        addLog?.(`[Asset] Trouvé "${name}" dans ${itemtype} (ID=${data[0].id})`)
        const result = { itemtype, id: data[0].id }
        nameToIdCache.set(name, result)
        return result
      }
    } catch {
      continue
    }
  }
  addLog?.(`[Asset] "${name}" non trouvé dans GLPI`)
  return null
}

// ─── Normalisation des noms de statuts ───────────────────────────────────────
// Plusieurs libellés CSV peuvent désigner le même état canonique côté dashboard.
const STATUS_NORMALIZE: Record<string, string> = {
  'En production':  'En production',
  'En service':     'En production',
  'En stock':       'En stock',
  'Réformé':        'Réformé',
  'Maintenance':    'En maintenance',
  'En maintenance': 'En maintenance',
  'En panne':       'En panne',
  'Hors service':   'Hors service',
}

/**
 * Recherche ou crée un State (glpi_states) dans GLPI.
 * Utilise le nom canonique pour que le dashboard puisse associer les couleurs.
 */
async function resolveState(
  name: string,
  cache: Map<string, number>,
  addLog?: (msg: string, details?: any) => void
): Promise<number | undefined> {
  if (!name) return undefined

  const canonical = STATUS_NORMALIZE[name] ?? name
  if (cache.has(canonical)) return cache.get(canonical)!

  addLog?.(`[State] Recherche de "${canonical}"...`)

  try {
    const { data } = await glpiClient.get('/State', {
      params: { 'searchText[name]': canonical, range: '0-1' },
    })
    if (Array.isArray(data) && data.length > 0) {
      addLog?.(`[State] Trouvé: "${canonical}" (ID=${data[0].id})`)
      cache.set(canonical, data[0].id)
      return data[0].id
    }

    addLog?.(`[State] Création de "${canonical}"...`)
    const { data: created } = await glpiClient.post('/State', {
      input: { name: canonical, entities_id: 0, is_recursive: 1 },
    })
    addLog?.(`[State] Créé: ID=${created.id}`)
    cache.set(canonical, created.id)
    return created.id
  } catch (e: any) {
    addLog?.(`[State] Erreur pour "${canonical}": ${e.message}`)
    return undefined
  }
}

// ─── Import Feuille 1 : Assets ────────────────────────────────────────────────

interface AssetRow {
  Name: string
  Status: string
  Location: string
  Manufacturer: string
  Item_Type: string
  Model: string
  Inventory_Number: string
  User: string
}

async function importAssets(
  rows: AssetRow[],
  logs: ImportLogEntry[],
  nameToIdCache: Map<string, { itemtype: string; id: number }>,
  userStats: { total: number; created: number; errors: number }
): Promise<ImportResult['stats']['assets']> {
  const stats = { total: rows.length, created: 0, skipped: 0, errors: 0 }

  const addLog = (level: ImportLogEntry['level'], message: string, details?: any) => {
    logs.push({ level, message, timestamp: new Date().toISOString(), details })
  }
  const logDebug = (msg: string, details?: any) => addLog('debug', msg, details)

  const locationCache     = new Map<string, number>()
  const manufacturerCache = new Map<string, number>()
  const modelCache        = new Map<string, number>()
  const userCache         = new Map<string, number>()
  const stateCache        = new Map<string, number>()

  const MODEL_FIELD: Record<string, string> = {
    Computer:         'computermodels_id',
    Monitor:          'monitormodels_id',
    Printer:          'printermodels_id',
    Phone:            'phonemodels_id',
    NetworkEquipment: 'networkequipmentmodels_id',
  }

  // Phase 1 : résolution des références et regroupement par type
  const pendingByType = new Map<string, Array<{ row: AssetRow; payload: Record<string, unknown> }>>()

  for (const row of rows) {
    logDebug(`--- Résolution asset: ${row.Name} ---`)

    const itemtype = ITEM_TYPE_MAP[row.Item_Type] ?? row.Item_Type
    if (!itemtype) {
      addLog('warning', `[Asset] Type inconnu "${row.Item_Type}" pour "${row.Name}" — ignoré`)
      stats.skipped++
      continue
    }

    const existingId = await findAssetByInventory(row.Inventory_Number, itemtype, logDebug)
    if (existingId) {
      addLog('info', `[Asset] "${row.Name}" (${row.Inventory_Number}) déjà présent (ID=${existingId}) — ignoré`)
      nameToIdCache.set(row.Name, { itemtype, id: existingId })
      stats.skipped++
      continue
    }

    try {
      const [locationId, manufacturerId, modelId, userId, stateId] = await Promise.all([
        resolveLocation(row.Location, locationCache, logDebug),
        resolveManufacturer(row.Manufacturer, manufacturerCache, logDebug),
        resolveModel(row.Model, itemtype, modelCache, logDebug),
        resolveOrCreateUser(row.User, userCache, addLog, userStats),
        resolveState(row.Status, stateCache, logDebug),
      ])

      const payload: Record<string, unknown> = {
        name:        row.Name,
        otherserial: row.Inventory_Number,
        states_id:   stateId ?? 1,
      }
      if (locationId)     payload.locations_id    = locationId
      if (manufacturerId) payload.manufacturers_id = manufacturerId
      if (modelId && MODEL_FIELD[itemtype]) payload[MODEL_FIELD[itemtype]] = modelId
      if (userId) { payload.users_id_tech = userId; payload.users_id = userId }

      if (!pendingByType.has(itemtype)) pendingByType.set(itemtype, [])
      pendingByType.get(itemtype)!.push({ row, payload })
    } catch (e: any) {
      addLog('error', `[Asset] Erreur résolution pour "${row.Name}": ${e.message}`, e.response?.data)
      stats.errors++
    }
  }

  // Phase 2 : envoi batch par type d'asset
  for (const [itemtype, items] of pendingByType) {
    if (items.length === 0) continue
    addLog('info', `[Asset] Envoi batch API: ${items.length} ${itemtype}(s)`)

    try {
      const { data } = await glpiClient.post<Array<{ id: number; message?: string }>>(`/${itemtype}`, {
        input: items.map(i => i.payload),
      })

      const results = Array.isArray(data) ? data : [data]
      results.forEach((result, idx) => {
        const { row } = items[idx]
        if (result?.id) {
          nameToIdCache.set(row.Name, { itemtype, id: result.id })
          addLog('success', `[Asset] "${row.Name}" créé (${itemtype} ID=${result.id})`)
          stats.created++
        } else {
          addLog('error', `[Asset] Échec pour "${row.Name}": ${result?.message || 'erreur inconnue'}`)
          stats.errors++
        }
      })
    } catch (e: any) {
      addLog('error', `[Asset] Erreur batch ${itemtype}: ${e.message}`, e.response?.data)
      for (const { row } of items) {
        addLog('error', `[Asset] "${row.Name}" non créé (erreur batch)`)
        stats.errors++
      }
    }
  }

  return stats
}
// ─── Import Feuille 2 : Tickets ───────────────────────────────────────────────

interface TicketRow {
  Ref_Ticket: string
  Date: string
  Heure: string
  Type: string
  Titre: string
  Description: string
  Status: string
  Priority: string
  Items: string
}

/**
 * Convertit une date et une heure CSV en datetime GLPI (YYYY-MM-DD HH:MM:SS).
 * Un seul bloc de date est actif à la fois — décommenter le format souhaité.
 * Idem pour l'heure.
 */
function parseGlpiDateTime(date: string, time: string): string {
  const d = date.trim()
  const t = time.trim()

  // ── Parsing de la date ──────────────────────────────────────────────────────

  let year = '', month = '', day = ''

  // ✅ ACTIF — JJ/MM/AAAA  (ex: 25/06/2024)
  const mFR = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (mFR) { day = mFR[1]; month = mFR[2]; year = mFR[3] }

  // JJ-MM-AAAA  (ex: 25-06-2024)
  const mDash = d.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (mDash) { day = mDash[1]; month = mDash[2]; year = mDash[3] }

  // JJ.MM.AAAA  (ex: 25.06.2024)
  const mDot = d.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (mDot) { day = mDot[1]; month = mDot[2]; year = mDot[3] }

  // AAAA-MM-JJ  ISO 8601  (ex: 2024-06-25)
  const mISO = d.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (mISO) { year = mISO[1]; month = mISO[2]; day = mISO[3] }

  // AAAA/MM/JJ  (ex: 2024/06/25)
  const mISOSlash = d.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
  if (mISOSlash) { year = mISOSlash[1]; month = mISOSlash[2]; day = mISOSlash[3] }

  // MM/JJ/AAAA  format US  (ex: 06/25/2024)
  const mUS = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (mUS) { month = mUS[1]; day = mUS[2]; year = mUS[3] }

  // JJ Mois_abrégé AAAA  (ex: 01 Janv 2026)
  const MONTHS_SHORT: Record<string, string> = {
    janv:'01', févr:'02', mars:'03', avr:'04', mai:'05', juin:'06',
    juil:'07', août:'08', sept:'09', oct:'10', nov:'11', déc:'12',
  }
  const mShort = d.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})$/)
  if (mShort) {
    const m = MONTHS_SHORT[mShort[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')]
              ?? MONTHS_SHORT[mShort[2].toLowerCase()]
    if (m) { day = mShort[1].padStart(2,'0'); month = m; year = mShort[3] }
  }

  // JJ Mois_complet AAAA  (ex: 01 Janvier 2026)
  const MONTHS_LONG: Record<string, string> = {
    janvier:'01', février:'02', mars:'03', avril:'04', mai:'05', juin:'06',
    juillet:'07', août:'08', septembre:'09', octobre:'10', novembre:'11', décembre:'12',
  }
  const mLong = d.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})$/)
  if (mLong) {
    const m = MONTHS_LONG[mLong[2].toLowerCase()]
    if (m) { day = mLong[1].padStart(2,'0'); month = m; year = mLong[3] }
  }

  // JJ/MM/AA  année 2 chiffres  (ex: 25/06/24)  → siècle 2000 assumé
  const m2YSlash = d.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (m2YSlash) { day = m2YSlash[1]; month = m2YSlash[2]; year = '20' + m2YSlash[3] }

  // JJ-MM-AA  année 2 chiffres  (ex: 25-06-24)
  const m2YDash = d.match(/^(\d{2})-(\d{2})-(\d{2})$/)
  if (m2YDash) { day = m2YDash[1]; month = m2YDash[2]; year = '20' + m2YDash[3] }

  // AAAAMMJJ  compact ISO  (ex: 20240625)
  const mCompactISO = d.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (mCompactISO) { year = mCompactISO[1]; month = mCompactISO[2]; day = mCompactISO[3] }

  // JJMMAAAA  compact FR  (ex: 25062024)
  const mCompactFR = d.match(/^(\d{2})(\d{2})(\d{4})$/)
  if (mCompactFR) { day = mCompactFR[1]; month = mCompactFR[2]; year = mCompactFR[3] }

  // JJ MonthEN AAAA  (ex: 25 Jan 2024 / 25 January 2024)
  const MONTHS_EN: Record<string, string> = {
    jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
    jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
    january:'01', february:'02', march:'03', april:'04', june:'06',
    july:'07', august:'08', september:'09', october:'10', november:'11', december:'12',
  }
  const mDayMonEN = d.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (mDayMonEN) {
    const m = MONTHS_EN[mDayMonEN[2].toLowerCase()]
    if (m) { day = mDayMonEN[1].padStart(2,'0'); month = m; year = mDayMonEN[3] }
  }

  // MonthEN JJ, AAAA  (ex: Jan 25, 2024 / January 25, 2024)
  const mMonDayEN = d.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (mMonDayEN) {
    const m = MONTHS_EN[mMonDayEN[1].toLowerCase()]
    if (m) { month = m; day = mMonDayEN[2].padStart(2,'0'); year = mMonDayEN[3] }
  }

  // NomJourFR JJ MoisFR AAAA  (ex: lundi 25 juin 2024)
  const MONTHS_FR_FULL: Record<string, string> = {
    janvier:'01', février:'02', mars:'03', avril:'04', mai:'05', juin:'06',
    juillet:'07', août:'08', septembre:'09', octobre:'10', novembre:'11', décembre:'12',
  }
  const mFRDay = d.match(/^(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})$/i)
  if (mFRDay) {
    const m = MONTHS_FR_FULL[mFRDay[2].toLowerCase()]
    if (m) { day = mFRDay[1].padStart(2,'0'); month = m; year = mFRDay[3] }
  }

  // NomJourEN JJ MonthEN AAAA  (ex: Mon 25 Jan 2024)
  const mENDay = d.match(/^(?:mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i)
  if (mENDay) {
    const m = MONTHS_EN[mENDay[2].toLowerCase()]
    if (m) { day = mENDay[1].padStart(2,'0'); month = m; year = mENDay[3] }
  }

  // ── Parsing de l'heure ──────────────────────────────────────────────────────

  let hh = '00', mm = '00', ss = '00'

  // ✅ ACTIF — HH:MM  (ex: 14:30)  → secondes à 00
  const tHHMM = t.match(/^(\d{1,2}):(\d{2})$/)
  if (tHHMM) { hh = tHHMM[1].padStart(2, '0'); mm = tHHMM[2] }

  // // HH:MM:SS  (ex: 14:30:45)
  // const tHHMMSS = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
  // if (tHHMMSS) { hh = tHHMMSS[1].padStart(2, '0'); mm = tHHMMSS[2]; ss = tHHMMSS[3] }

  // // HH:MM AM/PM  (ex: 02:30 PM)
  // const tAMPM = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  // if (tAMPM) {
  //   let h = parseInt(tAMPM[1], 10)
  //   if (tAMPM[3].toUpperCase() === 'PM' && h < 12) h += 12
  //   if (tAMPM[3].toUpperCase() === 'AM' && h === 12) h = 0
  //   hh = String(h).padStart(2, '0'); mm = tAMPM[2]
  // }

  return `${year}-${month}-${day} ${hh}:${mm}:${ss}`
}

function parseItemsList(raw: string): string[] {
  if (!raw) return []
  let items: string[]
  try {
    items = JSON.parse(raw)
  } catch {
    items = raw
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map(s => s.replace(/^"|"$/g, '').trim())
      .filter(Boolean)
  }
  return [...new Set(items)]
}

async function importTickets(
  rows: TicketRow[],
  logs: ImportLogEntry[],
  nameToIdCache: Map<string, { itemtype: string; id: number }>,
  refToGlpiId: Map<string, number>,
): Promise<ImportResult['stats']['tickets']> {
  const stats = { total: rows.length, created: 0, skipped: 0, errors: 0 }

  const addLog = (level: ImportLogEntry['level'], message: string, details?: any) => {
    logs.push({ level, message, timestamp: new Date().toISOString(), details })
  }
  const logDebug = (msg: string, details?: any) => addLog('debug', msg, details)

  // Phase 1 : 1 ticket par Ref_Ticket (fidélité GLPI)
  // Plusieurs lignes avec le même Ref_Ticket = évolution du statut d'un même ticket.
  // On garde : date/titre/description/type/priorité de la 1ère ligne,
  //            statut de la dernière ligne (état courant réel).
  const lastByRef = new Map<string, { first: TicketRow; last: TicketRow }>()

  for (const row of rows) {
    if (!row.Ref_Ticket) {
      addLog('warning', '[Ticket] Ligne sans Ref_Ticket — ignorée')
      stats.skipped++
      continue
    }
    if (!lastByRef.has(row.Ref_Ticket)) {
      lastByRef.set(row.Ref_Ticket, { first: row, last: row })
    } else {
      lastByRef.get(row.Ref_Ticket)!.last = row   // met à jour le statut courant
    }
  }

  const dupCount = rows.filter(r => r.Ref_Ticket).length - lastByRef.size
  if (dupCount > 0)
    addLog('info', `[Ticket] ${dupCount} ligne(s) de progression de statut fusionnées (1 ticket par Ref_Ticket)`)

  const pending: Array<{ ref: string; row: TicketRow; payload: Record<string, unknown> }> = []

  for (const [ref, { first, last }] of lastByRef) {
    const resolvedStatus = resolveTicketStatus(last.Status)
    if (resolvedStatus === null) {
      addLog('error', `[Ticket] Ref#${ref} — statut inconnu : "${last.Status}" (valeurs acceptées : New, In progress, Planned, Pending, Solved, Closed)`)
      stats.errors++
      continue
    }
    pending.push({
      ref,
      row: first,
      payload: {
        name:            first.Titre,
        content:         first.Description,
        type:            TICKET_TYPE_MAP[first.Type]        ?? 1,
        status:          resolvedStatus,
        priority:        TICKET_PRIORITY_MAP[first.Priority] ?? 3,
        urgency:         3,
        impact:          3,
        date:            parseGlpiDateTime(first.Date, first.Heure),
        requesttypes_id: 1,
      },
    })
  }

  if (pending.length === 0) return stats

  // Phase 2 : création des tickets avec status=1 temporaire
  // GLPI n'autorise pas la liaison d'actifs sur les tickets Fermés/Résolus.
  // On crée d'abord en Nouveau, on lie les actifs, puis on met à jour le statut final.
  addLog('info', `[Ticket] Envoi batch API: ${pending.length} ticket(s)`)

  try {
    const { data } = await glpiClient.post<Array<{ id: number; message?: string }>>('/Ticket', {
      input: pending.map(t => ({ ...t.payload, status: 1 })),  // status=1 temporaire
    })

    const results      = Array.isArray(data) ? data : [data]
    const itemLinks:   Array<{ tickets_id: number; itemtype: string; items_id: number }> = []
    const finalStatuses: Array<{ id: number; status: number }> = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const { ref, row, payload } = pending[i]

      if (!result?.id) {
        addLog('error', `[Ticket] Échec pour Ref#${ref} [${row.Status}]: ${result?.message || 'erreur inconnue'}`)
        stats.errors++
        continue
      }

      const ticketId   = result.id
      const finalStatus = payload.status as number
      refToGlpiId.set(ref, ticketId)
      addLog('success', `[Ticket] Ref#${ref} "${row.Titre}" [${row.Status}] créé (ID=${ticketId})`)
      stats.created++

      // Statut final à appliquer après la liaison des actifs
      if (finalStatus !== 1) {
        finalStatuses.push({ id: ticketId, status: finalStatus })
      }

      // Résoudre les assets à lier (ticket encore Nouveau → permission OK)
      for (const assetName of parseItemsList(row.Items)) {
        let assetRef = nameToIdCache.get(assetName)
        if (!assetRef) assetRef = await findAssetByName(assetName, nameToIdCache, logDebug) ?? undefined
        if (!assetRef) {
          addLog('warning', `[Ticket#${ticketId}] Asset "${assetName}" introuvable — lien ignoré`)
          continue
        }
        itemLinks.push({ tickets_id: ticketId, itemtype: assetRef.itemtype, items_id: assetRef.id })
      }
    }

    // Phase 3 : liaison des actifs (pendant que les tickets sont encore Nouveau)
    if (itemLinks.length > 0) {
      addLog('info', `[Ticket] Envoi batch API: ${itemLinks.length} lien(s) ticket-actif`)
      try {
        await glpiClient.post('/Item_Ticket', { input: itemLinks })
        addLog('success', `[Ticket] ${itemLinks.length} lien(s) ticket-actif créé(s)`)
      } catch (e: any) {
        addLog('warning', `[Ticket] Erreur batch liens: ${e.message}`, e.response?.data)
      }
    }

    // Phase 4 : mise à jour vers le statut final (Résolu, Fermé, etc.)
    if (finalStatuses.length > 0) {
      addLog('info', `[Ticket] Mise à jour batch: ${finalStatuses.length} statut(s) final/finaux`)
      try {
        await glpiClient.put('/Ticket', { input: finalStatuses })
        addLog('success', `[Ticket] ${finalStatuses.length} statut(s) mis à jour`)
      } catch (e: any) {
        addLog('warning', `[Ticket] Erreur mise à jour statuts: ${e.message}`, e.response?.data)
      }
    }

  } catch (e: any) {
    addLog('error', `[Ticket] Erreur batch: ${e.message}`, e.response?.data)
    for (const { ref } of pending) {
      addLog('error', `[Ticket] Ref#${ref} non créé (erreur batch)`)
      stats.errors++
    }
  }

  return stats
}

// ─── Import Feuille 3 : Coûts ─────────────────────────────────────────────────

interface CostRow {
  Num_Ticket:     string
  Duration_second: string
  Time_Cost:      string
  Fixed_Cost:     string
}

async function importCosts(
  rows: CostRow[],
  logs: ImportLogEntry[],
  refToGlpiId: Map<string, number>,
): Promise<ImportResult['stats']['costs']> {
  const stats = { total: rows.length, created: 0, errors: 0 }

  const addLog = (level: ImportLogEntry['level'], message: string, details?: any) => {
    logs.push({ level, message, timestamp: new Date().toISOString(), details })
  }
  const logDebug = (msg: string, details?: any) => addLog('debug', msg, details)

  const ticketCostsProcessed = new Map<number, Set<string>>()
  const pendingCosts: Array<{ ref: string; ticketId: number; payload: Record<string, unknown> }> = []

  // Phase 1 : construction des payloads (déduplication)
  for (const row of rows) {
    const ref      = row.Num_Ticket
    const ticketId = refToGlpiId.get(ref)

    if (!ticketId) {
      addLog('warning', `[Coût] Ticket Ref#${ref} introuvable dans GLPI — ignoré`)
      stats.errors++
      continue
    }

    if (!ticketCostsProcessed.has(ticketId)) ticketCostsProcessed.set(ticketId, new Set())

    const costKey = `${row.Duration_second}|${row.Time_Cost}|${row.Fixed_Cost}`
    if (ticketCostsProcessed.get(ticketId)!.has(costKey)) {
      addLog('info', `[Coût] Doublon ignoré pour Ticket#${ticketId} (Ref#${ref})`)
      stats.created++
      continue
    }

    const actiontime = Math.round(parseNumber(row.Duration_second)) || 0
    const cost_time  = parseNumber(row.Time_Cost)  || 0
    const cost_fixed = parseNumber(row.Fixed_Cost) || 0

    logDebug(`[Coût] Préparation Ref#${ref}: durée=${actiontime}s, temps=${cost_time}, fixe=${cost_fixed}`)
    ticketCostsProcessed.get(ticketId)!.add(costKey)

    pendingCosts.push({
      ref,
      ticketId,
      payload: {
        tickets_id: ticketId,
        name:       `Coût import Ref#${ref}`,
        actiontime,
        cost_time,
        cost_fixed,
        cost_total: cost_time + cost_fixed,
      },
    })
  }

  if (pendingCosts.length === 0) return stats

  // Phase 2 : envoi batch coûts
  addLog('info', `[Coût] Envoi batch API: ${pendingCosts.length} coût(s)`)

  try {
    const { data } = await glpiClient.post<Array<{ id: number; message?: string }>>('/TicketCost', {
      input: pendingCosts.map(c => c.payload),
    })

    const results = Array.isArray(data) ? data : [data]
    results.forEach((result, idx) => {
      const { ref, ticketId } = pendingCosts[idx]
      if (result?.id) {
        addLog('success', `[Coût] Ticket#${ticketId} (Ref#${ref}) créé (ID=${result.id})`)
        stats.created++
      } else {
        addLog('error', `[Coût] Échec pour Ref#${ref}: ${result?.message || 'erreur inconnue'}`)
        stats.errors++
      }
    })
  } catch (e: any) {
    addLog('error', `[Coût] Erreur batch: ${e.message}`, e.response?.data)
    for (const { ref } of pendingCosts) {
      addLog('error', `[Coût] Ref#${ref} non créé (erreur batch)`)
      stats.errors++
    }
  }

  return stats
}

// ─── Import Photos (ZIP) ──────────────────────────────────────────────────────
// async function importPhotos(
//   zipFile: File,
//   logs: ImportLogEntry[],
//   nameToIdCache: Map<string, { itemtype: string; id: number }>,
// ): Promise<ImportResult['stats']['photos']> {
//   const stats = { total: 0, uploaded: 0, errors: 0 }
  
//   const addLog = (level: ImportLogEntry['level'], message: string, details?: any) => {
//     logs.push({ level, message, timestamp: new Date().toISOString(), details })
//   }

//   let JSZip: any
//   try {
//     JSZip = (await import('jszip')).default
//   } catch {
//     addLog('warning', '[Photos] JSZip non installé')
//     return stats
//   }

//   try {
//     const arrayBuffer = await zipFile.arrayBuffer()
//     const zip = await JSZip.loadAsync(arrayBuffer)

//     const imageFiles = Object.entries(zip.files).filter(([fullPath, entry]: [string, any]) => {
//       if (entry.dir) return false
//       if (fullPath.includes('__MACOSX/')) return false
//       if (!/\.(jpg|jpeg|png|gif)$/i.test(fullPath)) return false
//       return true
//     })

//     stats.total = imageFiles.length
//     addLog('info', `[Photos] ${stats.total} image(s) trouvée(s)`)

//     for (const [fullPath, zipEntry] of imageFiles) {
//       const shortName = fullPath.replace(/^.*[\\/]/, '')
//       const baseName = shortName.replace(/\.[^/.]+$/, '')
//       const assetRef = nameToIdCache.get(baseName)

//       if (!assetRef) {
//         addLog('warning', `[Photos] Asset "${baseName}" introuvable`)
//         stats.errors++
//         continue
//       }

//       try {
//         const blob = await zipEntry.async('blob')
//         const mimeType = shortName.match(/\.png$/i) ? 'image/png' : 'image/jpeg'

//         const formData = new FormData()
        
//         const manifest = {
//           input: {
//             name: baseName,
//             entities_id: 0,
//             documentcategories_id: 0,
//             itemtype: assetRef.itemtype,
//             items_id: assetRef.id,
//             _filename: [shortName]  // ← AJOUTER cette ligne !
//           }
//         }
        
//         formData.append('uploadManifest', JSON.stringify(manifest))
        
//         // Utiliser le même nom de champ que dans _filename
//         const file = new File([blob], shortName, { type: mimeType })
//         formData.append('filename[0]', file)  // ← correspond à _filename[0]

//         await glpiClient.post('/Document', formData, {
//           headers: { 'Content-Type': 'multipart/form-data' },
//         })

//         addLog('success', `[Photos] "${shortName}" uploadé → ${assetRef.itemtype}#${assetRef.id}`)
//         stats.uploaded++
//       } catch (e: any) {
//         addLog('error', `[Photos] Erreur "${shortName}": ${e.message}`, e.response?.data)
//         stats.errors++
//       }
//     }
//   } catch (e: any) {
//     addLog('error', `[Photos] Erreur ZIP: ${e.message}`)
//   }

//   return stats
// }

async function importPhotos(
  zipFile: File,
  logs: ImportLogEntry[],
  nameToIdCache: Map<string, { itemtype: string; id: number }>,
): Promise<ImportResult['stats']['photos']> {
  const stats = { total: 0, uploaded: 0, errors: 0 }
  
  const addLog = (level: ImportLogEntry['level'], message: string, details?: any) => {
    logs.push({ level, message, timestamp: new Date().toISOString(), details })
  }

  let JSZip: any
  try {
    JSZip = (await import('jszip')).default
  } catch {
    addLog('warning', '[Photos] JSZip non installé. Exécutez : npm install jszip')
    return stats
  }

  // Fonction de conversion PNG → JPEG
  async function convertPngToJpeg(blob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(blob)
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Impossible d\'obtenir le contexte canvas'))
          return
        }
        
        // Fond blanc pour les PNG transparents
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        
        canvas.toBlob(
          (jpegBlob) => {
            URL.revokeObjectURL(url)
            if (jpegBlob) {
              resolve(jpegBlob)
            } else {
              reject(new Error('Conversion PNG → JPEG échouée'))
            }
          },
          'image/jpeg',
          0.85 // Qualité 85%
        )
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Erreur chargement image PNG'))
      }
      
      img.src = url
    })
  }

  try {
    const arrayBuffer = await zipFile.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    const imageFiles = Object.entries(zip.files).filter(([fullPath, entry]: [string, any]) => {
      if (entry.dir) return false
      if (fullPath.includes('__MACOSX/')) return false
      if (fullPath.startsWith('._')) return false
      if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(fullPath)) return false
      return true
    })

    stats.total = imageFiles.length
    addLog('info', `[Photos] ${stats.total} image(s) trouvée(s) dans le ZIP`)

    for (const [fullPath, zipEntry] of imageFiles as [string, any][]) {
      const originalShortName = fullPath.replace(/^.*[\\/]/, '')
      let baseName = originalShortName.replace(/\.[^/.]+$/, '')
      
      addLog('debug', `[Photos] Traitement: ${originalShortName} → baseName=${baseName}`)

      // Vérifier que l'asset existe
      const assetRef = nameToIdCache.get(baseName)
      if (!assetRef) {
        addLog('warning', `[Photos] Asset "${baseName}" introuvable pour "${originalShortName}" — ignoré`)
        stats.errors++
        continue
      }

      try {
        let blob = await zipEntry.async('blob')
        let finalFilename = originalShortName
        let wasConverted = false

        // Convertir PNG en JPEG automatiquement
        if (originalShortName.toLowerCase().endsWith('.png')) {
          addLog('info', `[Photos] Conversion PNG→JPEG: ${originalShortName} (${(blob.size / 1024).toFixed(1)}KB)`)
          try {
            blob = await convertPngToJpeg(blob)
            finalFilename = originalShortName.replace(/\.png$/i, '.jpg')
            baseName = finalFilename.replace(/\.[^/.]+$/, '')
            wasConverted = true
            addLog('debug', `[Photos] Conversion réussie: ${(blob.size / 1024).toFixed(1)}KB`)
          } catch (e: any) {
            addLog('error', `[Photos] Échec conversion PNG: ${e.message}`)
            stats.errors++
            continue
          }
        }

        const mimeType = finalFilename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'

        // Construction du FormData selon le format exact attendu par GLPI
        const formData = new FormData()
        
        // Manifest au format correct : uploadManifest avec input
        const manifest = {
          input: {
            name: baseName,
            entities_id: 0,
            documentcategories_id: 0,
            itemtype: assetRef.itemtype,
            items_id: assetRef.id,
          }
        }
        
        formData.append('uploadManifest', JSON.stringify(manifest))
        
        // Le fichier avec le champ 'filename' (pas 'filename[0]')
        const file = new File([blob], finalFilename, { type: mimeType })
        formData.append('filename', file)

        addLog('debug', `[Photos] Upload vers ${assetRef.itemtype}#${assetRef.id}: ${finalFilename}`)

        const response = await glpiClient.post('/Document', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        const conversionMsg = wasConverted ? ' (converti PNG→JPEG)' : ''
        addLog('success', `[Photos] "${finalFilename}" uploadé → ${assetRef.itemtype}#${assetRef.id} (Document ID: ${response.data?.id})${conversionMsg}`)
        stats.uploaded++
        
      } catch (e: any) {
        addLog('error', `[Photos] Erreur pour "${originalShortName}"`, {
          message: e.message,
          response: e.response?.data,
          status: e.response?.status
        })
        stats.errors++
      }
    }
  } catch (e: any) {
    addLog('error', `[Photos] Erreur lors de la lecture du ZIP : ${e.message}`)
  }

  return stats
}


// ─── Parsing des nombres ──────────────────────────────────────────────────────

/**
 * Convertit une chaîne numérique en nombre, quel que soit le format :
 *   1234.56      → point décimal, pas de séparateur milliers
 *   1234,56      → virgule décimale, pas de séparateur milliers
 *   1,234.56     → virgule milliers + point décimal  (format US/EN)
 *   1.234,56     → point milliers  + virgule décimale (format EU/FR)
 *   1 234.56     → espace milliers + point décimal
 *   1 234,56     → espace milliers + virgule décimale
 * Retourne NaN si la valeur n'est pas un nombre valide.
 */
function parseNumber(raw: string): number {
  const s = raw.trim()
  if (!s) return NaN

  // Supprimer les espaces insécables / espaces simples utilisés comme séparateur milliers
  const noSpace = s.replace(/[\s  ]/g, '')

  const hasComma = noSpace.includes(',')
  const hasDot   = noSpace.includes('.')

  let normalized: string

  if (hasComma && hasDot) {
    // Les deux séparateurs présents → le dernier est le séparateur décimal
    const lastComma = noSpace.lastIndexOf(',')
    const lastDot   = noSpace.lastIndexOf('.')
    if (lastComma > lastDot) {
      // ex: 1.234,56 → format EU : point = milliers, virgule = décimal
      normalized = noSpace.replace(/\./g, '').replace(',', '.')
    } else {
      // ex: 1,234.56 → format US : virgule = milliers, point = décimal
      normalized = noSpace.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Uniquement virgule → séparateur décimal
    normalized = noSpace.replace(',', '.')
  } else {
    // Uniquement point ou rien → déjà au bon format
    normalized = noSpace
  }

  return parseFloat(normalized)
}

// ─── Validation ───────────────────────────────────────────────────────────────

const REQUIRED_COLS = {
  assets:  ['Name', 'Status', 'Location', 'Manufacturer', 'Item_Type', 'Model', 'Inventory_Number', 'User'],
  tickets: ['Ref_Ticket', 'Date', 'Heure', 'Type', 'Titre', 'Description', 'Status', 'Priority', 'Items'],
  costs:   ['Num_Ticket', 'Duration_second', 'Time_Cost', 'Fixed_Cost'],
}

/**
 * Vérifie que toutes les colonnes requises sont présentes dans le CSV.
 * Retourne le nombre d'erreurs trouvées.
 */
function validateColumns(
  rows: Record<string, string>[],
  required: string[],
  sheetName: string,
  logs: ImportLogEntry[],
): number {
  if (!rows.length) return 0
  const headers = Object.keys(rows[0])
  let errors = 0
  for (const col of required) {
    if (!headers.includes(col)) {
      logs.push({
        level: 'error',
        message: `[Validation] ${sheetName} — colonne "${col}" manquante ou non conforme (colonnes trouvées : ${headers.join(', ')})`,
        timestamp: new Date().toISOString(),
      })
      errors++
    }
  }
  if (errors === 0)
    logs.push({ level: 'success', message: `[Validation] ${sheetName} — colonnes OK`, timestamp: new Date().toISOString() })
  return errors
}

/**
 * Vérifie que les montants (Time_Cost, Fixed_Cost, Duration_second) sont positifs.
 * Retourne le nombre d'erreurs trouvées.
 */
function validateAmounts(
  rows: CostRow[],
  sheetName: string,
  logs: ImportLogEntry[],
): number {
  let errors = 0
  const fields: { col: keyof CostRow; label: string }[] = [
    { col: 'Time_Cost',       label: 'Time_Cost' },
    { col: 'Fixed_Cost',      label: 'Fixed_Cost' },
    { col: 'Duration_second', label: 'Duration_second' },
  ]
  rows.forEach((row, i) => {
    const lineNum = i + 2 // ligne 1 = headers
    for (const { col, label } of fields) {
      const raw = (row[col] ?? '').trim()
      if (raw === '') continue // champ vide toléré
      const val = parseNumber(raw)
      if (isNaN(val)) {
        logs.push({
          level: 'error',
          message: `[Validation] ${sheetName} ligne ${lineNum} — "${label}" : valeur non numérique ("${row[col]}")`,
          timestamp: new Date().toISOString(),
        })
        errors++
      } else if (val < 0) {
        logs.push({
          level: 'error',
          message: `[Validation] ${sheetName} ligne ${lineNum} — "${label}" doit être positif (valeur reçue : ${val})`,
          timestamp: new Date().toISOString(),
        })
        errors++
      }
    }
  })
  if (errors === 0)
    logs.push({ level: 'success', message: `[Validation] ${sheetName} — montants OK`, timestamp: new Date().toISOString() })
  return errors
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────

export const importService = {
  async runFullImport(
    sheet1: File | null,
    sheet2: File | null,
    sheet3: File | null,
    photosZip?: File | null,
    onProgress?: (pct: number, step: string) => void,
  ): Promise<ImportResult> {
    const logs: ImportLogEntry[] = []
    const progress = (pct: number, step: string) => onProgress?.(pct, step)

    const log = (level: ImportLogEntry['level'], msg: string) =>
      logs.push({ level, message: msg, timestamp: new Date().toISOString() })

    const nameToIdCache = new Map<string, { itemtype: string; id: number }>()
    const refToGlpiId   = new Map<string, number>()
    const userStats = { total: 0, created: 0, errors: 0 }

    log('info', '─── Début de l\'import ───')
    progress(0, 'Lecture des fichiers CSV...')

    // ── Lecture des fichiers ─────────────────────────────────────────────────
    const [csv1, csv2, csv3] = await Promise.all([
      sheet1 ? readFileAsText(sheet1) : null,
      sheet2 ? readFileAsText(sheet2) : null,
      sheet3 ? readFileAsText(sheet3) : null,
    ])

    // Pour activer les lignes multi-entrées séparées par ';',
    // remplacer parseCSV(csvX) par parseCSV(expandMultiEntryLines(csvX)) ci-dessous.
    const assetsRows  = csv1 != null ? parseCSV(csv1) as unknown as AssetRow[]  : null
    const ticketsRows = csv2 != null ? parseCSV(csv2) as unknown as TicketRow[] : null
    const costsRows   = csv3 != null ? parseCSV(csv3) as unknown as CostRow[]   : null
    // const assetsRows  = csv1 != null ? parseCSV(expandMultiEntryLines(csv1)) as unknown as AssetRow[]  : null
    // const ticketsRows = csv2 != null ? parseCSV(expandMultiEntryLines(csv2)) as unknown as TicketRow[] : null
    // const costsRows   = csv3 != null ? parseCSV(expandMultiEntryLines(csv3)) as unknown as CostRow[]   : null

    if (!sheet1) log('info', 'Feuille 1 (Actifs) non fournie — étape ignorée')
    else if (!assetsRows?.length) log('warning', 'Feuille 1 (Actifs) est vide')
    else log('info', `Feuille 1 : ${assetsRows.length} ligne(s) d'actifs`)

    if (!sheet2) log('info', 'Feuille 2 (Tickets) non fournie — étape ignorée')
    else if (!ticketsRows?.length) log('warning', 'Feuille 2 (Tickets) est vide')
    else log('info', `Feuille 2 : ${ticketsRows.length} ligne(s) de tickets`)

    if (!sheet3) log('info', 'Feuille 3 (Coûts) non fournie — étape ignorée')
    else if (!costsRows?.length) log('warning', 'Feuille 3 (Coûts) est vide')
    else log('info', `Feuille 3 : ${costsRows.length} ligne(s) de coûts`)

    if (sheet3 && !sheet2)
      log('warning', 'Feuille 3 fournie sans Feuille 2 — les coûts ne pourront pas être liés')

    // ── Validation (avant tout appel API) ────────────────────────────────────
    // Si des erreurs sont détectées ici, rien n'a encore été inséré → pas besoin de rollback.
    progress(5, 'Validation des colonnes et des montants...')
    log('info', '─── Validation ───')
    let validationErrors = 0

    if (assetsRows?.length)
      validationErrors += validateColumns(assetsRows as unknown as Record<string, string>[], REQUIRED_COLS.assets,  'Feuille 1 (Actifs)',  logs)
    if (ticketsRows?.length)
      validationErrors += validateColumns(ticketsRows as unknown as Record<string, string>[], REQUIRED_COLS.tickets, 'Feuille 2 (Tickets)', logs)
    if (costsRows?.length) {
      validationErrors += validateColumns(costsRows as unknown as Record<string, string>[], REQUIRED_COLS.costs,   'Feuille 3 (Coûts)',   logs)
      validationErrors += validateAmounts(costsRows, 'Feuille 3 (Coûts)', logs)
    }

    if (validationErrors > 0) {
      log('error', `─── ${validationErrors} erreur(s) de validation — import annulé, aucune donnée insérée ───`)
      progress(100, 'Import annulé — erreurs de validation')
      return {
        success: false,
        rolledBack: false,
        logs,
        stats: {
          assets:  { total: 0, created: 0, skipped: 0, errors: 0 },
          tickets: { total: 0, created: 0, skipped: 0, errors: 0 },
          costs:   { total: 0, created: 0, errors: 0 },
          photos:  { total: 0, uploaded: 0, errors: 0 },
          users:   userStats,
        },
      }
    }

    log('info', '─── Validation réussie — démarrage de l\'import ───')

    // ── Helper rollback ──────────────────────────────────────────────────────
    // Appelé dès qu'une phase détecte une erreur : purge tout ce qui a déjà
    // été inséré et retourne immédiatement sans continuer les phases suivantes.
    const rollbackAndReturn = async (
      assetsStats:  ImportResult['stats']['assets'],
      ticketsStats: ImportResult['stats']['tickets'],
      costsStats:   ImportResult['stats']['costs'],
      photosStats:  ImportResult['stats']['photos'],
    ): Promise<ImportResult> => {
      log('error', '─── Erreur détectée — arrêt immédiat et réinitialisation ───')
      progress(90, 'Rollback en cours — suppression des données insérées...')
      try {
        await resetService.resetDatabase()
        log('success', '─── Réinitialisation terminée — aucune donnée conservée ───')
      } catch (resetErr: any) {
        log('error', `Erreur lors de la réinitialisation : ${resetErr.message}`, resetErr.response?.data)
      }
      progress(100, 'Import annulé — données réinitialisées')
      return {
        success: false,
        rolledBack: true,
        logs,
        stats: { assets: assetsStats, tickets: ticketsStats, costs: costsStats, photos: photosStats, users: userStats },
      }
    }

    const emptyAssets  = { total: 0, created: 0, skipped: 0, errors: 0 }
    const emptyTickets = { total: 0, created: 0, skipped: 0, errors: 0 }
    const emptyCosts   = { total: 0, created: 0, errors: 0 }
    const emptyPhotos  = { total: 0, uploaded: 0, errors: 0 }

    // ── Phase 1 : Actifs ─────────────────────────────────────────────────────
    progress(10, 'Import des actifs...')
    const assetsStats = assetsRows?.length
      ? (log('info', '─── Import Actifs ───'), await importAssets(assetsRows, logs, nameToIdCache, userStats))
      : emptyAssets

    if (assetsStats.errors > 0 || userStats.errors > 0) {
      return rollbackAndReturn(assetsStats, emptyTickets, emptyCosts, emptyPhotos)
    }

    // ── Phase 2 : Tickets ────────────────────────────────────────────────────
    progress(50, 'Import des tickets...')
    const ticketsStats = ticketsRows?.length
      ? (log('info', '─── Import Tickets ───'), await importTickets(ticketsRows, logs, nameToIdCache, refToGlpiId))
      : emptyTickets

    if (ticketsStats.errors > 0) {
      return rollbackAndReturn(assetsStats, ticketsStats, emptyCosts, emptyPhotos)
    }

    // ── Phase 3 : Coûts ──────────────────────────────────────────────────────
    progress(75, 'Import des coûts...')
    const costsStats = costsRows?.length
      ? (log('info', '─── Import Coûts ───'), await importCosts(costsRows, logs, refToGlpiId))
      : emptyCosts

    if (costsStats.errors > 0) {
      return rollbackAndReturn(assetsStats, ticketsStats, costsStats, emptyPhotos)
    }

    // ── Phase 4 : Photos ─────────────────────────────────────────────────────
    let photosStats = emptyPhotos
    if (photosZip) {
      progress(85, 'Upload des photos...')
      log('info', '─── Import Photos ───')
      photosStats = await importPhotos(photosZip, logs, nameToIdCache)

      if (photosStats.errors > 0) {
        return rollbackAndReturn(assetsStats, ticketsStats, costsStats, photosStats)
      }
    }

    // ── Succès total ─────────────────────────────────────────────────────────
    progress(100, 'Import terminé')
    log('info', `─── Import terminé avec succès — ${userStats.created} utilisateur(s) créé(s) ───`)

    return {
      success: true,
      rolledBack: false,
      logs,
      stats: { assets: assetsStats, tickets: ticketsStats, costs: costsStats, photos: photosStats, users: userStats },
    }
  },

  parseCSV,
  readFileAsText,
}

export default importService