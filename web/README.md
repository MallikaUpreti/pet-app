# PawCare HQ Frontend

Production-grade React + Vite frontend for the repository-backed veterinary pet-care platform.

## Stack

- React + Vite
- TailwindCSS
- Zustand
- Axios
- React Hook Form
- Recharts
- Lucide React
- Framer Motion

## Screens

- Landing page
- Login
- Signup
- Pet onboarding quiz
- Owner dashboard
- Vet dashboard
- Pet profile
- Pet health report
- Vaccination tracker
- Medication tracker
- Weight tracker
- Diet planner
- AI chat
- Appointment booking
- Calendar
- Messages
- Notifications
- Settings
- Architecture overview

## Backend alignment

The UI was designed against these existing backend areas in the original repo:

- Auth and role management
- Pets and owner profiles
- Vet profiles and online availability
- Appointments and appointment reports
- Diet plans and meal logs
- Medications
- Vaccinations
- Records
- Health logs
- Owner and vet notifications
- Chat requests, chats, messages, SSE message stream

## Run in VS Code

1. Open `C:\Users\hp\Documents\Playground\repo\web` in VS Code.
2. Run `npm.cmd install`
3. Run `npm.cmd run dev`
4. Open the local Vite URL shown in the terminal.

## Backend integration

- `src/lib/api.js` uses the real Flask API, not mock data.
- Auth is bearer-token based and persists through local storage.
- Frontend reads live pets, appointments, vaccinations, medications, records, diet plans, meals, notifications, chats, and vet patient data.
- Set `VITE_API_BASE_URL` if your backend is not running on `http://localhost:5000/api`.

## Backend updates included

- Added CORS for `/api/*`
- Added notification API endpoints
- Added backend AI advice endpoint backed by pet data
- Added missing pet intake fields and vet availability fields to the SQL schema
