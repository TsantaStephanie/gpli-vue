# Session GLPI

## Où est stocké le token

Le session-token est stocké dans le `localStorage` du navigateur sous la clé `glpi_session_token`.

```ts
// src/services/api/glpiClient.ts
const SESSION_TOKEN_KEY = 'glpi_session_token'

getSessionToken()   // lit   localStorage.getItem(SESSION_TOKEN_KEY)
setSessionToken()   // écrit localStorage.setItem(SESSION_TOKEN_KEY, token)
clearSessionToken() // vide  localStorage.removeItem(SESSION_TOKEN_KEY)
```

---

## Ouvrir une session

```ts
import { initSession } from '@/services/api/glpiClient'

// Avec login / mot de passe (formulaire)
await initSession('admin', 'monmotdepasse')

// Avec le user_token défini dans .env (VITE_GLPI_AUTH_MODE=token)
await initSession()
```

`initSession` stocke automatiquement le token dans le localStorage et le retourne.

---

## Fermer une session

```ts
import { killSession } from '@/services/api/glpiClient'

await killSession() // appelle /killSession puis vide le localStorage
```

---

## Vérifier / s'assurer qu'une session est active

```ts
import { ensureSession } from '@/services/api/sessionService'

const token = await ensureSession()
// Si pas de token → appelle initSession() automatiquement
```

---

## Variables d'environnement requises (.env)

```env
VITE_GLPI_BASE_URL=http://localhost/glpi/apirest.php
VITE_GLPI_APP_TOKEN=xxxx
VITE_GLPI_USER_TOKEN=xxxx          # si AUTH_MODE=token
VITE_GLPI_LOGIN=admin              # si AUTH_MODE=credentials
VITE_GLPI_PASSWORD=monmotdepasse   # si AUTH_MODE=credentials
VITE_GLPI_AUTH_MODE=credentials    # 'token' | 'credentials'
```

---

## Guard de navigation (router)

Toutes les routes sans `meta: { public: true }` redirigent vers `/login` si aucun token n'est présent.

```ts
// src/router/index.ts
router.beforeEach((to) => {
  if (!to.meta.public && !getSessionToken()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
})
```

Les routes `/front/**` sont accessibles sans session (front-office public).
