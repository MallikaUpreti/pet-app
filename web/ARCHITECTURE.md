# PawCare HQ Architecture

## 1. Repository analysis

Source analyzed: `C:\Users\hp\Documents\Playground\repo`

### Backend-supported features found in the repository

#### Authentication and security

- User signup and login
- Role-based accounts: `owner`, `vet`
- Password hashing with Werkzeug
- Token-based auth using `AuthTokens`
- Protected API routes with bearer token checks
- Owner-only and vet-only route protection

#### User and profile features

- Owner profile update
- Vet profile update
- Vet profile fields:
  - clinic name
  - license number
  - clinic phone
  - bio
  - online status
  - optional slot availability fields used in server templates: start hour, end hour, available days

#### Pet management

- Create pet
- List pets
- View pet detail
- Delete pet with relational cleanup
- Pet fields in schema:
  - name
  - species
  - breed
  - age in months
  - weight in kg
  - allergies
  - diseases
  - photo URL

#### Appointment system

- Owner can create appointments
- Vet can update appointment status
- Appointment states:
  - Pending
  - Scheduled
  - In Progress
  - Completed
  - Declined
- Appointment report availability flag
- Appointment detail updates trigger notifications
- Appointment report read and upsert APIs

#### Medical tracking

- Appointment reports with:
  - diagnosis
  - medications and doses
  - diet recommendation
  - general recommendation
- Medical records table for uploaded or linked files
- Vet patient record view combines records plus appointment reports

#### Vaccination tracking

- Vaccination listing and creation
- Vaccine fields:
  - name
  - due date
  - status
  - notes
- Built-in core vaccine suggestions for dog and cat
- Vaccination reminders generated into owner notifications

#### Medication tracking

- Medication listing and creation
- Medication fields:
  - name
  - dosage
  - frequency
  - start date
  - end date
  - notes
- Vet report save flow also syncs medications into the table

#### Weight and health tracking

- Pet weight stored on pet profile
- Health logs support:
  - mood
  - appetite
  - notes
- Dashboard calculates simple health scoring using weight, vaccines, meds, and diet freshness

#### Diet planning

- Diet plan list/create/update
- Diet plan generate endpoint
- Diet plan schema:
  - title
  - details
  - calories
  - allergies
  - optional vet user id
- Meal schedule entities:
  - meals
  - meal logs
  - mark meal as fed

#### Messaging and communication

- Owner creates chat request
- Vet accepts or declines chat request
- Per owner-vet-pet chat threads
- Message history
- Message send endpoint
- SSE stream endpoint for live chat updates
- Attachment support exists in server-rendered flows

#### Notifications

- Owner notifications table
- Vet notifications table
- Notification types include:
  - appointment_new
  - appointment_update
  - appointment_change
  - vaccination_reminder
  - report_added
  - report_updated
  - chat_request
  - chat_message

#### Vet workflow

- Vet dashboard
- Vet patients list
- Vet appointment management
- Vet analytics summary
- Vet patient records with longitudinal history
- Online listing of available vets

### Database structures extracted

- `Users`
- `VetProfiles`
- `Pets`
- `Appointments`
- `DietPlans`
- `Medications`
- `Vaccinations`
- `Records`
- `AppointmentReports`
- `AuthTokens`
- `ChatRequests`
- `Chats`
- `Messages`
- `HealthLogs`
- `Meals`
- `MealLogs`
- `OwnerSettings`
- `OwnerNotifications`
- `VetNotifications`

## 2. UI modules designed from those features

- Marketing and role entry
- Auth and signup funnel
- Pet onboarding quiz
- Owner dashboard
- Vet dashboard
- Pet profile
- Pet health report
- Vaccination tracker
- Medication tracker
- Weight tracker
- Diet planner
- AI pet guidance chat
- Appointment booking
- Calendar and availability
- Messages and threads
- Notifications inbox
- Settings
- Vet patients
- Vet reports

## 3. Page hierarchy

- `/`
- `/auth/login`
- `/auth/signup`
- `/quiz`
- `/owner/dashboard`
- `/owner/pets`
- `/owner/report`
- `/owner/vaccinations`
- `/owner/medications`
- `/owner/weight`
- `/owner/diet-planner`
- `/owner/ai-chat`
- `/owner/appointments`
- `/owner/calendar`
- `/owner/messages`
- `/owner/notifications`
- `/owner/settings`
- `/vet/dashboard`
- `/vet/patients`
- `/vet/reports`
- `/vet/calendar`
- `/vet/messages`
- `/vet/notifications`
- `/vet/settings`
- `/architecture`

## 4. Component library

- `PetCard`
- `VetCard`
- `HealthGraph`
- `AppointmentSlot`
- `VaccinationTimeline`
- `ChatBubble`
- `PetReportCard`
- `PetAvatar`
- `ProgressPawIndicator`
- `StatCard`
- `SectionHeader`
- `Tag`
- `AppShell`

## 5. Layout wireframes

### Owner dashboard

- Left rail navigation
- Top contextual header
- Metrics row
- Pet overview grid
- Right insight rail
- Charts row

### Vet dashboard

- Left rail navigation
- Metrics row
- Clinic status and requests column
- Appointment workload board
- Analytics and shortcuts

### Appointment booking

- Date selector column
- Available slot grid
- Booking flow explainer

### Messaging

- Thread list column
- Active chat pane
- Attachment-ready composer

## 6. User flows

### Pet owner

1. Lands on marketing page
2. Signs up
3. Completes pet onboarding quiz
4. Enters owner dashboard
5. Reviews pet profile and reminders
6. Books appointment or starts chat
7. Tracks medications, vaccines, weight, diet, reports

### Veterinarian

1. Logs in as vet
2. Opens dashboard
3. Reviews requests and appointments
4. Sets availability
5. Opens patient list
6. Writes or updates report
7. Communicates with owner

## 7. React folder structure

```text
repo/
  Backend/
  legacy/
  web/
  index.html
  package.json
  postcss.config.js
  tailwind.config.js
  vite.config.js
  src/
    components/
      cards.jsx
      ui.jsx
    lib/
      api.js
      mockData.js
    store/
      appStore.js
    main.jsx
    pages.jsx
    router.jsx
    styles.css
```

## 8. Animations and interactions

- Elevated card hover motion
- Animated onboarding progress bar
- Friendly rounded cards and slots
- Role-based navigation switching
- Conversational chat bubbles
- Chart-driven health and nutrition insights

## 9. Integration-ready API placeholders

Current mockable service lives in `src/lib/api.js`.

Mapped backend areas:

- Auth
- Pets
- Appointments
- Appointment reports
- Diet plans
- Medications
- Vaccinations
- Records
- Health logs
- Meals
- Settings
- Chat requests
- Chats and messages
- Vet patients

## 10. Notes for backend integration

- Replace `mockApi` calls with `api` calls gradually.
- Keep response shapes aligned with existing Flask fields to reduce rewrite cost.
- Use `VITE_API_BASE_URL` for environment-specific API hosts.
- Because the backend targets SQL Server, the UI already assumes normalized relational data and record-driven detail views.
