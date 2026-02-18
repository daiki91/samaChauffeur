# samaChauffeur

Une application de type ride‑hailing (backend Django + API REST + WebSockets + frontend React/Vite).

## 🚀 Présentation
- Backend : Django 6, Django REST Framework, Channels (ASGI) — API REST et WebSockets.
- Frontend : React + TypeScript + Vite.
- Base de données : MySQL (défaut), Channels utilise Redis pour le canal de messages.

---

## ⚙️ Démarrage rapide (développement)
Prérequis : Python 3.10+, Node.js & npm, MySQL, Redis.

1. Installer les dépendances backend

```bash
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r backend/requirements.txt
```

2. Configurer la base de données et (optionnel) Twilio
- Voir `backend/config/settings.py` pour les valeurs par défaut.
- Variables utiles (export / set) :
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
  - `VITE_API_BASE` (frontend)
  - Redis doit être disponible sur `127.0.0.1:6379` (ou ajuster `CHANNEL_LAYERS`).

3. Migrer et lancer le serveur Django (ASGI pour WebSockets)

```bash
cd backend
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
# Pour ASGI + Channels en prod on utilise daphne/uvicorn (ex. `daphne config.asgi:application`)
```

4. Lancer le frontend

```bash
cd frontend
npm install
npm run dev
```

---

## ✅ Tests
- Lancer la suite Django :

```bash
cd backend
python manage.py test
```

---

## 🔐 Authentification
- JWT (access + refresh) — endpoints fournis par `accounts`.
- OTP (envoi / vérification) **uniquement pour vérifier le numéro lors de l'inscription**. Après vérification la connexion se fait par **numéro de téléphone + mot de passe** (`/api/auth/token/`).

---

## 📡 API — Liste complète des endpoints
Base URL API : `/api/`

Remarque : les chemins ci‑dessous incluent le préfixe `/api` tel que défini dans `backend/config/urls.py`.

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

### Admin / UI
- Django admin : `/admin/`

---

## 🌐 WebSocket (Realtime)
URL (ASGI / Channels):
- `ws://<host>/ws/realtime/driver/` — Consumer pour chauffeurs vérifiés
  - Auth requis (user authentifié + profil chauffeur vérifié)
  - Messages envoyés par client (ex.) :
    - `{ "type": "location.update", "driver_id": <id>, "lat": <float>, "lng": <float> }`
  - Messages reçus : `broadcast.location`, `trip.requested`, `trip.assigned`, etc.

- `ws://<host>/ws/realtime/drivers/` — Consumer lecture pour clients/admin (recevoir positions)
- `ws://<host>/ws/realtime/trip/<trip_id>/` — Notifications de la course (passager/chauffeur/admin)

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
- Redis requis pour Channels (`CHANNEL_LAYERS` dans `backend/config/settings.py`).
- Base MySQL configurée par défaut dans `settings.py` — modifiez les identifiants pour votre environnement.
- Twilio : optionnel — si non configuré, un provider de développement (stub) est utilisé pour OTP.

---

## 🛠️ Contribution / développement
- Respecter les tests unitaires (voir `backend/*/tests.py`).
- Pour les modifications ASGI/WebSocket, vérifier `backend/realtime/consumers.py` et `routing.py`.

---

Si vous voulez, je peux :
1) Générer un fichier Postman / OpenAPI (Swagger) listant tous les endpoints. ✅
2) Ajouter des exemples de payload détaillés pour chaque endpoint. ✅

Dites-moi quelle option vous préférez. 
