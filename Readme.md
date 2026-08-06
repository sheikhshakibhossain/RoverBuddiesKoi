# RoverBuddiesKoi — Production AI Availability Management Platform

> **Know who's available before asking.**

RoverBuddiesKoi is an AI-powered real-time availability management platform designed for multi-team engineering organizations (e.g., CAIR Lab, robotics teams, research labs). It automatically parses university class schedule spreadsheets (UCAM XLSX), calculates real-time member availability, enforces semester deadlines, supports skill approval workflows, renders availability heatmaps, and provides natural-language AI schedule search.

---

## 🛠️ Tech Stack

- **Frontend**: Vite, React 19, TypeScript, Tailwind CSS v4, Radix UI, Lucide Icons
- **Backend**: Node.js, Express.js, TypeScript, Prisma ORM, Zod, Helmet, CORS, Rate Limiter, Multer, XLSX
- **Database**: Neon PostgreSQL (Cloud serverless PostgreSQL)
- **Deployment**: Vercel (Backend Serverless + Frontend Web App)
- **Authentication**: JWT (Access Tokens + Database-persisted Refresh Tokens) + bcryptjs Hashing

---

## 📁 Repository Folder Structure

```text
RoverBuddiesKoi/
├── .env.example                # Master environment variables template
├── Readme.md                   # System specifications and documentation
├── backend/
│   ├── .env.example            # Backend environment template
│   ├── package.json            # Node.js backend dependencies & scripts
│   ├── tsconfig.json           # TypeScript configuration
│   ├── vercel.json             # Vercel serverless deployment config
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (PostgreSQL / Neon)
│   │   └── seed.ts             # Production seed script with 10 test users & routines
│   └── src/
│       ├── server.ts           # Express app entrypoint & middleware setup
│       ├── db.ts               # Prisma Client singleton
│       ├── config/             # Zod environment variable validator
│       ├── controllers/        # REST API controllers
│       │   ├── ai.ts           # AI assistant natural language query engine
│       │   ├── auth.ts         # Register, Login, Refresh, Logout, Profile
│       │   ├── heatmap.ts      # Heatmap availability matrix calculator
│       │   ├── members.ts      # Member directory & real-time status API
│       │   ├── routines.ts     # UCAM XLSX schedule upload & parser
│       │   ├── semesters.ts    # Academic terms & deadline configurations
│       │   ├── skills.ts       # Skill catalog & manager approval workflow
│       │   └── teams.ts        # Structural organization metadata
│       ├── middlewares/
│       │   ├── auth.ts         # JWT authentication & session resolution
│       │   ├── rbac.ts         # Role-Based Access Control guards
│       │   └── validate.ts     # Zod request validation wrapper
│       ├── routes/             # Express API route modules
│       ├── services/
│       │   ├── availability.ts # Real-time schedule calculation engine
│       │   └── routineParser.ts# UCAM XLSX spreadsheet parser
│       └── utils/
│           └── errors.ts       # Operational AppError classes
└── frontend/
    ├── package.json            # React frontend dependencies
    ├── tsconfig.json
    ├── vercel.json             # Vercel SPA deployment config
    └── src/
        ├── App.tsx             # Main dashboard shell & navigation
        ├── Auth.tsx            # Auth pages (Login, Register, Role Selector)
        ├── components/
        │   ├── AIChat.tsx      # Natural language AI Assistant drawer
        │   └── ui/             # Radix UI components
        └── lib/
            ├── api.ts          # Centralized API client (JWT refresh + typed endpoints)
            └── user-context.tsx# User session context & RBAC helpers
```

---

## ⚡ Step-by-Step Neon PostgreSQL Setup Guide (Phase 11)

