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
  'New':       1,
  'Assigned':  2,
  'Planned':   3,
  'Pending':   4,
  'Solved':    5,
  'Closed':    6,
}

/**
 * Résout un libellé de statut ticket vers son ID GLPI.
 * Gère : anglais, français, insensible à la casse et aux accents.
 * Ex: "Résolu" | "résolu" | "resolu" | "Solved" | "solved" → 5
 */
function resolveTicketStatus(raw: string): number {
  if (!raw) return 1
  const key = raw.trim()
  // 1. Essai exact (valeurs déjà correctes : 'Solved', 'Closed'…)
  if (TICKET_STATUS_MAP[key] !== undefined) return TICKET_STATUS_MAP[key]
  // 2. Correspondances explicites (FR + EN + minuscules + variantes sans accent)
  const lower = key.toLowerCase()
  const map: Record<string, number> = {
    // Anglais
    'new': 1, 'assigned': 2, 'planned': 3, 'pending': 4, 'solved': 5, 'closed': 6,
    // Français avec accents
    'nouveau': 1, 'assigné': 2, 'planifié': 3, 'en attente': 4, 'résolu': 5, 'fermé': 6,
    // Français sans accents (CSV peut les avoir supprimés)
    'assigne': 2, 'planifie': 3, 'resolu': 5, 'ferme': 6,
  }
  return map[lower] ?? 1
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

function parseGlpiDateTime(date: string, time: string): string {
  const [day, month, year] = date.split('/')
  return `${year}-${month}-${day} ${time}:00`
}

function parseItemsList(raw: string): string[] {
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return raw
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map(s => s.replace(/^"|"$/g, '').trim())
      .filter(Boolean)
  }
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

  // Phase 1 : regroupement par Ref_Ticket (ordre CSV préservé)
  // Chaque groupe = 1 ticket + son historique de statuts (ligne 1 → ligne N)
  const groupedByRef = new Map<string, TicketRow[]>()
  for (const row of rows) {
    if (!row.Ref_Ticket) {
      addLog('warning', '[Ticket] Ligne sans Ref_Ticket — ignorée')
      stats.skipped++
      continue
    }
    if (!groupedByRef.has(row.Ref_Ticket)) groupedByRef.set(row.Ref_Ticket, [])
    groupedByRef.get(row.Ref_Ticket)!.push(row)
  }

  // Compter les transitions de statut détectées
  let transitionCount = 0
  for (const [, group] of groupedByRef) {
    if (group.length > 1) transitionCount += group.length - 1
  }
  if (transitionCount > 0) {
    addLog('info', `[Ticket] ${transitionCount} transition(s) de statut détectée(s) — des suivis GLPI seront créés`)
  }

  // Construction des payloads :
  //   - Titre / Description / Type / Priorité / Date  → première ligne
  //   - Statut courant                                → dernière ligne
  //   - statusHistory                                 → toutes les lignes sauf la dernière
  const pending: Array<{
    ref: string
    row: TicketRow
    statusHistory: Array<{ status: string; date: string; heure: string }>
    payload: Record<string, unknown>
  }> = []

  for (const [ref, group] of groupedByRef) {
    const firstRow   = group[0]
    const statusNums = group.map(r => resolveTicketStatus(r.Status))
    const lastNum    = statusNums[statusNums.length - 1]

    // Statut effectif :
    // Si la progression se termine par Closed (6) ET est passée par Solved (5),
    // on utilise Solved comme statut GLPI — le Closed devient un suivi.
    // Sinon on prend la dernière ligne telle quelle.
    let effectiveIdx = group.length - 1
    if (lastNum === 6) {
      const solvedIdx = statusNums.lastIndexOf(5)
      if (solvedIdx !== -1) effectiveIdx = solvedIdx
    }

    const effectiveRow  = group[effectiveIdx]
    const statusHistory = [
      ...group.slice(0, effectiveIdx),
      ...group.slice(effectiveIdx + 1),
    ].map(r => ({ status: r.Status, date: r.Date, heure: r.Heure }))

    pending.push({
      ref,
      row: firstRow,
      statusHistory,
      payload: {
        name:            firstRow.Titre,
        content:         firstRow.Description,
        type:            TICKET_TYPE_MAP[firstRow.Type]         ?? 1,
        status:          resolveTicketStatus(effectiveRow.Status),
        priority:        TICKET_PRIORITY_MAP[firstRow.Priority] ?? 3,
        urgency:         3,
        impact:          3,
        date:            parseGlpiDateTime(firstRow.Date, firstRow.Heure),
        requesttypes_id: 1,
      },
    })
  }

  if (pending.length === 0) return stats

  // Phase 2 : envoi batch tickets
  addLog('info', `[Ticket] Envoi batch API: ${pending.length} ticket(s)`)

  try {
    const { data } = await glpiClient.post<Array<{ id: number; message?: string }>>('/Ticket', {
      input: pending.map(t => t.payload),
    })

    const results  = Array.isArray(data) ? data : [data]
    const itemLinks: Array<{ tickets_id: number; itemtype: string; items_id: number }> = []
    const followups: Array<Record<string, unknown>> = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const { ref, row, statusHistory } = pending[i]

      if (!result?.id) {
        addLog('error', `[Ticket] Échec pour Ref#${ref}: ${result?.message || 'erreur inconnue'}`)
        stats.errors++
        continue
      }

      const ticketId = result.id
      refToGlpiId.set(ref, ticketId)
      addLog('success', `[Ticket] Ref#${ref} "${row.Titre}" créé (ID=${ticketId}, statut final: ${pending[i].row.Titre})`)
      stats.created++

      // Résoudre les assets à lier
      for (const assetName of parseItemsList(row.Items)) {
        let assetRef = nameToIdCache.get(assetName)
        if (!assetRef) assetRef = await findAssetByName(assetName, nameToIdCache, logDebug) ?? undefined
        if (!assetRef) {
          addLog('warning', `[Ticket#${ticketId}] Asset "${assetName}" introuvable — lien ignoré`)
          continue
        }
        itemLinks.push({ tickets_id: ticketId, itemtype: assetRef.itemtype, items_id: assetRef.id })
      }

      // Préparer les suivis pour chaque statut intermédiaire (historique)
      for (const hist of statusHistory) {
        followups.push({
          itemtype:        'Ticket',
          items_id:        ticketId,
          content:         `[Import] Statut : ${hist.status}`,
          is_private:      0,
          date:            parseGlpiDateTime(hist.date, hist.heure),
          requesttypes_id: 1,
        })
      }
    }

    // Phase 3 : envoi batch des liens ticket-actif
    if (itemLinks.length > 0) {
      addLog('info', `[Ticket] Envoi batch API: ${itemLinks.length} lien(s) ticket-actif`)
      try {
        await glpiClient.post('/Item_Ticket', { input: itemLinks })
        addLog('success', `[Ticket] ${itemLinks.length} lien(s) ticket-actif créé(s)`)
      } catch (e: any) {
        addLog('warning', `[Ticket] Erreur batch liens: ${e.message}`, e.response?.data)
      }
    }

    // Phase 4 : envoi batch des suivis de statut (historique de progression)
    if (followups.length > 0) {
      addLog('info', `[Ticket] Envoi batch API: ${followups.length} suivi(s) de statut`)
      try {
        await glpiClient.post('/ITILFollowup', { input: followups })
        addLog('success', `[Ticket] ${followups.length} suivi(s) de statut créé(s)`)
      } catch (e: any) {
        addLog('warning', `[Ticket] Erreur batch suivis de statut: ${e.message}`, e.response?.data)
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

    const actiontime = parseInt(row.Duration_second, 10) || 0
    const cost_time  = parseFloat(row.Time_Cost.replace(',', '.')) || 0
    const cost_fixed = parseFloat(row.Fixed_Cost.replace(',', '.')) || 0

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


// ─── Point d'entrée principal ─────────────────────────────────────────────────

export const importService = {
  async runFullImport(
    sheet1: File,
    sheet2: File,
    sheet3: File,
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

    const [csv1, csv2, csv3] = await Promise.all([
      readFileAsText(sheet1),
      readFileAsText(sheet2),
      readFileAsText(sheet3),
    ])

    const assetsRows   = parseCSV(csv1) as unknown as AssetRow[]
    const ticketsRows  = parseCSV(csv2) as unknown as TicketRow[]
    const costsRows    = parseCSV(csv3) as unknown as CostRow[]

    log('info', `Feuille 1 : ${assetsRows.length} ligne(s) d'actifs`)
    log('info', `Feuille 2 : ${ticketsRows.length} ligne(s) de tickets`)
    log('info', `Feuille 3 : ${costsRows.length} ligne(s) de coûts`)

    progress(10, 'Import des actifs...')
    log('info', '─── Import Actifs ───')
    const assetsStats = await importAssets(assetsRows, logs, nameToIdCache, userStats)

    progress(50, 'Import des tickets...')
    log('info', '─── Import Tickets ───')
    const ticketsStats = await importTickets(ticketsRows, logs, nameToIdCache, refToGlpiId)

    progress(75, 'Import des coûts...')
    log('info', '─── Import Coûts ───')
    const costsStats = await importCosts(costsRows, logs, refToGlpiId)

    let photosStats = { total: 0, uploaded: 0, errors: 0 }
    if (photosZip) {
      progress(85, 'Upload des photos...')
      log('info', '─── Import Photos ───')
      photosStats = await importPhotos(photosZip, logs, nameToIdCache)
    }

    const hasErrors = assetsStats.errors > 0 || ticketsStats.errors > 0 ||
                      costsStats.errors > 0 || photosStats.errors > 0 || userStats.errors > 0

    if (hasErrors) {
      log('error', '─── Erreurs détectées — Annulation de l\'import ───')
      progress(88, 'Rollback en cours — réinitialisation des données...')

      try {
        await resetService.resetDatabase()
        log('success', '─── Réinitialisation terminée — Aucune donnée conservée ───')
      } catch (resetErr: any) {
        log('error', `Erreur lors de la réinitialisation : ${resetErr.message}`, resetErr.response?.data)
      }

      progress(100, 'Import annulé — données réinitialisées')
      return {
        success: false,
        rolledBack: true,
        logs,
        stats: {
          assets:  assetsStats,
          tickets: ticketsStats,
          costs:   costsStats,
          photos:  photosStats,
          users:   userStats,
        },
      }
    }

    progress(100, 'Import terminé')
    log('info', `─── Import terminé — ${userStats.created} utilisateur(s) créé(s) ───`)

    return {
      success: true,
      rolledBack: false,
      logs,
      stats: {
        assets:  assetsStats,
        tickets: ticketsStats,
        costs:   costsStats,
        photos:  photosStats,
        users:   userStats,
      },
    }
  },

  parseCSV,
  readFileAsText,
}

export default importService