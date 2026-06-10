/**
 * glpiClient.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client Axios configuré pour l'API REST GLPI 11.x
 *
 * Flux d'authentification :
 *   1. initSession()  → obtient un session-token
 *   2. Toutes les requêtes suivantes portent ce token dans le header
 *   3. killSession()  → ferme la session proprement
 *
 * Ref : glpi-11.0.7/apirest.md
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

// ─── Configuration depuis .env ────────────────────────────────────────────────

const BASE_URL   = import.meta.env.VITE_GLPI_BASE_URL   as string;
const APP_TOKEN  = import.meta.env.VITE_GLPI_APP_TOKEN  as string;
const USER_TOKEN = import.meta.env.VITE_GLPI_USER_TOKEN as string;
const LOGIN      = import.meta.env.VITE_GLPI_LOGIN      as string;
const PASSWORD   = import.meta.env.VITE_GLPI_PASSWORD   as string;
const AUTH_MODE  = import.meta.env.VITE_GLPI_AUTH_MODE  as 'token' | 'credentials';

// ─── Gestion du session-token ─────────────────────────────────────────────────

const SESSION_TOKEN_KEY = 'glpi_session_token';

export function getSessionToken(): string | null {
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
}

export function setSessionToken(token: string): void {
  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

// ─── Instance Axios ───────────────────────────────────────────────────────────

export const glpiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000,   // 60 s — suffisant pour les requêtes GLPI standard
  headers: {
    'Content-Type': 'application/json',
    'App-Token': APP_TOKEN,
  },
});

// ─── Intercepteur de requête : injection du Session-Token ─────────────────────

glpiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const sessionToken = getSessionToken();
    if (sessionToken) {
      config.headers['Session-Token'] = sessionToken;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Intercepteur de réponse : gestion globale des erreurs ───────────────────

glpiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Timeout réseau (pas de réponse HTTP)
    if (error.code === 'ECONNABORTED' || !error.response) {
      const msg = error.message ?? 'Timeout ou erreur réseau'
      console.error('[GLPI API Error] Timeout/réseau :', msg)
      return Promise.reject(new Error(msg))
    }

    const status  = error.response.status
    const message = error.response.data?.[1] ?? error.message

    if (status === 401) {
      console.warn('[GLPI] Session expirée ou non autorisée — réinitialisation.')
      clearSessionToken()
    }

    console.error(`[GLPI API Error ${status}]`, error.response.data)
    return Promise.reject(new Error(`[${status}] ${message}`))
  },
);

// ─── initSession ─────────────────────────────────────────────────────────────

/**
 * Ouvre une session GLPI.
 * Supporte deux modes :
 *   - "token"       : utilise VITE_GLPI_USER_TOKEN
 *   - "credentials" : utilise login + password en Basic Auth
 */
export async function initSession(username?: string, password?: string): Promise<string> {
  const headers: Record<string, string> = {
    'App-Token': APP_TOKEN,
  };

  if (username && password) {
    const credentials = btoa(`${username}:${password}`);
    headers['Authorization'] = `Basic ${credentials}`;
  } else if (AUTH_MODE === 'token' && USER_TOKEN) {
    headers['Authorization'] = `user_token ${USER_TOKEN}`;
  } else {
    // Basic auth : base64(login:password)
    const credentials = btoa(`${LOGIN}:${PASSWORD}`);
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const config: AxiosRequestConfig = {
    headers,
    // Ne pas utiliser l'intercepteur (pas encore de session)
  };

  const { data } = await axios.get(`${BASE_URL}/initSession`, config);

  if (!data.session_token) {
    throw new Error('[GLPI] initSession : session_token manquant dans la réponse.');
  }

  const sessionToken = data.session_token as string;
  setSessionToken(sessionToken);
  console.info('[GLPI] Session initialisée :', sessionToken);
  return sessionToken;
}

// ─── killSession ──────────────────────────────────────────────────────────────

export async function killSession(): Promise<void> {
  const sessionToken = getSessionToken();
  if (!sessionToken) return;
  try {
    await glpiClient.get('/killSession');
    console.info('[GLPI] Session fermée.');
  } finally {
    clearSessionToken();
  }
}

// ─── Helper : fetch paginé ─────────────────────────────────────────────────────

/**
 * Récupère tous les items d'un endpoint avec pagination automatique.
 * GLPI limite à 50 items par défaut — on boucle jusqu'à la fin.
 */
export async function fetchAllPaginated<T>(
  endpoint: string,
  params: Record<string, unknown> = {},
  pageSize = 50,
  timeout?: number,
): Promise<T[]> {
  const results: T[] = [];
  let start = 0;
  let total = Infinity;

  while (start < total) {
    const { data, headers } = await glpiClient.get<T[]>(endpoint, {
      params: {
        ...params,
        range: `${start}-${start + pageSize - 1}`,
      },
      ...(timeout !== undefined && { timeout }),
    });

    // GLPI retourne Content-Range : items 0-49/312
    const contentRange = headers['content-range'] as string | undefined;
    if (contentRange) {
      const match = contentRange.match(/\/(\d+)/);
      if (match) total = parseInt(match[1], 10);
    } else {
      total = start + data.length; // pas de header → dernier bloc
    }

    results.push(...data);
    start += pageSize;

    if (data.length < pageSize) break; // sécurité
  }

  return results;
}

export default glpiClient;
