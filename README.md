<div align="center">

# 🚀 WorkTrack Pro

### Enterprise Workforce Monitoring, Productivity & Compliance Platform

A modern, full-stack enterprise platform designed for organizations managing remote teams. Features real-time shift compliance monitoring, screen telemetry, GPS geocoding, automated attendance classification, and an advanced date-grouped admin intelligence dashboard.

<br />

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-worktrack--pro--gilt.vercel.app-0070F3?style=for-the-badge&logo=vercel&logoColor=white)](https://worktrack-pro-gilt.vercel.app)
[![API Status](https://img.shields.io/badge/⚡%20Backend%20API-Online-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://worktrack-backend-knbp.onrender.com)
[![Database](https://img.shields.io/badge/🐘%20Neon%20Postgres-Serverless-00E599?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)

<br />

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-Backend-000000?style=flat-square&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=flat-square&logo=postgresql&logoColor=white)

<br />

**[🌐 Visit Live Portal](https://worktrack-pro-gilt.vercel.app)** • **[⚡ Backend Service](https://worktrack-backend-knbp.onrender.com)** • **[📖 Architecture](#-system-architecture)** • **[🚀 Quick Start](#-local-development-setup)**

</div>

---

## 📌 Executive Summary

**WorkTrack Pro** is built for modern Work-From-Home (WFH) operations requiring strict transparency, proof-of-work, and automated compliance. It prevents productivity fraud through screen telemetry locks, browser visibility detection, idle timeouts, and GPS verification — while providing an intuitive, polished user experience for employees and administrators alike.

---

## ✨ Key Platform Features

### 🛡️ 1. Anti-Tampering & Compliance Engine
* **Screen Sharing Verification:** Shifts require active browser screen stream authorization (`MediaStream` API). Stopping screen share triggers an instant compliance breach and automatic clock-out.
* **Inactivity & Idle Guard:** Tracks mouse movement, clicks, and keystrokes. Triggers progressive alerts and auto-clocks out employees if idle limit is exceeded.
* **Background Tab Detection:** Uses HTML5 Page Visibility API to detect when workspace tabs are minimized or hidden for extended durations.
* **Single-Shift Daily Lockout:** Prevents unauthorized shift restarts or session manipulation once a shift is finalized for the day.

### 📊 2. Smart Attendance & Shift Classification
* **Automated Status Engine:**
  * 🟢 **Present (Full Day):** Work duration $\ge$ 8.5 hours
  * 🟡 **Half Day:** Work duration between 4.0 and 8.49 hours
  * 🔴 **Absent:** Work duration $<$ 4.0 hours (or missed clock-in)
* **Break Management:** Configurable short breaks (e.g. 3 breaks $\times$ 15 mins) and lunch breaks (45 mins) with countdowns and grace limit notifications.
* **Daily Report Upload:** Employees submit end-of-shift PDF accomplishment reports, validated and securely linked to shifts.

### 📍 3. Live Geolocation & Address Reverse-Geocoding
* **Real-time GPS Capture:** Captures exact latitude and longitude at both Clock-In and Clock-Out.
* **Physical Address Resolution:** Converts raw GPS coordinates into human-readable physical addresses using OpenStreetMap Nominatim reverse geocoding.
* **Admin Audit Mapping:** Admins can view physical start and end locations directly from the dashboard.

### 📸 4. Screen Telemetry & Desktop Snapshots
* **Automated Frame Captures:** Periodically records workspace snapshots directly from the employee's active screen stream track.
* **Protected File Delivery:** Screen captures are secured behind JWT authorization — only administrators and the respective employee can view files.
* **Storage Optimization Sweep:** Automated daily background routine purges screenshots older than 7 days to preserve storage efficiency.

### 📅 5. Date-Grouped Team Shift Directory (Admin Intelligence)
* **Chronological Classification:**
  * 🔵 **Today's Shifts:** Displays active workers first with pulsing green live indicators and duration timers.
  * ⬜ **Historical Records:** Grouped by date (newest first) with expandable employee shift summaries, break logs, and PDF downloads.
  * 🔘 **Not Started Today:** Clearly identifies scheduled employees who have not clocked in yet.
* **Search & Filter:** Instant search by employee name, ID, or active shift status.

---

## 👥 Role-Based Capabilities

| Feature / Capability | 👨‍💻 Employee Portal | 👑 Admin Intelligence Dashboard |
|---|:---:|:---:|
| **Shift Clock-In / Clock-Out** | ✅ | ❌ *(Audit Only)* |
| **GPS Geolocation Verification** | ✅ *(Automatic)* | ✅ *(View on Map / Address)* |
| **Active Screen Sharing Stream** | ✅ *(Mandatory)* | ✅ *(Telemetry View)* |
| **Task Assignment & Progress** | ✅ | ✅ *(Real-time Inspection)* |
| **Break & Lunch Timers** | ✅ | ✅ *(Live Status)* |
| **PDF Shift Report Submission** | ✅ | ✅ *(Download & Verify)* |
| **Team-Wide Live Shift Directory** | ❌ | ✅ *(Date-Grouped)* |
| **Employee Screen Snapshots** | View Own | Full Team Audit Grid |
| **Shift Adjustment & Overrides** | ❌ | ✅ |
| **Attendance Analytics & History** | View Own (30 Days) | Global Team Overview |

---

## 🛠️ Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                       WORKTRACK PRO                         │
├──────────────────────────────┬──────────────────────────────┤
│  Frontend Layer              │  Backend & API Layer         │
│  • React 18 + TypeScript     │  • Node.js + Express.js      │
│  • Vite Build Engine         │  • TypeScript (Strict Mode)  │
│  • Tailwind CSS Design Sys   │  • Prisma ORM v7             │
│  • Lucide & React Icons      │  • JSON Web Tokens (JWT)     │
│  • Vercel Global Edge CDN    │  • Multer File Storage       │
├──────────────────────────────┼──────────────────────────────┤
│  Database & Infrastructure   │  Security & Telemetry        │
│  • PostgreSQL 16+            │  • bcrypt Password Hashing   │
│  • Neon Serverless Postgres  │  • MediaStream Screen API    │
│  • Render Web Services       │  • HTML5 Geolocation API     │
│  • Automated Cron Sweepers   │  • Page Visibility API       │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 📂 Monorepo Architecture

```text
worktrack-pro/
├── README.md                      # Comprehensive documentation & setup guide
│
├── wfh-frontend/                  # React + TypeScript + Vite Frontend
│   ├── index.html                 # Main HTML entry point
│   ├── vite.config.ts             # Vite configuration
│   ├── tailwind.config.js         # Tailwind CSS styling tokens
│   ├── src/
│   │   ├── App.tsx                # App routing & session security
│   │   ├── main.tsx               # DOM mount point
│   │   ├── config.ts              # API base URL & runtime config
│   │   ├── components/            # Reusable UI components
│   │   │   ├── Navbar.tsx         # Responsive top navigation header
│   │   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   │   └── ProtectedRoute.tsx # Route-level authentication guard
│   │   ├── pages/                 # Main page views
│   │   │   ├── LoginPage.tsx      # Secure employee/admin login
│   │   │   ├── EmployeeDashboard.tsx # Employee WFH workstation
│   │   │   └── AdminDashboard.tsx    # Admin monitoring command center
│   │   └── global.css             # Global CSS styles & animations
│   └── package.json
│
└── wfh_backend/                   # Node.js + Express + Prisma Backend
    ├── prisma/
    │   ├── schema.prisma          # Database schema models
    │   └── migrations/            # SQL migration history & seed data
    ├── src/
    │   ├── server.ts              # HTTP server & cron initialization
    │   ├── app.ts                 # Express application & middleware
    │   ├── config/
    │   │   └── app.config.ts      # Server environment configuration
    │   ├── controllers/           # API business logic
    │   │   ├── auth.controller.ts       # Authentication & JWT issuance
    │   │   ├── shift.controller.ts      # Shift, GPS & telemetry logic
    │   │   ├── admin.controller.ts      # Team feed & screenshots audit
    │   │   ├── config.controller.ts     # Public app settings endpoint
    │   │   ├── file.controller.ts       # Protected file downloads
    │   │   └── screenshot.controller.ts # Screen capture uploads
    │   ├── middleware/            # Security middleware
    │   │   └── auth.middleware.ts       # JWT token verification
    │   └── routes/                # Express API routes
    │       ├── auth.routes.ts
    │       ├── shift.routes.ts
    │       ├── admin.routes.ts
    │       ├── config.routes.ts
    │       ├── file.routes.ts
    │       └── screenshot.routes.ts
    ├── public/uploads/            # Uploaded reports & screenshots
    └── package.json
```

---

## 🚀 Local Development Setup

Follow these steps to run the complete stack locally on your machine:

### 1. Clone Repository
```bash
git clone https://github.com/Riyakumari-source/worktrack-pro.git
cd worktrack-pro
```

### 2. Configure Backend
```bash
cd wfh_backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Update .env with your local PostgreSQL credentials

# Generate Prisma Client & Run Migrations
npx prisma generate
npx prisma migrate deploy

# Start backend dev server (Runs on port 5000)
npm run dev
```

### 3. Configure Frontend
Open a new terminal:
```bash
cd wfh-frontend

# Install dependencies
npm install

# Start frontend dev server (Runs on port 5173)
npm run dev
```

Visit **`http://localhost:5173`** in your browser!

---

## ⚙️ Environment Configuration

### Backend (`wfh_backend/.env`)
| Variable | Description | Example |
|---|---|---|
| `PORT` | Backend server port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `JWT_SECRET` | Secret key for signing auth tokens | `super_secret_jwt_key_2026` |
| `CORS_ORIGIN` | Allowed CORS origins | `*` or `http://localhost:5173` |
| `AUTO_CLOCK_OUT_HOURS` | Standard shift duration target (hrs) | `8.5` |
| `HALF_DAY_HOURS` | Half-day threshold (hrs) | `4.0` |
| `IDLE_TIMEOUT_MINUTES` | Idle timeout trigger (mins) | `7` |
| `SCREENSHOT_INTERVAL_MINUTES` | Screen capture frequency (mins) | `10` |

### Frontend (`wfh-frontend/.env`)
| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Target Backend API URL | `http://localhost:5000` (Local) / `https://worktrack-backend-knbp.onrender.com` (Prod) |

---

## 📡 REST API Reference

| Method | Endpoint | Access | Description |
|:---:|---|:---:|---|
| `POST` | `/api/auth/login` | Public | Authenticate user & issue JWT token |
| `GET` | `/api/config` | Public | Retrieve active branding & shift rules |
| `POST` | `/api/shifts/clock-in` | Employee | Start WFH shift with GPS & address |
| `POST` | `/api/shifts/clock-out` | Employee | End WFH shift with final coordinates |
| `GET` | `/api/shifts/active` | Employee | Recover current active shift session |
| `POST` | `/api/shifts/break/start` | Employee | Start short or lunch break timer |
| `POST` | `/api/shifts/break/end` | Employee | Conclude break and resume shift |
| `POST` | `/api/shifts/report/upload` | Employee | Submit end-of-shift PDF report |
| `POST` | `/api/telemetry/screenshot/upload` | Employee | Upload live screen capture frame |
| `GET` | `/api/admin/employees-feed` | Admin | Fetch date-grouped live team status feed |
| `GET` | `/api/admin/employee/:id/screenshots` | Admin | Audit 24h desktop screenshots of employee |
| `GET` | `/api/admin/daily-reports` | Admin | List all uploaded shift PDF reports |
| `GET` | `/api/files/download/:type/:filename` | Protected | Secure stream for screenshots & PDFs |

---

## 🌐 Cloud Deployment Architecture

WorkTrack Pro is configured for zero-downtime, serverless cloud deployment:

* **Frontend:** Hosted on **[Vercel](https://vercel.com)** with global Edge network caching.
* **Backend:** Hosted on **[Render](https://render.com)** Web Services with automated restart and health checks.
* **Database:** Hosted on **[Neon](https://neon.tech)** Serverless PostgreSQL with auto-scaling and connection pooling.

---

## 🔒 Security & Privacy

* **Zero Plaintext Passwords:** All user passwords hashed via `bcrypt` with salt rounds.
* **Stateless Authorization:** Secure JWT tokens verified on all protected API routes.
* **Path Traversal Protection:** File download endpoints validate filenames and prevent directory traversal (`path.basename`).
* **Role-Based Guards:** Enforces strict role checks (`ADMIN` vs `EMPLOYEE`) at both client and database level.

---

<div align="center">

Made with ❤️ by **[Riya Kumari](https://github.com/Riyakumari-source)**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=for-the-badge&logo=linkedin)](https://linkedin.com)
[![GitHub](https://img.shields.io/badge/GitHub-Profile-181717?style=for-the-badge&logo=github)](https://github.com/Riyakumari-source)

</div>
