# SLT ComTrack 🚀

A modern, responsive frontend application for the **SLT Complaint Tracking System**. 

This repository contains the complete User Interface (UI) built from the Figma designs, structured cleanly and ready for backend API integration.

## 🛠️ Tech Stack
* **Framework:** [React 18](https://react.dev/)
* **Build Tool:** [Vite](https://vitejs.dev/)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)

## ✨ Key Features
* **Dashboard:** High-level analytics and overview of complaint statuses.
* **Intake (Register Complaint):** Form to register new complaints from various sources (e.g., TRC, 1212- Email, CEO's Office).
* **Queue:** Filterable and sortable list of active complaints.
* **Detail View:** Deep dive into specific complaint histories and actions.
* **GM Feedback & Requests:** Specialized views for General Manager interactions.
* **Reports:** Data visualization for complaint outcomes and throughput.
* **Admin:** Configuration for source mapping and system settings.

## 🚀 Getting Started (Local Development)

To run this project on your local machine:

**1. Install Dependencies**
```bash
npm install
```

**2. Start the Development Server**
```bash
npm run dev
```
*The app will be available at `http://localhost:5173/`.*

**3. Build for Production**
```bash
npm run build
```
*This generates the optimized static files in the `dist/` folder.*

---

## 🔗 Backend Developer Handoff Guide (.NET Integration)

This frontend is designed to be easily connected to a .NET Web API. The UI and the data logic are completely decoupled.

**Where to look:**
1. **`src/data.ts` (The Models)**
   * This file contains all the TypeScript `interfaces` and `types` (e.g., `Complaint`, `Source`, `Priority`). 
   * **Action:** Use these interfaces to create your matching C# Models/DTOs in your .NET backend.

2. **`src/store.tsx` (The State & API calls)**
   * Currently, this file acts as a "Mock Backend" using React Context so the UI can function without a real database. 
   * It handles functions like `register()`, `update()`, and `sendRequest()`.
   * **Action:** You do not need to touch the UI components. Simply replace the mock logic inside this file with actual HTTP requests (e.g., `fetch` or `axios`) to your .NET endpoints. As long as `store.tsx` provides the expected data format, the entire UI will automatically work.

## 📁 Project Structure Highlights
* `src/views/` - Contains all the main page components (Dashboard, Intake, Queue, etc.)
* `src/components/` - Reusable UI components (Sidebar, Topbar, generic UI elements).
* `src/store.tsx` - Centralized state management (Integration Point).
* `src/data.ts` - Data types, mock data, and constants.