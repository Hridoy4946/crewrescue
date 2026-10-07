# CrewRescue AI — Step-by-Step System Run Guide

> Local development setup and full system walkthrough

---

## Prerequisites

Make sure the following are installed before you begin:

| Tool | Minimum Version | Check |
|---|---|---|
| **Node.js** | v18+ | `node --version` |
| **npm** | v9+ | `npm --version` |
| **MongoDB** | v6+ | `mongod --version` |
| **Redis** | v7+ | `redis-server --version` |
| **Git** | any | `git --version` |

---

## Step 1 — Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd crewrescue

# Install root workspace packages
npm install

# Install backend packages
cd backend/api
npm install
cd ../..

# Install frontend packages
cd frontend/web
npm install
cd ../..
```

---

## Step 2 — Set Up Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example backend/api/.env
```

Open `backend/api/.env` and set:

```env
NODE_ENV=development
PORT=5000

MONGODB_URI=mongodb://localhost:27017/crewrescue
REDIS_URL=redis://localhost:6379

# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=<your_secret_here>
JWT_REFRESH_SECRET=<different_secret_here>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Optional: get a free key at https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

CORS_ORIGINS=http://localhost:5173,http://localhost:5174

SEED_ORG_NAME=DhakaPower Utilities
SEED_ADMIN_EMAIL=admin@dhakapower.bd
SEED_ADMIN_PASSWORD=Admin@CrewRescue2025
```

> **Important:** Never commit `.env` to Git — it is already in `.gitignore`

---

## Step 3 — Start MongoDB

**Windows:**
```bash
mongod --dbpath C:\data\db
```

**Linux / Mac:**
```bash
sudo systemctl start mongod
```

Verify:
```bash
mongo --eval "db.adminCommand({ ping: 1 })"
```

---

## Step 4 — Start Redis

**Windows:**
```bash
redis-server
```

**Linux / Mac:**
```bash
sudo systemctl start redis
```

Verify:
```bash
redis-cli ping
# Expected: PONG
```

---

## Step 5 — Seed the Database

Run this once to load initial data:

```bash
cd backend/api
node scripts/seed.js
cd ../..
```

This creates the admin account, 100 technicians, 500 incidents, 8 depots, and 15 knowledge base documents.

---

## Step 6 — Start the Backend API

```bash
cd backend/api
npm run dev
```

Or from the project root:
```bash
npm run dev:api
```

API runs at **http://localhost:5000**

Verify:
```bash
curl http://localhost:5000/health
# Expected: {"status":"ok","service":"crewrescue-api"}
```

---

## Step 7 — Start the Frontend

Open a new terminal:

```bash
cd frontend/web
npm run dev
```

Or from root:
```bash
npm run dev:web
```

Web app runs at **http://localhost:5173**

---

## Step 8 — Run Both Together (Shortcut)

```bash
npm run dev:all
```

This starts the API and frontend concurrently in one terminal.

---

## Step 9 — Log In

Open **http://localhost:5173** in your browser and log in:

```
Email:    admin@dhakapower.bd
Password: Admin@CrewRescue2025
```

---

## Step 10 — Feature Walkthrough

### Dashboard (`/`)
View live stat cards, the GIS incident map, SLA health bar, and workforce status in real time.

### Live Map (`/map`)
Full-screen Leaflet map. Toggle layers for Technicians, Incidents, and Depots. Click any marker for details. Auto-refreshes every 30 seconds.

### Incidents (`/incidents`)
Browse work orders, filter by severity or status, create new incidents, and assign technicians directly.

### Technicians (`/technicians`)
See the crew roster with availability status, territory assignments, skill matrix, and performance ratings.

### Optimization (`/optimize`)
Run **Simulated Annealing** or **Genetic Algorithm** dispatch optimization. View real-time progress via WebSocket and before/after SLA improvement scores.

### Emergency Command (`/emergency`)
Declare an L1–L4 emergency and activate system-wide priority overrides. Resolve and return to normal L0 operations.

### AI Assistant (`/assistant`)
Full conversational chat powered by Gemini. Ask operational questions or get field procedures. Falls back to live DB telemetry if API quota is reached.

### Copilot RAG (`/copilot`)
Search the indexed equipment manual knowledge base. Supports short keyword queries like `hvac`, `transformer`, `fiber`. Sources are cited per answer.

### AI Triage (`/ai`)
Paste an incident description to auto-classify: category, severity, required skills, parts, and SLA urgency.

### Analytics (`/analytics`)
SLA prediction scores, historical performance trends, and technician efficiency breakdown.

---

## Step 11 — Run Automated Tests

```bash
cd backend/api
node scripts/funcTest.mjs
```

Expected result:
```
FUNCTIONAL TEST SUMMARY
  PASSED : 35
  FAILED : 0
  TOTAL  : 35
```

---

## Useful API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | API health check |
| GET | `/metrics` | Prometheus runtime metrics |
| POST | `/api/auth/login` | Authenticate (returns JWT) |
| GET | `/api/incidents` | List all incidents |
| GET | `/api/technicians` | List all technicians |
| GET | `/api/dashboard/stats` | Live dashboard telemetry |
| POST | `/api/ai/chat` | Multi-turn AI assistant |
| POST | `/api/ai/copilot` | RAG knowledge query |
| POST | `/api/ai/triage` | Incident auto-classification |
| POST | `/api/optimization/run` | Queue optimization job |

---

## Troubleshooting

**Port in use:**
```bash
npx kill-port 5000
npx kill-port 5173
```

**MongoDB error:** Make sure `mongod` is running and `MONGODB_URI` in `.env` is correct.

**Redis error:** Make sure `redis-server` is running and `REDIS_URL` in `.env` is correct.

**AI responses show fallback telemetry:** The Gemini API free-tier rate limit was reached. Wait a few minutes — the system will resume live AI responses automatically.

**Blank screen after login:** Hard refresh (`Ctrl+Shift+R`) or clear browser cache.
