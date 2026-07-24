# samaChauffeur

Une application de type ride‑hailing (backend Node.js/Express + API REST + WebSockets (Socket.io) + frontend React/Vite).

> ℹ️ Le backend a été entièrement réécrit de Django vers Node.js/Express (voir `backend-node/`). L'ancien
> backend Django (`backend/`) est conservé pour référence mais n'est plus utilisé — vous pouvez le supprimer
> une fois que la migration est validée.

## 🚀 Présentation
- Backend : Node.js + Express + TypeScript, Prisma ORM, Socket.io (WebSockets).
- Frontend : React + TypeScript + Vite.
- Base de données : Supabase Postgres (projet `samaChauffeur`, région `eu-west-1`).

---

## ⚙️ Démarrage rapide (développement)
Prérequis : Node.js 18+ & npm, un projet Supabase (Postgres).

1. Configurer et installer le backend

```bash
cd backend-node
cp .env.example .env   # si besoin — un .env est déjà fourni avec les clés du projet Supabase
npm install
```

Complétez `DATABASE_URL` et `DIRECT_URL` dans `backend-node/.env` avec le mot de passe de la base
(Supabase Dashboard → Project Settings → Database → Connection string). Les clés API et l'URL JWKS
du projet `samaChauffeur` (qissfmhbzyogqnlndctj / eu-west-1) sont déjà renseignées.

2. Créer les tables dans Supabase

Deux options :

**Option A — script SQL direct (recommandé, le plus fiable)**
Ouvrez Supabase Dashboard → votre projet → **SQL Editor** → New query, collez tout le contenu de
[`backend-node/prisma/supabase_init.sql`](backend-node/prisma/supabase_init.sql) et cliquez **Run**.
Ce script crée toutes les tables/enums/index et insère les règles de tarification par défaut. Il est
idempotent (peut être relancé sans risque).

**Option B — migration Prisma**

```bash
npx prisma migrate dev --name init
```

Dans les deux cas, générez ensuite le client Prisma :

```bash
npx prisma generate
```

3. Lancer le serveur (API REST + Socket.io sur le même port)

```bash
npm run dev
# écoute sur http://0.0.0.0:8000 par défaut (voir PORT dans .env)
```

4. Lancer le frontend

```bash
cd frontend
npm install
npm run dev
```

Le frontend lit `VITE_API_BASE` (défaut `http://127.0.0.1:8000/api`) et `VITE_SOCKET_BASE`
(défaut `http://127.0.0.1:8000`) — voir `frontend/.env`.

---

## ✅ Vérification
- Backend : `npm run build` (compilation TypeScript) dans `backend-node/`.
- Frontend : `npm run build` (tsc + vite build) dans `frontend/`.

---

## 🔐 Authentification
- JWT (access + refresh) — endpoints fournis par `accounts`.
- OTP (envoi / vérification) **uniquement pour vérifier le numéro lors de l'inscription**. Après vérification la connexion se fait par **numéro de téléphone + mot de passe** (`/api/auth/token/`).

---

## 📡 API — Liste complète des endpoints
Base URL API : `/api/`

