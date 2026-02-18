# 🚗 SamaChauffeur – Fullstack Django & React (Vite)

Projet fullstack avec :
- **Backend** : Django (Python)
- **Frontend** : React + Vite.js
- **Base de données** : MariaDB

---

---

## ⚙️ Prérequis

Avant de commencer, assure-toi d’avoir installé :

- Python ≥ 3.10
- Node.js ≥ 18
- npm ou yarn
- Git

Vérification :

```bash
python --version
node --version
npm --version
git --version
````

---

## 📥 Récupérer le projet depuis GitHub

git clone https://github.com/biramth/samaChauffeur.git

cd samaChauffeur


---

## 🧠 Backend – Django

### 📂 Accéder au dossier backend

```bash
cd backend
```

---

### 🐍 Créer un environnement virtuel

#### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

#### Linux / macOS

```bash
python3 -m venv venv
source venv/bin/activate
```

---

### 📦 Installer les dépendances backend

```bash
pip install -r requirements.txt
```

---

### 🔄 Initialiser la base de données

```bash
python manage.py migrate
```

---

### ▶️ Lancer le serveur Django

```bash
python manage.py runserver
```

Le backend sera accessible à l’adresse :

```
http://127.0.0.1:8000
```

---

## 🎨 Frontend – React + Vite.js

### 📂 Accéder au dossier frontend

```bash
cd ../frontend
```

---

### 📦 Installer les dépendances frontend

```bash
npm install
```

---

### ▶️ Lancer le serveur frontend

```bash
npm run dev
```

Le frontend sera accessible sur :

```
http://localhost:5173
```