1. **Create Neon Account**:
   - Go to [Neon.tech](https://neon.tech) and sign up for a free cloud PostgreSQL account.
2. **Create Project**:
   - Click **New Project**, name it `roverbuddies-db`, select region (e.g. US East or Frankfurt).
3. **Copy Database Connection String**:
   - In Neon Dashboard, navigate to **Dashboard** -> **Connection Details**.
   - Select **Pooled connection** string.
   - Copy string formatted like:
     `postgresql://<username>:<password>@<endpoint>.neon.tech/neondb?sslmode=require`
4. **Paste Environment Variable**:
   - Create `backend/.env` file.
   - Set `DATABASE_URL="postgresql://<username>:<password>@<endpoint>.neon.tech/neondb?sslmode=require"`.
5. **Run Migrations & Seed**:
   ```bash
   cd backend
   npm install
   npx prisma migrate dev --name init
   npm run prisma:seed
   ```
6. **Verify Tables**:
   - Open Neon Dashboard -> **Tables** tab.
   - Verify 10 tables created: `Organization`, `Team`, `Subteam`, `User`, `UserSubteam`, `RefreshToken`, `Semester`, `ClassRoutine`, `Skill`, `UserSkill`.

---

## 🚀 Step-by-Step Vercel Deployment Guide (Phase 12 & 13)

### Deploying Backend to Vercel:
1. Install Vercel CLI or connect GitHub repository to Vercel:
   ```bash
   npm i -g vercel
   cd backend
   vercel login
   vercel
   ```
2. In Vercel Project Settings -> **Environment Variables**:
   - `DATABASE_URL`: Your Neon PostgreSQL URL.
   - `JWT_SECRET`: Random 64-character secret key.
   - `JWT_REFRESH_SECRET`: Random 64-character refresh key.
   - `NODE_ENV`: `production`
   - `CLIENT_URL`: Your frontend Vercel deployment URL (e.g. `https://roverbuddies-app.vercel.app`).
3. Deploy to production:
   ```bash
   vercel --prod
   ```
4. Verify backend health endpoint:
   - Visit `https://<your-backend-vercel-url>/api/health`.
   - Returns `{ "status": "ok", "service": "RoverBuddiesKoi API" }`.

### Deploying Frontend to Vercel:
1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```
2. Set Environment Variable in Vercel Project Settings:
   - `VITE_API_BASE_URL`: Your backend Vercel API URL (e.g. `https://roverbuddies-backend.vercel.app`).
3. Deploy:
   ```bash
   vercel --prod
   ```

---

## 🔑 Default Seed Demo User Credentials

All seed accounts are initialized with password: **`Password123!`**

| Role | Email | Scope |
| :--- | :--- | :--- |
| **Organization Owner** | `tanvir@cairlab.org` | All teams (UMRT, URRT, Team XYZ) |
| **Team Manager** | `rezwan@cairlab.org` | URRT Team |
| **Subteam Manager** | `nusrat@cairlab.org` | UMRT -> Electrical Subteam |
| **Member** | `aryan@cairlab.org` | UMRT -> Software Subteam |

---

## 📚 REST API Reference (Phase 8)

### Authentication
- `POST /api/auth/register` — Register user profile (supports XLSX routine file attachment)
- `POST /api/auth/login` — Login user, returns access & refresh tokens
- `POST /api/auth/refresh` — Issue new access token using refresh token
- `POST /api/auth/logout` — Revoke active refresh token
- `GET /api/auth/me` — Fetch active session profile

### Members & Availability
- `GET /api/members` — Fetch scoped list of members with real-time availability status
- `GET /api/members/:id` — Fetch member profile with schedule

### Routines & Schedules
- `POST /api/routines/upload` — Upload UCAM XLSX schedule spreadsheet
- `GET /api/routines/me` — Retrieve logged-in user's routine schedule

### Skills & Approvals
- `GET /api/skills` — Get catalog of skills & user's skills
- `POST /api/skills/request` — Submit skill request
- `GET /api/skills/pending` — Manager view pending skill requests
- `PUT /api/skills/:id/approve` — Approve skill request
- `PUT /api/skills/:id/reject` — Reject skill request

### Availability Heatmap
- `GET /api/heatmap` — Generate organization/team/subteam availability matrix counts across hours

### AI Assistant
- `POST /api/ai/chat` — Process natural language queries regarding availability, skills, and meeting times