Remarque : les chemins ci‑dessous incluent le préfixe `/api` tel que défini dans `backend-node/src/app.ts`
(inchangés par rapport à l'ancien backend Django, pour ne pas casser le frontend existant).

### Auth / Utilisateurs (`/api/auth/`)
- POST `/api/auth/register/` — Créer un utilisateur (body : `phone`, etc.). Auth : public ✅
- GET, PATCH `/api/auth/me/` — Profil courant. Auth : requis ✅
- GET, POST `/api/auth/users/` — Liste / création (admin uniquement). Auth : admin ✅
- GET, PATCH, DELETE `/api/auth/users/<pk>/` — Détails utilisateur (owner ou admin). Auth ✅
- POST `/api/auth/token/` — Obtenir JWT (username/password) — public
- POST `/api/auth/token/refresh/` — Rafraîchir token — public
- POST `/api/auth/logout/` — Blacklist refresh token — Auth ✅
- POST `/api/auth/otp/send/` — Envoyer OTP (body: `phone`) — public ✅
- POST `/api/auth/otp/verify/` — Vérifier OTP (body: `phone`, `code`) — **utilisé uniquement pour marquer `phone_verified` lors de l'inscription** (ne renvoie pas de tokens). — public ✅

### Chauffeurs (`/api/chauffeurs/`)
- POST `/api/chauffeurs/apply/` — Postuler comme chauffeur (auth requis)
- POST `/api/chauffeurs/verify/<pk>/` — Vérifier un chauffeur (admin)
- GET `/api/chauffeurs/available/?lat=&lng=&radius=` — Chauffeurs disponibles (client)
- POST `/api/chauffeurs/location/` — Mettre à jour localisation (chauffeur)
- POST `/api/chauffeurs/availability/` — Basculer en ligne/hors ligne (body: `is_available`, chauffeur)
- GET, POST `/api/chauffeurs/vehicles/` — Liste/création véhicules (admin)
- GET, POST `/api/chauffeurs/admin/chauffeurs/` — Admin list/create chauffeurs

### Courses / Trips (`/api/trips/`)
- POST `/api/trips/create/` — Créer une course (client)
- GET `/api/trips/available/` — Courses demandées (chauffeur)
- POST `/api/trips/claim/<id>/` — Réclamer une course (chauffeur)
- GET `/api/trips/my/` — Mes courses (passager)
- GET `/api/trips/<id>/` — Détails d'une course
- POST `/api/trips/<id>/accept/` — Accepter (chauffeur assigné)
- POST `/api/trips/<id>/reject/` — Refuser (chauffeur assigné)
- POST `/api/trips/<id>/start/` — Démarrer la course (chauffeur)
- POST `/api/trips/<id>/end/` — Terminer la course (chauffeur)

### Pricing (`/api/pricing/`)
- GET, POST `/api/pricing/rules/` — Lister / créer règles (POST: admin)
- POST `/api/pricing/estimate/` — Estimer prix (public)

### Clients (`/api/clients/`)
- GET, POST, PATCH `/api/clients/profile/` — Profil client (auth)
- GET, POST `/api/clients/payment-methods/` — Méthodes de paiement du profil
- POST `/api/clients/tickets/` — Créer ticket support
- GET, POST `/api/clients/profiles/` — Admin list/create client profiles (admin)

### Paiements (`/api/payments/`)
- GET, POST `/api/payments/transactions/` — Lister / créer transactions (client/admin)
- GET, PATCH `/api/payments/transactions/<id>/` — Détails / mise à jour (owner/admin)
- POST `/api/payments/transactions/<id>/validate/` — Valider paiement (chauffeur lié au trip)
- GET `/api/payments/transactions/pending/driver/` — Pending pour chauffeur
- GET, POST `/api/payments/methods/` — Lister / créer méthodes (client)
- GET, PATCH, DELETE `/api/payments/methods/<id>/` — Détail méthode
- GET, POST `/api/payments/payouts/` — Payouts (admin)
- GET `/api/payments/summary/` — Récapitulatif paiements (client)

### Gares / Transports (`/api/gares/`)
- GET, POST `/api/gares/stations/` — Lister / créer stations (POST: admin)
- GET, PUT, PATCH, DELETE `/api/gares/stations/<id>/` — Station detail
- GET, POST `/api/gares/lines/` — Lignes (POST: admin)
- GET, PUT, PATCH, DELETE `/api/gares/lines/<id>/` — Line detail
- GET, POST `/api/gares/schedules/` — Horaires (POST: admin)
- GET, PUT, PATCH, DELETE `/api/gares/schedules/<id>/` — Schedule detail

### Tickets (`/api/tickets/`)
- GET, POST `/api/tickets/` — Lister / créer tickets (auth — renvoie uniquement les tickets du client)
- GET, PATCH `/api/tickets/<id>/` — Détails / mise à jour (owner ou admin)
- GET, POST `/api/tickets/admin/` — Admin list/create tickets (admin)

---

## 🌐 Realtime (Socket.io)
Namespaces Socket.io (port unique, même serveur HTTP que l'API), authentification par JWT passé en
`auth: { token }` ou `?token=` à la connexion (équivalent du `JWTAuthMiddleware` de Channels) :

- `/ws/realtime/driver` — chauffeurs vérifiés uniquement (lecture + écriture position)
  - Émission client → serveur : `location.update` `{ lat, lng }`
  - Réception (`message`) : `broadcast.location`, `trip.requested`, `trip.assigned`
- `/ws/realtime/drivers` — clients/admin, lecture seule des positions chauffeurs
- `/ws/realtime/trip/<trip_id>` — passager/chauffeur/admin de la course concernée
  - Réception (`message`) : `trip.update` `{ status, trip_id }`

---

## Exemples rapides (curl)
- Envoyer OTP :

```bash
curl -X POST http://127.0.0.1:8000/api/auth/otp/send/ -H 'Content-Type: application/json' -d '{"phone":"+2376xxxxxxx"}'
```

- Vérifier OTP (inscription) :

```bash
curl -X POST http://127.0.0.1:8000/api/auth/otp/verify/ -H 'Content-Type: application/json' -d '{"phone":"+2376xxxxxxx","code":"1234"}'
# retourne {"detail":"Phone verified"} — puis se connecter via /api/auth/token/
```

- Connexion par téléphone + mot de passe :

```bash
curl -X POST http://127.0.0.1:8000/api/auth/token/ -H 'Content-Type: application/json' -d '{"phone":"+2376xxxxxxx","password":"votre_mot_de_passe"}'
```
- Créer une course (avec access token) :

```bash
curl -X POST http://127.0.0.1:8000/api/trips/create/ -H 'Authorization: Bearer <ACCESS>' -H 'Content-Type: application/json' -d '{"origin":"Point A","origin_lat":6.8,"origin_lng":11.5,"destination":"Point B","dest_lat":6.9,"dest_lng":11.6}'
```

---

## 💡 Notes & dépendances importantes
- Base de données : Supabase Postgres — pas de Redis requis (Socket.io gère les rooms en mémoire dans le
  process Node ; pour un déploiement multi-instance, ajouter l'adaptateur Redis de Socket.io).
- Twilio : optionnel — si non configuré, un provider de développement (stub, log console) est utilisé pour l'OTP.
- Auth : JWT maison (access + refresh, signés avec `ACCESS_TOKEN_SECRET`/`REFRESH_TOKEN_SECRET`), pas
  Supabase Auth — `SUPABASE_JWKS_URL` est fourni dans `.env` pour une éventuelle intégration future mais
  n'est pas utilisé par le flux d'authentification actuel (téléphone + mot de passe, identique à l'ancien
  backend Django pour ne pas casser le frontend).

---

## 🛠️ Contribution / développement
- Structure du backend : `backend-node/src/modules/<domaine>/*.routes.ts` (un module par app Django d'origine).
- Schéma de données : `backend-node/prisma/schema.prisma`.
- Pour les modifications realtime, voir `backend-node/src/realtime/socket.ts`.

---
