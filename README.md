<div align="center">

# 🚀 WorkTrack Pro

### Enterprise Workforce Monitoring & Productivity Intelligence Platform

A **full-stack SaaS-style workforce monitoring system** built using  
**React, TypeScript, Node.js, Express.js, Prisma ORM, and PostgreSQL**, designed for remote team tracking, attendance automation, and compliance monitoring.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-Backend-black?logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-worktrack--pro--gilt.vercel.app-0070F3?style=for-the-badge)](https://worktrack-pro-gilt.vercel.app)

</div>

> **🌐 Live Application URL:** [https://worktrack-pro-gilt.vercel.app](https://worktrack-pro-gilt.vercel.app)  
> **⚡ Live Backend API:** [https://worktrack-backend-knbp.onrender.com](https://worktrack-backend-knbp.onrender.com)

---

# 📖 Project Overview

**WorkTrack Pro** is a SaaS-based enterprise workforce monitoring and compliance system designed for organizations managing remote employees.

It helps companies to:
- Track employee working hours accurately  
- Ensure WFH compliance and transparency  
- Detect productivity fraud using anti-tampering logic  
- Automate attendance classification  
- Monitor employee geolocation during work hours  

This project demonstrates a **real-world enterprise system architecture** combining monitoring, automation, and secure backend design.

---

# ✨ Key Features

## 🛡️ Compliance & Anti-Tamper System
- Real-time screen session monitoring (Media Stream API)
- Detects:
  - Page refresh attempts  
  - Screen sharing interruption  
  - Session manipulation  
- Auto actions:
  - Workspace lock on violation  
  - Forced logout  
  - Compliance breach logging  

---

## 📊 Smart Attendance Engine
- Automatic shift classification:
  - ✅ Present → 8.5+ hours  
  - 🟡 Half Day → 4–8.49 hours  
  - ❌ Absent → < 4 hours  

- Cron-based automation:
  - Auto-mark missing shifts as Absent  
  - Daily attendance validation  

- Employee analytics:
  - 30-day attendance history  
  - Break tracking  
  - Task completion ratio  

---

## 📍 Geolocation Tracking System
- Captures GPS at:
  - Clock-in  
  - Clock-out  
- Converts coordinates → human-readable address  
- Admin can track employees on map view  

---

## 🧹 System Optimization
- Automated cron cleanup system  
- Deletes:
  - Screenshots older than 7 days  
  - Logs & temporary files  
- Ensures scalable performance  

---

# 🛠️ Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS

### Backend
- Node.js
- Express.js
- TypeScript
- Prisma ORM

### Database
- PostgreSQL

### Others
- Multer (File Uploads)
- REST APIs

---

# 📂 Project Structure

```text
WorkTrack-Pro/
│
├── wfh_backend/
│   ├── src/
│   ├── prisma/
│   ├── routes/
│   ├── controllers/
│   ├── server.ts
│   └── package.json
│
├── wfh-frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   ├── App.tsx
│   └── package.json

---

