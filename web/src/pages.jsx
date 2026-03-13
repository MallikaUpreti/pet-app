import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { createBrowserRouter, Link, Navigate, Outlet, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BellRing,
  Bone,
  CalendarDays,
  CalendarPlus2,
  Camera,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  ImagePlus,
  LoaderCircle,
  MessageSquareText,
  PawPrint,
  Pill,
  Plus,
  Settings2,
  Sparkles,
  Syringe
} from "lucide-react";
import {
  AppointmentSlot,
  ChatBubble,
  NutritionChart,
  PetAvatar,
  PetCard,
  PetReportCard,
  ProgressPawIndicator,
  VaccinationTimeline,
  VetCard,
  WeightGraph
} from "./components/cards";
import { AppShell, EmptyState, SectionHeader, StatCard, Tag } from "./components/ui";
import { useAppStore } from "./store/appStore";
import { liveApi } from "./lib/api";

const quizSteps = [
  { key: "pet_name", question: "What should we call your pet?", hint: "Pick the name you use every day." },
  { key: "species", question: "What kind of companion are we caring for?", hint: "Dog or cat works great for now." },
  { key: "breed", question: "Which breed or mix fits best?", hint: "This helps tailor diet and vaccine suggestions." },
  { key: "age_months", question: "How old is your pet in months?", hint: "Age helps us adapt meal schedules and reminders." },
  { key: "allergies", question: "Any allergies or ingredient sensitivities?", hint: "List known triggers, even if they are mild." },
  { key: "food_restrictions", question: "Any food restrictions to avoid?", hint: "Examples: chicken-free, low-fat, grain-free." },
  { key: "weight", question: "What is the current weight in kg?", hint: "A recent estimate is enough to get started." },
  { key: "health_conditions", question: "Any diagnosed health conditions?", hint: "Skin, digestion, joints, recovery, anything important." },
  { key: "vaccination_history", question: "What vaccinations have already been given?", hint: "A quick summary is fine." },
  { key: "activity_level", question: "How active is your pet most days?", hint: "Low, moderate, or high activity helps with meal plans." }
];

const vaccineGuides = {
  Dog: [
    { name: "Rabies", cadence: "Usually every 1 to 3 years", interval_days: 365, summary: "Important for protecting against rabies, a serious disease that can affect both pets and people." },
    { name: "DHPPiL", cadence: "Puppy series plus boosters", interval_days: 21, summary: "Helps protect dogs from distemper, hepatitis, parvo, parainfluenza, and leptospirosis." },
    { name: "Corona vaccine", cadence: "Ask your vet based on local guidance", interval_days: 365, summary: "May be recommended in some cases to support protection against canine coronavirus-related illness." }
  ],
  Cat: [
    { name: "Rabies", cadence: "Usually every 1 to 3 years", interval_days: 365, summary: "Important for protecting against rabies, which can be life-threatening and may also be legally required." },
    { name: "Tricat tri vaccine", cadence: "Kitten series plus boosters", interval_days: 21, summary: "Helps protect cats from common viral infections that can affect breathing, appetite, and overall health." }
  ]
};

function formatDate(dateLike, options = { month: "short", day: "numeric" }) {
  if (!dateLike) return "Not scheduled";
  return new Date(dateLike).toLocaleDateString(undefined, options);
}

function formatDateTime(dateLike) {
  if (!dateLike) return "Not scheduled";
  return new Date(dateLike).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function normalizeVaccineName(value = "") {
  return String(value || "")
    .replace(/^vaccination:\s*/i, "")
    .trim()
    .toLowerCase();
}

function toTitleCase(value = "") {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isoForSlot(date, slot) {
  return `${date}T${slot}:00`;
}

function plusThirtyMinutes(date, slot) {
  const stamp = new Date(`${date}T${slot}:00`);
  stamp.setMinutes(stamp.getMinutes() + 30);
  const year = stamp.getFullYear();
  const month = String(stamp.getMonth() + 1).padStart(2, "0");
  const day = String(stamp.getDate()).padStart(2, "0");
  const hours = String(stamp.getHours()).padStart(2, "0");
  const minutes = String(stamp.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:00`;
}

function addDays(dateString, days) {
  if (!dateString || !days) return "";
  const stamp = new Date(`${dateString}T00:00:00`);
  stamp.setDate(stamp.getDate() + Number(days));
  return stamp.toISOString().slice(0, 10);
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  const target = new Date(`${dateString}T00:00:00`);
  const diff = Math.ceil((target - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / (1000 * 60 * 60 * 24));
  return diff;
}

function deriveVaccinationsFromAppointments(appointments = []) {
  return appointments
    .filter((item) => {
      const type = String(item.type || "").trim().toLowerCase();
      const status = String(item.status || "").trim().toLowerCase();
      return type.includes("vaccination") && status === "completed";
    })
    .map((item, index) => ({
      id: `appt-vax-${item.id || index}`,
      name: String(item.type || "").replace(/^vaccination:\s*/i, "").trim(),
      status: "Given",
      due_date: item.start_time ? new Date(item.start_time).toISOString().slice(0, 10) : null,
      notes: `Added from completed appointment on ${formatDateTime(item.start_time)}.`
    }));
}

function mergeVaccinationSources(savedVaccinations = [], appointments = []) {
  const seen = new Set();
  const merged = [];

  savedVaccinations.forEach((item, index) => {
    const key = normalizeVaccineName(item.name || item.title || `saved-${index}`);
    seen.add(key);
    merged.push(item);
  });

  deriveVaccinationsFromAppointments(appointments).forEach((item, index) => {
    const key = normalizeVaccineName(item.name || `derived-${index}`);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });

  return merged;
}

function deriveMedicationSummary(reportItems = []) {
  const summaries = [];
  reportItems.forEach((report) => {
    if (!report?.medications_and_doses) return;
    summaries.push(report.medications_and_doses);
  });
  return summaries;
}

function statusTone(status = "") {
  switch (status.toLowerCase()) {
    case "confirmed":
    case "completed":
      return "success";
    case "cancelled":
    case "declined":
      return "default";
    case "pending":
      return "warning";
    default:
      return "info";
  }
}

function useBootstrap() {
  const initialize = useAppStore((state) => state.initialize);
  const ready = useAppStore((state) => state.ready);

  useEffect(() => {
    if (!ready) {
      initialize();
    }
  }, [initialize, ready]);
}

function useDashboardData() {
  const bootstrap = useAppStore((state) => state.bootstrap);
  const selectedPetId = useAppStore((state) => state.selectedPetId);
  const selectedPet = bootstrap.pets.find((pet) => Number(pet.id) === Number(selectedPetId)) ?? bootstrap.pets[0] ?? null;
  return { bootstrap, selectedPet };
}

function useRoleGuard(requiredRole) {
  const currentRole = useAppStore((state) => state.currentRole);
  const currentUser = useAppStore((state) => state.currentUser);

  if (!currentUser) {
    return { denied: true, redirectTo: "/auth/login" };
  }

  if (requiredRole && currentRole !== requiredRole) {
    return { denied: true, redirectTo: currentRole === "vet" ? "/vet/dashboard" : "/owner/dashboard" };
  }

  return { denied: false, redirectTo: null };
}

function AppRoot() {
  useBootstrap();
  const ready = useAppStore((state) => state.ready);
  const loading = useAppStore((state) => state.loading);

  if (!ready || loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-brand-cream px-4">
        <div className="glass-panel max-w-md p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-orange/15 text-brand-orange">
            <LoaderCircle className="animate-spin" />
          </div>
          <h1 className="mt-5 font-heading text-4xl text-brand-black">Warming up PawCare</h1>
          <p className="muted-copy mt-2">Loading your pets, visits, reminders, and messages.</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

function RouteGate({ role, children }) {
  const { denied, redirectTo } = useRoleGuard(role);
  if (denied) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
}

function DashboardTile({ icon, title, copy, to, tone = "orange" }) {
  const tones = {
    orange: "from-brand-orange/18 via-white to-brand-yellow/14",
    blue: "from-brand-blue/18 via-white to-brand-green/12",
    green: "from-brand-green/18 via-white to-brand-yellow/12",
    yellow: "from-brand-yellow/24 via-white to-brand-orange/12"
  };
  return (
    <Link to={to} className={`stagger-pop rounded-[34px] border border-brand-black/10 bg-gradient-to-br ${tones[tone]} p-6 shadow-card transition hover:-translate-y-1`}>
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-full bg-white p-3 text-brand-black shadow-sm">{icon}</div>
        <ChevronRight size={18} className="text-brand-black/40" />
      </div>
      <h3 className="mt-5 font-heading text-4xl leading-none text-brand-black">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-brand-black/65">{copy}</p>
    </Link>
  );
}

function CompactReportRow({ report, expanded, onToggle }) {
  return (
    <div className="rounded-[26px] border border-brand-light/70 bg-white p-4 shadow-sm">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-4 text-left">
        <div className="min-w-0">
          <h3 className="font-semibold text-brand-black">
            {report.pet_name} - {report.appointment_type || "Appointment"}
          </h3>
          <p className="mt-1 text-sm text-brand-black/62">{formatDateTime(report.appointment_time)}</p>
        </div>
        <Tag tone="info">{expanded ? "Hide" : "Open"}</Tag>
      </button>
      {expanded ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-[22px] bg-brand-mist p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-black/45">Diagnosis</p>
            <p className="mt-2 whitespace-pre-line text-sm text-brand-black/76">{report.diagnosis || "No details added yet."}</p>
          </div>
          <div className="rounded-[22px] bg-brand-mist p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-black/45">Medications</p>
            <p className="mt-2 whitespace-pre-line text-sm text-brand-black/76">{report.medications_and_doses || "No details added yet."}</p>
          </div>
          <div className="rounded-[22px] bg-brand-mist p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-black/45">Diet plan</p>
            <p className="mt-2 whitespace-pre-line text-sm text-brand-black/76">{report.diet_recommendation || "No details added yet."}</p>
          </div>
          <div className="rounded-[22px] bg-brand-mist p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-black/45">General notes</p>
            <p className="mt-2 whitespace-pre-line text-sm text-brand-black/76">{report.general_recommendation || "No details added yet."}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FriendlyList({ items, emptyCopy }) {
  if (!items.length) {
    return <p className="text-sm text-brand-black/55">{emptyCopy}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item} className="rounded-[22px] bg-brand-mist px-4 py-3 text-sm text-brand-black/72">
          {item}
        </div>
      ))}
    </div>
  );
}

function AddPetFeature() {
  return (
    <div className="showcase-frame">
      <div className="showcase-canvas p-6">
        <div className="orbit-dot float-soft left-6 top-6 h-14 w-14 bg-brand-yellow/55" />
        <div className="orbit-dot float-soft right-8 top-10 h-24 w-24 bg-brand-blue/28" />
        <div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <span className="showcase-ribbon">Add another pet</span>
            <h3 className="editorial-title mt-5 max-w-2xl text-[clamp(2.8rem,5vw,5rem)]">Grow your care circle without leaving the dashboard.</h3>
            <p className="mt-4 max-w-xl text-base leading-8 text-brand-black/65">
              Start a new onboarding flow for another pet and keep their meals, vaccines, visits, and records in their own tidy space.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/quiz" className="rounded-full bg-brand-orange px-6 py-3 font-bold text-white shadow-float transition hover:-translate-y-0.5">
                <span className="inline-flex items-center gap-2">
                  <Plus size={18} />
                  Add a pet now
                </span>
              </Link>
              <Link to="/owner/pets" className="rounded-full border border-brand-black/10 bg-white px-6 py-3 font-bold text-brand-black transition hover:-translate-y-0.5">
                View pet profiles
              </Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="editorial-card bg-brand-yellow/45">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-black/45">Step 1</p>
              <h4 className="mt-3 font-heading text-3xl leading-none">Tell us the basics</h4>
              <p className="mt-3 text-sm leading-6 text-brand-black/68">Name, breed, age, allergies, weight, and activity level.</p>
            </div>
            <div className="editorial-card bg-brand-blue/18">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-black/45">Step 2</p>
              <h4 className="mt-3 font-heading text-3xl leading-none">Unlock smarter care</h4>
              <p className="mt-3 text-sm leading-6 text-brand-black/68">Get diet help, appointments, reminders, and reports instantly.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppointmentStatusButton({ appointment, onUpdate, loadingId }) {
  const canConfirm = appointment.status === "Pending";
  const canComplete = appointment.status === "Confirmed";

  return (
    <div className="flex flex-wrap gap-2">
        {canConfirm ? (
          <button
            onClick={() => onUpdate(appointment, { status: "Confirmed" })}
            disabled={loadingId === appointment.id}
            className="rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-brand-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingId === appointment.id ? "Saving..." : "Confirm"}
        </button>
      ) : null}
        {canComplete ? (
          <button
          onClick={() => onUpdate(appointment, { status: "Completed" })}
            disabled={loadingId === appointment.id}
            className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-brand-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingId === appointment.id ? "Saving..." : "Mark complete"}
        </button>
      ) : null}
      {appointment.status !== "Cancelled" && appointment.status !== "Completed" ? (
          <button
            onClick={() => onUpdate(appointment, { status: "Cancelled" })}
            disabled={loadingId === appointment.id}
            className="rounded-full border border-brand-light bg-white px-4 py-2 text-sm font-semibold text-brand-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
        </button>
      ) : null}
    </div>
  );
}

function OwnerHero({ selectedPet, nextAppointment }) {
  const tags = [
    selectedPet?.breed || "Breed coming soon",
    selectedPet?.food_restrictions ? `Foods to avoid: ${selectedPet.food_restrictions}` : "Foods to avoid not added",
    selectedPet?.allergies ? `Allergies: ${selectedPet.allergies}` : "No allergy note"
  ];

  return (
    <div className="section-shell paper-panel overflow-hidden">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div>
          <span className="eyebrow">Today with {selectedPet?.name || "your pet"}</span>
          <h2 className="editorial-title mt-4 max-w-3xl">A calmer care routine, all in one place.</h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-brand-black/68">
            Keep meals, reminders, checkups, and conversations feeling easy. The dashboard focuses on what pet parents actually need next.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Tag key={tag} tone={tag.startsWith("Allergies") ? "warning" : "accent"}>
                {tag}
              </Tag>
            ))}
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="editorial-card bg-white/92">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-brand-black/45">Next visit</p>
              <p className="mt-3 font-heading text-4xl leading-none text-brand-black">
                {nextAppointment ? formatDateTime(nextAppointment.start_time) : "Nothing booked yet"}
              </p>
              <p className="mt-3 text-sm leading-6 text-brand-black/65">
                {nextAppointment ? `${nextAppointment.type} with ${nextAppointment.vet_name || "your veterinarian"}` : "Pick a slot when you are ready."}
              </p>
            </div>
            <div className="editorial-card bg-brand-black text-white">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-white/45">Diet focus</p>
              <p className="mt-3 font-heading text-4xl leading-none">Safer meals, less guesswork</p>
              <p className="mt-3 text-sm leading-6 text-white/72">Generate a plan and ask pantry questions.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <DashboardTile icon={<CalendarPlus2 size={20} />} title="Book a visit" copy="Pick a clean time slot flow with live availability." to="/owner/appointments" />
          <DashboardTile icon={<Sparkles size={20} />} title="Diet AI" copy="Generate daily meals and pantry-safe ideas." to="/owner/diet-planner" tone="blue" />
          <DashboardTile icon={<Syringe size={20} />} title="Vaccines" copy="See history, upcoming reminders, and due dates." to="/owner/vaccinations" tone="yellow" />
          <DashboardTile icon={<MessageSquareText size={20} />} title="Messages" copy="Keep owner-vet chat warm and organized." to="/owner/messages" tone="green" />
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="site-stage min-h-screen px-4 py-5 md:px-8">
      <div className="mx-auto max-w-[1380px] space-y-6">
        <header className="site-nav-shell">
          <div className="site-nav-row">
            <div className="flex items-center gap-4">
              <div className="floating-paw rounded-[24px] bg-brand-orange p-4 text-white shadow-soft">
                <PawPrint size={22} />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.26em] text-brand-black/40">Modern pet-care platform</p>
                <h1 className="font-heading text-4xl text-brand-black md:text-5xl">PawCare</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="website-pill">Home</span>
              <span className="website-pill">Features</span>
              <span className="website-pill">About</span>
              <Link to="/auth/login" className="website-pill">Login</Link>
              <Link to="/auth/signup" className="website-pill bg-brand-black text-white">Get started</Link>
            </div>
          </div>
        </header>

        <section className="showcase-frame overflow-hidden">
          <div className="showcase-canvas paper-panel p-6 md:p-8">
            <div className="grid gap-8 xl:grid-cols-[1fr_1fr] xl:items-center">
              <div className="space-y-5">
                <span className="eyebrow">Warm care for pets</span>
                <h2 className="editorial-title max-w-3xl text-[clamp(4rem,7vw,6.8rem)]">
                  Modern pet care, made simple.
                </h2>
                <p className="muted-copy max-w-2xl">
                  Book visits, track vaccines, plan meals, and chat with vets.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link to="/auth/signup" className="rounded-full bg-brand-orange px-6 py-3 font-bold text-white shadow-float transition hover:-translate-y-0.5">
                    Get started
                  </Link>
                  <Link to="/auth/login" className="rounded-full border border-brand-black/10 bg-white px-6 py-3 font-bold text-brand-black transition hover:-translate-y-0.5">
                    Log in
                  </Link>
                </div>
                <div className="grid max-w-2xl gap-4 md:grid-cols-3">
                  {[
                    ["Book", "Visits"],
                    ["Track", "Vaccines"],
                    ["Chat", "Support"]
                  ].map(([eyebrow, title], index) => (
                    <div key={title} className={`rounded-[28px] p-5 shadow-card ${index === 0 ? "bg-brand-yellow/72" : index === 1 ? "bg-white/92" : "bg-brand-blue/28"}`}>
                      <p className="text-sm font-medium text-brand-black/55">{eyebrow}</p>
                      <h3 className="mt-2 font-heading text-4xl leading-none text-brand-black">{title}</h3>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[38px] bg-[radial-gradient(circle_at_32%_28%,rgba(242,140,56,0.88),rgba(234,203,90,0.9)_35%,rgba(111,167,214,0.8)_72%,rgba(255,255,255,0.9)_100%)] p-10 shadow-[0_28px_80px_rgba(15,15,15,0.16)]">
                  <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-white text-brand-black shadow-card">
                    <PawPrint size={52} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    ["Appointments", "Live slots"],
                    ["Profiles", "Clear records"],
                    ["Diet AI", "Meal plans"]
                  ].map(([title, copy]) => (
                    <div key={title} className="rounded-[28px] bg-white/92 p-5 shadow-card">
                      <h3 className="font-heading text-3xl leading-none text-brand-black">{title}</h3>
                      <p className="mt-2 text-base text-brand-black/65">{copy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function AuthPage({ mode }) {
  const navigate = useNavigate();
  const login = useAppStore((state) => state.login);
  const signup = useAppStore((state) => state.signup);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    defaultValues: {
      role: "owner",
      full_name: "",
      email: "",
      password: ""
    }
  });

  const onSubmit = async (data) => {
    if (mode === "signup") {
      const result = await signup(data);
      navigate(result.role === "vet" ? "/vet/dashboard" : "/quiz");
      return;
    }

    const result = await login(data);
    navigate(result.role === "vet" ? "/vet/dashboard" : "/owner/dashboard");
  };

  return (
    <div className="site-stage grid min-h-screen place-items-center px-4 py-6">
      <div className="w-full max-w-6xl">
        <div className="showcase-frame overflow-hidden p-0">
          <div className="showcase-canvas paper-panel grid min-h-[680px] gap-8 p-8 md:p-10 xl:grid-cols-[1fr_0.9fr] xl:items-center">
            <div className="space-y-6">
              <span className="showcase-ribbon">{mode === "signup" ? "Join PawCare" : "Welcome back"}</span>
              <span className="eyebrow">{mode === "signup" ? "Quick setup" : "Back to your pets"}</span>
              <h1 className="editorial-title max-w-2xl">
                {mode === "signup" ? "Care, visits, and vaccines in one place." : "Log in and continue."}
              </h1>
              <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                {[
                  "Book visits",
                  "Track vaccines",
                  "Plan meals",
                  "Chat with vets"
                ].map((label) => (
                  <div key={label} className="editorial-card py-5">
                    <p className="text-xl font-medium text-brand-black">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="section-shell paper-panel relative mx-auto w-full max-w-xl space-y-4">
              <div className="orbit-dot right-6 top-6 h-14 w-14 bg-brand-yellow/35" />
              <SectionHeader title={mode === "signup" ? "Create account" : "Log in"} />
              <label className="block">
                <span className="mb-2 block text-base font-medium text-brand-black">Role</span>
                <select {...register("role", { required: "Please choose a role." })} className="w-full rounded-[24px] border border-brand-light bg-white px-4 py-3">
                  <option value="owner">Pet owner</option>
                  <option value="vet">Veterinarian</option>
                </select>
              </label>
              {mode === "signup" ? (
                <label className="block">
                  <span className="mb-2 block text-base font-medium text-brand-black">Full name</span>
                  <input
                    {...register("full_name", { required: "Please add your full name." })}
                    className="w-full rounded-[24px] border border-brand-light bg-white px-4 py-3"
                    placeholder="Taylor Parker"
                  />
                  {errors.full_name ? <p className="mt-2 text-sm text-red-600">{errors.full_name.message}</p> : null}
                </label>
              ) : null}
              <label className="block">
                <span className="mb-2 block text-base font-medium text-brand-black">Email</span>
                <input
                  {...register("email", {
                    required: "Please add your email.",
                    pattern: { value: /\S+@\S+\.\S+/, message: "Please enter a valid email." }
                  })}
                  type="email"
                  className="w-full rounded-[24px] border border-brand-light bg-white px-4 py-3"
                  placeholder="hello@pawcare.com"
                />
                {errors.email ? <p className="mt-2 text-sm text-red-600">{errors.email.message}</p> : null}
              </label>
              <label className="block">
                <span className="mb-2 block text-base font-medium text-brand-black">Password</span>
                <input
                  {...register("password", {
                    required: "Please add a password.",
                    minLength: { value: 6, message: "Use at least 6 characters." }
                  })}
                  type="password"
                  className="w-full rounded-[24px] border border-brand-light bg-white px-4 py-3"
                  placeholder="At least 6 characters"
                />
                {errors.password ? <p className="mt-2 text-sm text-red-600">{errors.password.message}</p> : null}
              </label>
              {error ? <div className="rounded-[22px] bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[24px] bg-brand-black px-5 py-4 text-lg font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Working..." : mode === "signup" ? "Continue" : "Open CareSpace"}
              </button>
              <p className="text-center text-base text-brand-black/60">
                {mode === "signup" ? "Already have an account?" : "Need a new account?"}{" "}
                <Link to={mode === "signup" ? "/auth/login" : "/auth/signup"} className="font-bold text-brand-orange">
                  {mode === "signup" ? "Log in" : "Sign up"}
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuizPage() {
  const navigate = useNavigate();
  const submitQuiz = useAppStore((state) => state.submitQuiz);
  const saveVaccination = useAppStore((state) => state.saveVaccination);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [providedVaccines, setProvidedVaccines] = useState({});
  const {
    register,
    trigger,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm({
    defaultValues: {
      pet_name: "",
      species: "Dog",
      breed: "",
      age_months: "",
      allergies: "",
      food_restrictions: "",
      weight: "",
      health_conditions: "",
      vaccination_history: "",
      activity_level: "Moderate"
    }
  });

  const currentStep = quizSteps[stepIndex];
  const selectedSpecies = watch("species");
  const onboardingVaccines = vaccineGuides[selectedSpecies] || [];

  const next = async () => {
    const valid = await trigger(currentStep.key);
    if (!valid) return;
    setStepIndex((value) => Math.min(value + 1, quizSteps.length - 1));
  };

  const previous = () => setStepIndex((value) => Math.max(value - 1, 0));

  const onSubmit = async (data) => {
    setSubmitError("");
    setSubmitting(true);
    try {
      const result = await submitQuiz({
        ...data,
        photo_file: photoFile,
        vaccination_history: Object.entries(providedVaccines)
          .filter(([, value]) => value?.checked && value?.date)
          .map(([name, value]) => `${name} (${value.date})`)
          .join(", ")
      });
      const petId = result?.id;
      if (petId) {
        await Promise.all(
          onboardingVaccines
            .filter((vaccine) => providedVaccines[vaccine.name]?.checked && providedVaccines[vaccine.name]?.date)
            .map((vaccine) =>
              saveVaccination(petId, {
                name: vaccine.name,
                status: "Given",
                administered_date: providedVaccines[vaccine.name].date,
                due_date: addDays(providedVaccines[vaccine.name].date, vaccine.interval_days),
                notes: "Added during onboarding."
              })
            )
        );
      }
      navigate("/owner/dashboard");
    } catch (error) {
      setSubmitError(error.message || "We could not save your pet profile.");
    } finally {
      setSubmitting(false);
    }
  };

  const registerOptions = {
    pet_name: { required: "Your pet's name helps us personalize everything." },
    species: { required: "Choose a species." },
    breed: { required: "Please add a breed or mix." },
    age_months: { required: "Please add age in months." },
    weight: { required: "Please add weight in kg." }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-hero-wash px-4 py-6">
      <div className="glass-panel w-full max-w-6xl overflow-hidden p-0">
        <div className="grid gap-0 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-brand-black p-8 text-white md:p-10">
            <span className="eyebrow bg-white/10 text-white">Pet onboarding quiz</span>
            <h1 className="mt-5 font-heading text-5xl">A softer intake that still captures the details.</h1>
            <p className="mt-3 text-sm text-white/72">
              The answers here feed appointment prep, vaccination reminders, and the new Gemini-powered diet planner.
            </p>
            <div className="mt-8">
              <ProgressPawIndicator total={quizSteps.length} current={stepIndex + 1} />
            </div>
            <label className="mt-8 flex cursor-pointer items-center gap-3 rounded-[28px] border border-white/12 bg-white/8 p-4 transition hover:bg-white/12">
              <div className="rounded-[18px] bg-white/12 p-3">
                <ImagePlus size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{photoFile ? photoFile.name : "Add a pet photo"}</p>
                <p className="text-xs text-white/60">Optional, but it makes the profile, reports, and messages feel more personal.</p>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} />
            </label>
            <div className="mt-8 rounded-[30px] bg-white/10 p-5">
              <p className="text-sm uppercase tracking-[0.24em] text-white/55">Preview</p>
              <h3 className="mt-2 font-heading text-3xl">{currentStep.question}</h3>
              <p className="mt-2 text-sm text-white/72">{currentStep.hint}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-8 md:p-10">
            <div className="rounded-[32px] bg-brand-mist p-6">
              <p className="text-sm uppercase tracking-[0.22em] text-brand-black/45">Question {stepIndex + 1}</p>
              <h2 className="mt-3 font-heading text-4xl text-brand-black">{currentStep.question}</h2>
              <p className="mt-2 text-sm text-brand-black/60">{currentStep.hint}</p>
              <div className="mt-6">
                {currentStep.key === "species" ? (
                  <select
                    {...register("species", registerOptions.species)}
                    className="w-full rounded-[24px] border border-brand-light bg-white px-4 py-4 text-lg"
                  >
                    <option value="Dog">Dog</option>
                    <option value="Cat">Cat</option>
                  </select>
                ) : currentStep.key === "activity_level" ? (
                  <select
                    {...register("activity_level")}
                    className="w-full rounded-[24px] border border-brand-light bg-white px-4 py-4 text-lg"
                  >
                    <option value="Low">Low activity</option>
                    <option value="Moderate">Moderate activity</option>
                    <option value="High">High activity</option>
                  </select>
                ) : currentStep.key === "vaccination_history" ? (
                  <div className="space-y-3">
                    {onboardingVaccines.map((vaccine) => {
                      const value = providedVaccines[vaccine.name] || { checked: false, date: "" };
                      return (
                        <div key={vaccine.name} className="rounded-[24px] border border-brand-light bg-white p-4">
                          <label className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-lg font-medium text-brand-black">{vaccine.name}</p>
                              <p className="mt-1 text-sm text-brand-black/60">{vaccine.summary}</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={value.checked}
                              onChange={(event) =>
                                setProvidedVaccines((current) => ({
                                  ...current,
                                  [vaccine.name]: { ...value, checked: event.target.checked }
                                }))
                              }
                              className="h-5 w-5 rounded"
                            />
                          </label>
                          {value.checked ? (
                            <input
                              type="date"
                              value={value.date}
                              onChange={(event) =>
                                setProvidedVaccines((current) => ({
                                  ...current,
                                  [vaccine.name]: { ...value, checked: true, date: event.target.value }
                                }))
                              }
                              className="mt-3 w-full rounded-[20px] border border-brand-light bg-brand-mist px-4 py-3"
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    {...register(currentStep.key, registerOptions[currentStep.key])}
                    rows={currentStep.key === "vaccination_history" || currentStep.key === "health_conditions" ? 5 : 3}
                    className="w-full rounded-[24px] border border-brand-light bg-white px-4 py-4 text-lg"
                    placeholder={toTitleCase(currentStep.key)}
                  />
                )}
                {errors[currentStep.key] ? <p className="mt-3 text-sm text-red-600">{errors[currentStep.key]?.message}</p> : null}
              </div>
            </div>

            {submitError ? <div className="mt-5 rounded-[22px] bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div> : null}

            <div className="mt-8 flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={previous}
                disabled={stepIndex === 0}
                className="rounded-full border border-brand-light bg-white px-5 py-3 font-semibold text-brand-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              {stepIndex < quizSteps.length - 1 ? (
                <button type="button" onClick={next} className="rounded-full bg-brand-orange px-5 py-3 font-semibold text-white">
                  Next paw
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-brand-black px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Finish setup"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function OwnerDashboardPage() {
  const guard = useRoleGuard("owner");
  const selectPet = useAppStore((state) => state.selectPet);
  const { bootstrap, selectedPet } = useDashboardData();

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  if (!bootstrap.pets.length) {
    return (
      <AppShell title="Owner dashboard" subtitle="A warm home base for meals, reminders, reports, and appointments.">
        <div className="space-y-6">
          <EmptyState title="Your first pet is waiting" copy="Finish onboarding to get started." />
        </div>
      </AppShell>
    );
  }

  const nextAppointment =
    bootstrap.appointments
      .filter((appointment) => Number(appointment.pet_id) === Number(selectedPet?.id))
      .sort((left, right) => new Date(left.start_time) - new Date(right.start_time))
      .find((appointment) => !["Completed", "Cancelled"].includes(appointment.status)) || null;

    const dueVaccines = bootstrap.vaccinations.filter((item) => item.status !== "Given");
    const unreadNotifications = bootstrap.notifications.filter((item) => !item.is_read);
    const vaccineCountdowns = bootstrap.vaccinations
    .filter((item) => Number(item.pet_id) === Number(selectedPet?.id))
    .map((item) => ({ ...item, days_left: daysUntil(item.due_date) }))
      .filter((item) => item.days_left !== null)
      .sort((left, right) => left.days_left - right.days_left);
    const selectedPetAppointments = bootstrap.appointments.filter((item) => Number(item.pet_id) === Number(selectedPet?.id));
    const selectedPetMeds = bootstrap.medications.filter((item) => Number(item.pet_id) === Number(selectedPet?.id));

    return (
      <AppShell title="Owner dashboard" subtitle="Friendly care tools with clearer priorities, stronger visuals, and fewer distractions.">
        <OwnerHero selectedPet={selectedPet} nextAppointment={nextAppointment} />

      <section className="data-grid">
        <StatCard label="Pets in care" value={bootstrap.pets.length} helper="Each pet keeps its own notes, meds, and reminders." />
        <StatCard label="Upcoming visits" value={bootstrap.appointments.filter((item) => ["Pending", "Confirmed"].includes(item.status)).length} helper="Open bookings and confirmed checkups." tint="blue" />
        <StatCard label="Vaccines to review" value={dueVaccines.length} helper="A quick count of upcoming or pending vaccine records." tint="yellow" />
        <StatCard label="Unread alerts" value={unreadNotifications.length} helper="Notifications that still need your attention." tint="green" />
      </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="section-shell">
              <SectionHeader title="My pets" />
              <div className="grid gap-4 lg:grid-cols-2">
              {bootstrap.pets.map((pet) => (
                  <PetCard key={pet.id} pet={pet} selected={Number(selectedPet?.id) === Number(pet.id)} onSelect={selectPet} />
                ))}
              </div>
            </div>
            <div className="section-shell">
              <SectionHeader title="Upcoming appointments" />
              <FriendlyList
                items={selectedPetAppointments.filter((item) => ["Pending", "Confirmed"].includes(item.status)).map((item) => `${item.type} - ${formatDateTime(item.start_time)}`)}
                emptyCopy="No upcoming appointments."
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="section-shell">
              <SectionHeader title="Care snapshot" caption="Key health information at a glance." />
              <div className="flex items-center gap-4">
                {selectedPet ? <PetAvatar pet={selectedPet} size="lg" /> : null}
                <div>
                  <h3 className="font-heading text-4xl text-brand-black">{selectedPet?.name}</h3>
                  <p className="text-sm text-brand-black/60">{selectedPet?.breed || "Breed not added"} - {selectedPet?.age_months || "-"} months</p>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-sm text-brand-black/72">
                <div className="rounded-[22px] bg-brand-yellow/18 p-4">Vaccinations due: {dueVaccines.filter((item) => Number(item.pet_id) === Number(selectedPet?.id)).length}</div>
                <div className="rounded-[22px] bg-brand-blue/18 p-4">Medications on file: {selectedPetMeds.length}</div>
                <div className="rounded-[22px] bg-red-50 p-4 text-red-800">Allergies: {selectedPet?.allergies || "None noted"}</div>
                <div className="rounded-[22px] bg-brand-mist p-4">Foods to avoid: {selectedPet?.food_restrictions || "No restrictions added"}</div>
                <div className="rounded-[22px] bg-brand-green/18 p-4">{nextAppointment ? `Upcoming appointment: ${nextAppointment.type} on ${formatDateTime(nextAppointment.start_time)}` : "No upcoming appointment."}</div>
                {vaccineCountdowns[0] ? (
                  <div className="rounded-[22px] bg-brand-orange/14 p-4">
                    {`${vaccineCountdowns[0].name} due in ${vaccineCountdowns[0].days_left} day${vaccineCountdowns[0].days_left === 1 ? "" : "s"}.`}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

function PetProfilePage() {
  const guard = useRoleGuard("owner");
  const { bootstrap, selectedPet } = useDashboardData();
  const uploadPetPhoto = useAppStore((state) => state.uploadPetPhoto);
  const updatePetProfile = useAppStore((state) => state.updatePetProfile);
  const selectPet = useAppStore((state) => state.selectPet);
  const [uploadState, setUploadState] = useState({ loading: false, error: "", success: "" });
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState({ loading: false, error: "", success: "" });
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    if (!selectedPet) return;
    reset({
      name: selectedPet.name || "",
      breed: selectedPet.breed || "",
      age_months: selectedPet.age_months || "",
      allergies: selectedPet.allergies || "",
      food_restrictions: selectedPet.food_restrictions || "",
      health_conditions: selectedPet.health_conditions || ""
    });
  }, [reset, selectedPet]);

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  if (!selectedPet) {
    return <Navigate to="/owner/dashboard" replace />;
  }

  const petVaccinations = bootstrap.vaccinations.filter((item) => Number(item.pet_id) === Number(selectedPet.id));
  const petMedications = bootstrap.medications.filter((item) => Number(item.pet_id) === Number(selectedPet.id));
  const petRecords = bootstrap.records.filter((item) => Number(item.pet_id) === Number(selectedPet.id));
  const petAppointments = bootstrap.appointments.filter((item) => Number(item.pet_id) === Number(selectedPet.id));
  const visibleVaccinations = mergeVaccinationSources(petVaccinations, petAppointments);
  const reportMedicationSummary = deriveMedicationSummary(bootstrap.reports.filter((item) => Number(item.pet_id || selectedPet.id) === Number(selectedPet.id)));

  const onPhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadState({ loading: true, error: "", success: "" });
    try {
      await uploadPetPhoto(selectedPet.id, file);
      setUploadState({ loading: false, error: "", success: "Photo updated successfully." });
    } catch (error) {
      setUploadState({ loading: false, error: error.message || "We could not upload that photo.", success: "" });
    } finally {
      event.target.value = "";
    }
  };

  const onSaveProfile = async (values) => {
    setSaveState({ loading: true, error: "", success: "" });
    try {
      await updatePetProfile(selectedPet.id, values);
      setEditing(false);
      setSaveState({ loading: false, error: "", success: "Profile updated." });
    } catch (error) {
      setSaveState({ loading: false, error: error.message || "Unable to update profile.", success: "" });
    }
  };

  return (
    <AppShell title="Pet profile" subtitle="Everything a pet parent should see in one caring, readable profile.">
      <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="section-shell">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <SectionHeader title="Profile" />
            {bootstrap.pets.length > 1 ? (
              <label className="website-pill gap-3 pr-3">
                <PawPrint size={16} />
                <select
                  value={selectedPet.id}
                  onChange={(event) => selectPet(Number(event.target.value))}
                  className="min-w-[130px] appearance-none border-0 bg-transparent p-0 text-base font-medium focus:shadow-none"
                >
                  {bootstrap.pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>{pet.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <PetAvatar pet={selectedPet} size="lg" />
            <div>
              <h2 className="font-heading text-5xl text-brand-black">{selectedPet.name}</h2>
              <p className="text-sm text-brand-black/60">{selectedPet.species} - {selectedPet.breed || "Breed pending"}</p>
            </div>
          </div>
          <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-[24px] bg-brand-yellow/18 px-4 py-4 transition hover:bg-brand-yellow/25">
            <div className="rounded-[18px] bg-white p-3">
              <Camera size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-black">{uploadState.loading ? "Uploading photo..." : "Change pet photo"}</p>
              <p className="text-xs text-brand-black/55">Use a clean pet portrait so chats, records, and dashboards feel more personal.</p>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
          </label>
          {uploadState.error ? <div className="mt-3 rounded-[22px] bg-red-50 px-4 py-3 text-sm text-red-700">{uploadState.error}</div> : null}
          {uploadState.success ? <div className="mt-3 rounded-[22px] bg-brand-green/20 px-4 py-3 text-sm text-brand-black">{uploadState.success}</div> : null}
          <div className="mt-6 space-y-3 text-sm text-brand-black/72">
            <div className="rounded-[22px] bg-brand-mist p-4">Breed: {selectedPet.breed || "Not added"}</div>
            <div className="rounded-[22px] bg-brand-mist p-4">Age: {selectedPet.age_months || "-"} months</div>
            <div className="rounded-[22px] bg-red-50 p-4 text-red-800">Allergies: {selectedPet.allergies || "None noted"}</div>
            <div className="rounded-[22px] bg-brand-yellow/18 p-4">Foods to avoid: {selectedPet.food_restrictions || "No restrictions added"}</div>
            <div className="rounded-[22px] bg-brand-blue/16 p-4">Medical conditions: {selectedPet.health_conditions || "No medical conditions added"}</div>
            <div className="rounded-[22px] bg-brand-green/16 p-4">Vaccination status: {visibleVaccinations.length ? `${visibleVaccinations.length} recorded` : "No vaccines recorded yet"}</div>
          </div>
        </div>

        <div className="space-y-6">
          <form onSubmit={handleSubmit(onSaveProfile)} className="section-shell space-y-4">
            <SectionHeader
              title="Edit details"
              action={<button type="button" onClick={() => setEditing((value) => !value)} className="rounded-full border border-brand-light bg-white px-4 py-2 text-sm font-semibold text-brand-black">{editing ? "Cancel" : "Edit"}</button>}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input {...register("name")} disabled={!editing} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3" placeholder="Pet name" />
              <input {...register("breed")} disabled={!editing} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3" placeholder="Breed" />
              <input {...register("age_months")} disabled={!editing} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3" placeholder="Age in months" />
              <input {...register("allergies")} disabled={!editing} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3" placeholder="Allergies" />
              <input {...register("food_restrictions")} disabled={!editing} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3 md:col-span-2" placeholder="Foods to avoid" />
              <textarea {...register("health_conditions")} disabled={!editing} rows={3} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3 md:col-span-2" placeholder="Medical conditions" />
            </div>
            {saveState.error ? <div className="rounded-[22px] bg-red-50 px-4 py-3 text-sm text-red-700">{saveState.error}</div> : null}
            {saveState.success ? <div className="rounded-[22px] bg-brand-green/20 px-4 py-3 text-sm text-brand-black">{saveState.success}</div> : null}
            {editing ? <button type="submit" disabled={saveState.loading} className="rounded-full bg-brand-black px-5 py-3 text-sm font-semibold text-white">{saveState.loading ? "Saving..." : "Save profile"}</button> : null}
          </form>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="section-shell">
              <SectionHeader title="Vaccination history" />
              <FriendlyList
                items={visibleVaccinations.map((item) => `${item.name} - ${item.status} - ${formatDate(item.due_date)}`)}
                emptyCopy="No vaccinations recorded for this pet yet."
              />
            </div>
            <div className="section-shell">
              <SectionHeader title="Medications" />
              <FriendlyList
                items={[...petMedications.map((item) => `${item.name} - ${item.frequency || "No frequency"} - ${item.dosage || "No dosage"}`), ...reportMedicationSummary]}
                emptyCopy="No medications recorded yet."
              />
            </div>
            <div className="section-shell">
              <SectionHeader title="Vet visits" />
              <FriendlyList
                items={petAppointments.map((item) => `${item.type} - ${item.status} - ${formatDateTime(item.start_time)}`)}
                emptyCopy="No appointments saved for this pet yet."
              />
            </div>
            <div className="section-shell">
              <SectionHeader title="Reports and files" />
              <div className="space-y-3">
                {bootstrap.reports.length ? (
                  bootstrap.reports.map((report, index) => (
                    <Link key={`${report.diagnosis}-${index}`} to="/owner/report" className="block rounded-[22px] bg-brand-mist px-4 py-3 text-sm text-brand-black/78 transition hover:bg-brand-blue/16">
                      {report.appointment_type || "Vet report"} - {formatDateTime(report.appointment_time)}
                    </Link>
                  ))
                ) : null}
                {petRecords.length ? petRecords.map((item) => <div key={item.id} className="rounded-[22px] bg-brand-mist px-4 py-3 text-sm text-brand-black/72">{item.title || item.name || "Untitled file"}</div>) : null}
                {!bootstrap.reports.length && !petRecords.length ? <p className="text-sm text-brand-black/55">No reports uploaded yet.</p> : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function ReportPage() {
  const guard = useRoleGuard("owner");
  const { bootstrap, selectedPet } = useDashboardData();
  const [reportQuery, setReportQuery] = useState("");
  const [expandedReportId, setExpandedReportId] = useState("");

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  if (!selectedPet) {
    return <Navigate to="/owner/dashboard" replace />;
  }

  const petReports = bootstrap.reports.filter((report) => Number(report.pet_id || selectedPet.id) === Number(selectedPet.id));
  const plan = bootstrap.generatedDietPlan || bootstrap.dietPlans[0];
  const vaccinationItems = bootstrap.vaccinations.filter((item) => Number(item.pet_id) === Number(selectedPet.id));
  const medicationItems = bootstrap.medications.filter((item) => Number(item.pet_id) === Number(selectedPet.id));
  const filteredReports = petReports.filter((report) =>
    `${selectedPet.name} ${report.appointment_type || ""}`.toLowerCase().includes(reportQuery.toLowerCase())
  );

  return (
    <AppShell title="Pet health report" subtitle="Readable reports with weight, vaccines, medications, vet notes, allergies, and diet guidance.">
      {!petReports.length ? (
        <EmptyState title="No vet report yet" copy="A saved report will appear here." />
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="section-shell space-y-4">
              <SectionHeader title="Vet reports" />
              <input
                value={reportQuery}
                onChange={(event) => setReportQuery(event.target.value)}
                placeholder="Search by appointment type"
                className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3"
              />
              <div className="space-y-4">
                {filteredReports.map((report, index) => (
                  <CompactReportRow
                    key={`${report.appointment_id}-${index}`}
                    report={{ ...report, pet_name: selectedPet.name }}
                    expanded={expandedReportId === String(report.appointment_id || index)}
                    onToggle={() => setExpandedReportId((current) => (current === String(report.appointment_id || index) ? "" : String(report.appointment_id || index)))}
                  />
                ))}
              </div>
            </div>
            <WeightGraph data={bootstrap.weightSeries} petKey={selectedPet.name} />
          </div>
          <div className="space-y-6">
            <div className="section-shell">
              <SectionHeader title="Vaccination log" />
              <FriendlyList
                items={vaccinationItems.map((item) => `${item.name} - ${item.status} - ${formatDate(item.due_date)}`)}
                emptyCopy="No vaccination items yet."
              />
            </div>
            <div className="section-shell">
              <SectionHeader title="Medication log" />
              <FriendlyList
                items={medicationItems.map((item) => `${item.name} - ${item.dosage || "Dosage not added"} - ${item.frequency || "No frequency"}`)}
                emptyCopy="No medication items yet."
              />
            </div>
            <div className="section-shell">
              <SectionHeader title="Allergies and diet notes" />
              <FriendlyList
                items={[
                  `Allergies: ${selectedPet.allergies || "No allergy note"}`,
                  `Food restrictions: ${selectedPet.food_restrictions || "No restrictions added"}`,
                  `Diet summary: ${plan?.summary || plan?.details || "No diet guidance saved yet."}`
                ]}
                emptyCopy="No summary available."
              />
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}

function GuidePage() {
  const guard = useRoleGuard("owner");
  const { bootstrap, selectedPet } = useDashboardData();

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  if (!selectedPet) {
    return <Navigate to="/owner/dashboard" replace />;
  }

  const species = selectedPet.species || "Dog";
  const guideItems = vaccineGuides[species] || [];
  const overview =
    species === "Cat"
      ? "Cats are observant, routine-driven companions. Subtle appetite or behavior changes often matter, so early prevention is important."
      : "Dogs are social, active companions. Preventive care, vaccines, and food awareness reduce avoidable health risks over time.";
  const funFacts =
    species === "Cat"
      ? ["Cats often hide pain, so prevention matters.", "Indoor cats still need vaccine planning.", "Routine changes can affect appetite and stress."]
      : ["Dogs benefit from consistent vaccine timing.", "Breed and age influence diet decisions.", "Outdoor exposure increases preventive care needs."];

  return (
    <AppShell title={`${species} guide`} subtitle="Friendly education for day-to-day preventive care.">
      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="section-shell">
            <SectionHeader title="Overview" />
            <p className="text-sm leading-7 text-brand-black/72">{overview}</p>
          </div>
          <div className="section-shell">
            <SectionHeader title="Interesting facts" />
            <FriendlyList items={funFacts} emptyCopy="No facts available." />
          </div>
        </div>
        <div className="space-y-6">
          <div className="section-shell">
            <SectionHeader title="Vaccination guide" caption="Based on the selected pet profile." />
            <div className="space-y-3">
              {guideItems.map((item) => {
                const existing = bootstrap.vaccinations.find((record) => Number(record.pet_id) === Number(selectedPet.id) && record.name === item.name);
                return (
                  <div key={item.name} className="rounded-[22px] bg-brand-mist p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-2xl text-brand-black">{item.name}</h3>
                      <Tag tone={existing?.status === "Given" ? "success" : "warning"}>{existing?.status === "Given" ? "Recorded" : "Review"}</Tag>
                    </div>
                    <p className="mt-2 text-sm text-brand-black/70">{item.summary}</p>
                    <p className="mt-2 text-sm text-brand-black/60">Typical follow-up: about {item.interval_days} days</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function VaccinationPage() {
  const guard = useRoleGuard("owner");
  const { bootstrap, selectedPet } = useDashboardData();
  const saveVaccination = useAppStore((state) => state.saveVaccination);
  const [busyName, setBusyName] = useState("");

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  const petVaccinations = selectedPet
    ? bootstrap.vaccinations.filter((item) => Number(item.pet_id) === Number(selectedPet.id))
    : bootstrap.vaccinations;
  const appointmentVaccinations = selectedPet
    ? bootstrap.appointments.filter((item) => Number(item.pet_id) === Number(selectedPet.id))
    : [];
  const visibleVaccinations = mergeVaccinationSources(petVaccinations, appointmentVaccinations);
  const recommendedVaccines = vaccineGuides[selectedPet?.species] || [];

  const onToggleVaccine = async (vaccine) => {
    if (!selectedPet) return;
    const existing = petVaccinations.find((item) => item.name === vaccine.name);
    setBusyName(vaccine.name);
    try {
      if (existing) {
        await saveVaccination(selectedPet.id, {
          id: existing.id,
          name: vaccine.name,
          due_date: existing.due_date,
          notes: existing.notes,
          status: existing.status === "Given" ? "Due" : "Given"
        });
      } else {
        await saveVaccination(selectedPet.id, {
          name: vaccine.name,
          due_date: new Date().toISOString().slice(0, 10),
          status: "Given",
          notes: "Marked from the recommended vaccine checklist."
        });
      }
    } finally {
      setBusyName("");
    }
  };

  return (
    <AppShell title="Vaccination tracker" subtitle="Upcoming shots, history, reminders, and a calmer vaccine dashboard.">
      {!selectedPet ? (
        <EmptyState title="Choose a pet first" copy="Select a pet to see vaccine guidance." />
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="section-shell">
              <SectionHeader title="Recommended vaccines" caption={`${selectedPet.name}'s ${selectedPet.species.toLowerCase()} vaccine guide`} />
              <div className="space-y-4">
                {recommendedVaccines.map((vaccine) => {
                  const existing = petVaccinations.find((item) => item.name === vaccine.name);
                  const done = existing?.status === "Given";
                  return (
                    <div key={vaccine.name} className="rounded-[26px] border border-brand-light/70 bg-white p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-heading text-3xl text-brand-black">{vaccine.name}</h3>
                            {done ? <Tag tone="success">Already done</Tag> : <Tag tone="warning">Not done yet</Tag>}
                          </div>
                          <p className="mt-2 text-sm text-brand-black/68">{vaccine.summary}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-brand-black/45">{vaccine.cadence}</p>
                        </div>
                        <button
                          onClick={() => onToggleVaccine(vaccine)}
                          disabled={busyName === vaccine.name}
                          className={`rounded-full px-4 py-3 text-sm font-semibold ${done ? "bg-brand-green/20 text-brand-black" : "bg-brand-black text-white"} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {busyName === vaccine.name ? "Saving..." : done ? "Mark as not done" : "Tick as done"}
                        </button>
                      </div>
                      {!done ? (
                        <Link to="/owner/appointments" className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-orange px-4 py-3 text-sm font-semibold text-white">
                          Book appointment now
                          <ChevronRight size={16} />
                        </Link>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="section-shell">
              <SectionHeader title="Vaccination timeline" caption="Done and upcoming doses" />
              {visibleVaccinations.length ? <VaccinationTimeline items={visibleVaccinations} /> : <EmptyState title="No vaccine records yet" copy="Use the checklist to start." />}
            </div>
          </div>
          <div className="space-y-6">
            <div className="section-shell">
              <SectionHeader title="Upcoming reminders" />
              <FriendlyList
                items={visibleVaccinations.filter((item) => item.status !== "Given").map((item) => `${item.name} is due around ${formatDate(item.due_date)}`)}
                emptyCopy="Everything currently looks up to date."
              />
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}

function MedicationPage() {
  const guard = useRoleGuard("owner");
  const { bootstrap, selectedPet } = useDashboardData();

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  const medications = selectedPet
    ? bootstrap.medications.filter((item) => Number(item.pet_id) === Number(selectedPet.id))
    : bootstrap.medications;

  return (
    <AppShell title="Medication tracker" subtitle="A simpler schedule for doses, timing, notes, and follow-through.">
      {!medications.length ? (
        <EmptyState title="No medications yet" copy="Medication entries will appear here." />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {medications.map((medication) => (
            <div key={medication.id} className="section-shell">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-brand-black/45">Medication</p>
                  <h3 className="mt-2 font-heading text-3xl text-brand-black">{medication.name}</h3>
                </div>
                <div className="rounded-[18px] bg-brand-blue/14 p-3 text-brand-black">
                  <Pill size={18} />
                </div>
              </div>
              <div className="mt-5 space-y-3 text-sm text-brand-black/70">
                <div className="rounded-[20px] bg-brand-mist p-3">Dosage: {medication.dosage || "Not provided"}</div>
                <div className="rounded-[20px] bg-brand-mist p-3">Frequency: {medication.frequency || "Not provided"}</div>
                <div className="rounded-[20px] bg-brand-mist p-3">Duration: {formatDate(medication.start_date)} to {formatDate(medication.end_date)}</div>
                <div className="rounded-[20px] bg-brand-mist p-3">{medication.notes || "No extra notes yet."}</div>
              </div>
            </div>
          ))}
        </section>
      )}
    </AppShell>
  );
}

function WeightPage() {
  const guard = useRoleGuard("owner");
  const { bootstrap, selectedPet } = useDashboardData();

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  if (!selectedPet) {
    return <Navigate to="/owner/dashboard" replace />;
  }

  return (
    <AppShell title="Weight tracker" subtitle="Simple trend tracking, clearer context, and no fake health score attached to it.">
      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <WeightGraph data={bootstrap.weightSeries} petKey={selectedPet.name} />
        <div className="section-shell">
          <SectionHeader title="What to watch" />
          <div className="space-y-3 text-sm text-brand-black/72">
            <div className="rounded-[22px] bg-brand-green/18 p-4">Compare weight changes with meal changes, medications, and recent visits instead of using a health score.</div>
            <div className="rounded-[22px] bg-brand-yellow/20 p-4">If weight shifts quickly or appetite changes, message your vet or book a checkup.</div>
            <div className="rounded-[22px] bg-brand-blue/16 p-4">The chart is intentionally simple so owners can spot patterns fast.</div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function DietPlannerPage() {
  const guard = useRoleGuard("owner");
  const { bootstrap, selectedPet } = useDashboardData();
  const generatedDietPlan = useAppStore((state) => state.generatedDietPlan);
  const aiMessages = useAppStore((state) => state.aiMessages);
  const generateDietPlan = useAppStore((state) => state.generateDietPlan);
  const submitAiPrompt = useAppStore((state) => state.submitAiPrompt);
  const [planLoading, setPlanLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const planForm = useForm({
    defaultValues: {
      pantryItems: ""
    }
  });

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  if (!selectedPet) {
    return <Navigate to="/owner/dashboard" replace />;
  }

  const activePlan = generatedDietPlan || bootstrap.dietPlans[0] || null;
  const nutritionItems = activePlan?.nutrition_breakdown || activePlan?.nutrition || [];

  const onGeneratePlan = async ({ pantryItems }) => {
    setPlanError("");
    setPlanLoading(true);
    try {
      await generateDietPlan(pantryItems);
    } catch (error) {
      setPlanError(error.message || "We could not generate a diet plan just now.");
    } finally {
      setPlanLoading(false);
    }
  };

  const onSendQuestion = async (event) => {
    event.preventDefault();
    if (!chatInput.trim()) return;
    setChatError("");
    setChatLoading(true);
    try {
      await submitAiPrompt(chatInput.trim());
      setChatInput("");
    } catch (error) {
      setChatError(error.message || "We could not send that question.");
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <AppShell title="Diet AI" subtitle="Generate a pet diet chart and ask pantry-safe meal questions in one warm, practical CareSpace.">
      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-6">
          <form onSubmit={planForm.handleSubmit(onGeneratePlan)} className="section-shell space-y-4">
            <SectionHeader title="Generate a diet plan" caption="Powered by Gemini using age, breed, allergies, weight, and activity context from the selected pet." />
            <div className="rounded-[26px] bg-brand-mist p-4 text-sm text-brand-black/72">
              <p><strong>{selectedPet.name}</strong> - {selectedPet.breed || "Breed pending"} - {selectedPet.weight_kg || "-"} kg</p>
              <p className="mt-1">Allergies: {selectedPet.allergies || "None noted"} - Foods to avoid: {selectedPet.food_restrictions || "Not set"}</p>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-brand-black">What do you already have at home?</span>
              <textarea
                {...planForm.register("pantryItems")}
                rows={5}
                className="w-full rounded-[24px] border border-brand-light bg-white px-4 py-3"
                placeholder="Chicken, rice, carrots, pumpkin..."
              />
            </label>
            {planError ? <div className="rounded-[22px] bg-red-50 px-4 py-3 text-sm text-red-700">{planError}</div> : null}
            <button
              type="submit"
              disabled={planLoading}
              className="w-full rounded-[24px] bg-brand-black px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {planLoading ? "Generating plan..." : "Generate diet chart"}
            </button>
          </form>

          <div className="section-shell">
            <SectionHeader title="Ask diet questions" caption="Example: I have chicken, rice, and carrots. What can I prepare safely?" />
            <form onSubmit={onSendQuestion} className="space-y-3">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                rows={4}
                className="w-full rounded-[24px] border border-brand-light bg-white px-4 py-3"
                placeholder="Ask about pantry meals, ingredient safety, feeding portions, or schedule ideas."
              />
              {chatError ? <div className="rounded-[22px] bg-red-50 px-4 py-3 text-sm text-red-700">{chatError}</div> : null}
              <button
                type="submit"
                disabled={chatLoading}
                className="rounded-full bg-brand-orange px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {chatLoading ? "Thinking..." : "Send question"}
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="section-shell">
            <SectionHeader title="Generated diet plan" caption="A friendly summary with meals, timing, nutrition, and safety reminders." />
            {!activePlan ? (
              <EmptyState title="No diet plan yet" copy="Generate one to see daily meals, nutrition breakdown, and a meal schedule here." />
            ) : (
              <div className="space-y-6">
                <div className="rounded-[26px] bg-brand-yellow/18 p-5 text-sm text-brand-black/75">{activePlan.summary || activePlan.details}</div>
                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="section-shell border border-brand-light/50 bg-white p-5">
                    <SectionHeader title="Daily meals" />
                    <FriendlyList
                      items={(activePlan.daily_meals || activePlan.meals || []).map((meal) => {
                        const items = Array.isArray(meal.items) ? meal.items.join(", ") : meal.items || "";
                        return `${meal.time || "Time TBD"} - ${meal.name || meal.title || "Meal"} - ${items || meal.portion || "Portion pending"}`;
                      })}
                      emptyCopy="No meals generated yet."
                    />
                  </div>
                  <NutritionChart items={nutritionItems.length ? nutritionItems : [{ label: "Balanced", value: 100 }]} />
                </div>
                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="section-shell border border-brand-light/50 bg-white p-5">
                    <SectionHeader title="Meal schedule" />
                    <FriendlyList items={activePlan.meal_schedule || []} emptyCopy="No schedule available yet." />
                  </div>
                  <div className="section-shell border border-brand-light/50 bg-white p-5">
                    <SectionHeader title="Shopping and safety" />
                    <FriendlyList
                      items={[...(activePlan.shopping_tips || []), ...(activePlan.safety_notes || [])]}
                      emptyCopy="No extra notes available yet."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="section-shell">
            <SectionHeader title="Diet AI chat" caption="A separate conversation area for follow-up questions." />
            <div className="space-y-3">
              {aiMessages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function AppointmentPage() {
  const guard = useRoleGuard("owner");
  const { bootstrap, selectedPet } = useDashboardData();
  const bookAppointment = useAppStore((state) => state.bookAppointment);
  const [selectedVetId, setSelectedVetId] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [vetQuery, setVetQuery] = useState("");
  const [bookingState, setBookingState] = useState({ loading: false, error: "", success: "" });
  const {
    register,
    handleSubmit,
    watch,
    reset
  } = useForm({
    defaultValues: {
      appointment_kind: "general_checkup",
      vaccine_name: "",
      notes: ""
    }
  });

  useEffect(() => {
    const preferredVet = bootstrap.vets.find((vet) => vet.is_online) || bootstrap.vets[0];
    if (!selectedVetId && preferredVet) {
      setSelectedVetId(preferredVet.id);
    }
  }, [bootstrap.vets, selectedVetId]);

  const appointmentKind = watch("appointment_kind");
  const selectedVet = bootstrap.vets.find((vet) => Number(vet.id) === Number(selectedVetId)) || null;
  const allowedVaccines = vaccineGuides[selectedPet?.species] || [];
    const filteredVets = [...bootstrap.vets]
      .filter((vet) => {
        const haystack = `${vet.full_name || ""} ${vet.clinic_name || ""}`.toLowerCase();
        return haystack.includes(vetQuery.toLowerCase());
      })
      .sort((left, right) => `${left.full_name || left.clinic_name || ""}`.localeCompare(`${right.full_name || right.clinic_name || ""}`));

  const slotDays = useMemo(() => {
    if (!selectedVet) return [];
    const availableDays = String(selectedVet.available_days || "Mon,Tue,Wed,Thu,Fri")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const startHour = Number(selectedVet.start_hour ?? 8);
    const endHour = Number(selectedVet.end_hour ?? 17);
    const weekdayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const output = [];
    const cursor = new Date();

    while (output.length < 7) {
      const dayCode = weekdayMap[cursor.getDay()];
      if (availableDays.includes(dayCode)) {
        const slots = [];
        for (let hour = startHour; hour < endHour; hour += 1) {
          slots.push(`${String(hour).padStart(2, "0")}:00`);
          slots.push(`${String(hour).padStart(2, "0")}:30`);
        }
        output.push({
          date: cursor.toISOString().slice(0, 10),
          label: cursor.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
          slots
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return output;
  }, [selectedVet]);

  useEffect(() => {
    if (!selectedDate && slotDays[0]) {
      setSelectedDate(slotDays[0].date);
    }
  }, [selectedDate, slotDays]);

  const unavailableSlots = useMemo(() => {
    if (!selectedVet || !selectedDate) return new Set();
    return new Set(
      bootstrap.appointments
        .filter((appointment) => Number(appointment.vet_user_id) === Number(selectedVet.id))
        .filter((appointment) => appointment.start_time?.slice(0, 10) === selectedDate)
        .filter((appointment) => !["Cancelled", "Declined"].includes(appointment.status))
        .map((appointment) => appointment.start_time?.slice(11, 16))
    );
  }, [bootstrap.appointments, selectedDate, selectedVet]);

  const activeDay = slotDays.find((day) => day.date === selectedDate) || slotDays[0];
  const bookingDisabled = bookingState.loading || !selectedSlot || !selectedVet?.is_online;

  const onSubmit = async (values) => {
    if (!selectedPet || !selectedVet || !selectedDate || !selectedSlot) {
      setBookingState({ loading: false, error: "Please choose a vet, date, and time slot first.", success: "" });
      return;
    }

    setBookingState({ loading: true, error: "", success: "" });
    try {
      const payload = {
        pet_id: Number(selectedPet.id),
        vet_user_id: Number(selectedVet.id),
        appointment_kind: values.appointment_kind,
        notes: values.notes,
        start_time: isoForSlot(selectedDate, selectedSlot),
        end_time: plusThirtyMinutes(selectedDate, selectedSlot),
        type: values.appointment_kind === "vaccination" ? "Vaccination" : "General Checkup"
      };
      if (values.appointment_kind === "vaccination") {
        payload.vaccine_name = values.vaccine_name;
      }
      await bookAppointment({
        ...payload
      });
      reset({ appointment_kind: values.appointment_kind, vaccine_name: "", notes: "" });
      setSelectedSlot("");
        setBookingState({ loading: false, error: "", success: "Appointment request sent." });
    } catch (error) {
      setBookingState({ loading: false, error: error.message || "Booking failed. Please try a different slot.", success: "" });
    }
  };

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

    if (!selectedPet) {
      return <Navigate to="/owner/dashboard" replace />;
    }

    const selectedPetAppointments = bootstrap.appointments.filter((item) => Number(item.pet_id) === Number(selectedPet.id));

    return (
      <AppShell title="Appointment booking" subtitle="Choose a vet, date, and time.">
      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="section-shell space-y-4">
            <SectionHeader title="Booking details" />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-brand-black">Visit type</span>
              <select {...register("appointment_kind")} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3">
                <option value="general_checkup">General checkup</option>
                <option value="vaccination">Vaccination</option>
              </select>
            </label>
            {appointmentKind === "vaccination" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-brand-black">Vaccine name</span>
                <select {...register("vaccine_name")} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3">
                  <option value="">Select vaccine</option>
                  {allowedVaccines.map((vaccine) => (
                    <option key={vaccine.name} value={vaccine.name}>{vaccine.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-brand-black">Notes for the clinic</span>
              <textarea
                {...register("notes")}
                rows={4}
                className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3"
                placeholder="Share symptoms, concerns, or prep details."
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-brand-black">Vet selection</span>
              <input
                value={vetQuery}
                onChange={(event) => setVetQuery(event.target.value)}
                className="mb-3 w-full rounded-[22px] border border-brand-light bg-white px-4 py-3"
                placeholder="Search by vet or clinic"
              />
              <select
                value={selectedVetId || ""}
                onChange={(event) => {
                  setSelectedVetId(Number(event.target.value));
                  setSelectedDate("");
                  setSelectedSlot("");
                }}
                className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3"
              >
                <option value="">Select veterinarian</option>
                {filteredVets.map((vet) => (
                  <option key={vet.id} value={vet.id}>
                    {`${vet.full_name} - ${vet.clinic_name || "Clinic not added"}`}
                  </option>
                ))}
              </select>
            </label>
            {bookingState.error ? <div className="rounded-[22px] bg-red-50 px-4 py-3 text-sm text-red-700">{bookingState.error}</div> : null}
            {bookingState.success ? <div className="rounded-[22px] bg-brand-green/22 px-4 py-3 text-sm text-brand-black">{bookingState.success}</div> : null}
            <button
              type="submit"
              disabled={bookingDisabled}
              className="w-full rounded-[24px] bg-brand-black px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bookingState.loading ? "Booking..." : !selectedVet?.is_online ? "This vet is not accepting bookings yet" : selectedSlot ? `Book ${selectedSlot}` : "Choose a time slot first"}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="section-shell">
            <SectionHeader title="Available dates" caption={selectedVet ? `${selectedVet.full_name} - ${selectedVet.is_online ? "accepting bookings" : "currently offline"} - ${selectedVet.start_hour ?? 8}:00 to ${selectedVet.end_hour ?? 17}:00` : "Select a vet first."} />
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setSelectedSlot("");
              }}
              className="mb-4 rounded-[22px] border border-brand-light bg-white px-4 py-3"
            />
            <div className="flex flex-wrap gap-3">
              {slotDays.map((day) => (
                <button
                  key={day.date}
                  onClick={() => {
                    setSelectedDate(day.date);
                    setSelectedSlot("");
                  }}
                  className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                    selectedDate === day.date ? "bg-brand-black text-white" : "bg-brand-mist text-brand-black hover:bg-brand-blue/18"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div className="section-shell">
            <SectionHeader title="Choose a time slot" caption="Unavailable slots are disabled automatically when a booking already exists." />
            {!selectedVet?.is_online ? (
              <EmptyState title="This vet is offline right now" copy="They will still appear in the list, but booking opens once they turn on availability." />
            ) : !activeDay ? (
              <EmptyState title="No slots available yet" copy="Ask the vet to add working days and hours from the veterinarian availability screen." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {activeDay.slots.map((slot) => (
                  <AppointmentSlot
                    key={slot}
                    slot={slot}
                    disabled={unavailableSlots.has(slot)}
                    active={selectedSlot === slot}
                    onClick={(value) => setSelectedSlot(value)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="section-shell">
            <SectionHeader title="Appointment tracker" caption="Create, review, and track appointments in one place." />
            <div className="space-y-3">
              {selectedPetAppointments.length ? (
                selectedPetAppointments
                  .map((appointment) => (
                    <div key={appointment.id} className="rounded-[24px] bg-brand-mist p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag tone={statusTone(appointment.status)}>{appointment.status}</Tag>
                        <span className="text-sm font-semibold text-brand-black">{appointment.type}</span>
                      </div>
                      <p className="mt-2 text-sm text-brand-black/68">{formatDateTime(appointment.start_time)}</p>
                      <p className="mt-1 text-sm text-brand-black/60">{appointment.vet_name || "Vet pending assignment"}</p>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-brand-black/55">No appointments have been booked for this pet yet.</p>
              )}
            </div>
          </div>

          <div className="section-shell">
            <SectionHeader title="Upcoming appointments" />
            <FriendlyList
              items={selectedPetAppointments.filter((item) => ["Pending", "Confirmed"].includes(item.status)).map((item) => `${item.type} - ${formatDateTime(item.start_time)}`)}
              emptyCopy="No upcoming appointments."
            />
          </div>

          <div className="section-shell">
            <SectionHeader title="Appointment history" />
            <FriendlyList
              items={selectedPetAppointments.filter((item) => ["Completed", "Cancelled"].includes(item.status)).map((item) => `${item.type} - ${item.status} - ${formatDateTime(item.start_time)}`)}
              emptyCopy="No appointment history yet."
            />
          </div>

          <div className="section-shell">
            <SectionHeader title={`${selectedPet.species} vaccine guide`} caption="Use this while booking vaccine visits." />
            <div className="space-y-3">
              {allowedVaccines.map((vaccine) => {
                const existing = bootstrap.vaccinations.find((item) => Number(item.pet_id) === Number(selectedPet.id) && item.name === vaccine.name);
                const nextDueDays = existing?.due_date ? daysUntil(existing.due_date) : vaccine.interval_days;
                return (
                  <div key={vaccine.name} className="rounded-[22px] bg-brand-mist p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-2xl text-brand-black">{vaccine.name}</h3>
                      {existing?.status === "Given" ? <Tag tone="success">Done</Tag> : <Tag tone="warning">Due</Tag>}
                    </div>
                    <p className="mt-2 text-sm text-brand-black/68">{vaccine.summary}</p>
                    <p className="mt-2 text-sm text-brand-black/60">
                      {existing?.due_date ? `Next due in ${nextDueDays} days` : `Common next review in about ${vaccine.interval_days} days`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function CalendarPage() {
  const guard = useRoleGuard("vet");
  const bootstrap = useAppStore((state) => state.bootstrap);
  const saveVetAvailability = useAppStore((state) => state.saveVetAvailability);
  const [saveState, setSaveState] = useState({ loading: false, error: "", success: "" });
  const profile = bootstrap.vet;
  const {
    register,
    handleSubmit,
    setValue,
    watch
  } = useForm({
    values: {
      clinic_name: profile?.clinic_name || "",
      clinic_phone: profile?.clinic_phone || "",
      license_no: profile?.license_no || "",
      bio: profile?.bio || "",
      is_online: Boolean(profile?.is_online),
      start_hour: profile?.start_hour ?? 8,
      end_hour: profile?.end_hour ?? 17,
      available_days: String(profile?.available_days || "Mon,Tue,Wed,Thu,Fri")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    }
  });

  const activeDays = watch("available_days");
  const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const toggleDay = (day) => {
    const current = new Set(activeDays);
    if (current.has(day)) {
      current.delete(day);
    } else {
      current.add(day);
    }
    setValue("available_days", Array.from(current));
  };

  const onSubmit = async (values) => {
    setSaveState({ loading: true, error: "", success: "" });
    try {
      await saveVetAvailability({
        clinic_name: values.clinic_name,
        clinic_phone: values.clinic_phone,
        license_no: values.license_no,
        bio: values.bio,
        is_online: values.is_online,
        start_hour: Number(values.start_hour),
        end_hour: Number(values.end_hour),
        available_days: values.available_days.join(",")
      });
      setSaveState({ loading: false, error: "", success: "Availability updated successfully." });
    } catch (error) {
      setSaveState({ loading: false, error: error.message || "We could not save your availability.", success: "" });
    }
  };

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  return (
    <AppShell title="Vet availability" subtitle="Define bookable days and hours so owners see accurate time slots right away." accent="blue">
      <section className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <form onSubmit={handleSubmit(onSubmit)} className="section-shell space-y-4">
          <SectionHeader title="Availability settings" caption="These values drive the owner booking flow directly." />
          <label className="flex items-center justify-between rounded-[22px] bg-brand-mist px-4 py-4">
            <span className="text-sm font-semibold text-brand-black">Accept online bookings</span>
            <input type="checkbox" {...register("is_online")} className="h-5 w-5 rounded" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-brand-black">Clinic name</span>
            <input {...register("clinic_name")} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-brand-black">Clinic phone</span>
            <input {...register("clinic_phone")} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-brand-black">Start hour</span>
              <input {...register("start_hour")} type="number" min="0" max="23" className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-brand-black">End hour</span>
              <input {...register("end_hour")} type="number" min="1" max="23" className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3" />
            </label>
          </div>
          <div>
            <span className="mb-3 block text-sm font-semibold text-brand-black">Available days</span>
            <div className="flex flex-wrap gap-3">
              {dayOptions.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-full px-4 py-3 text-sm font-semibold ${activeDays.includes(day) ? "bg-brand-black text-white" : "bg-brand-mist text-brand-black"}`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-brand-black">Short bio</span>
            <textarea {...register("bio")} rows={4} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3" />
          </label>
          {saveState.error ? <div className="rounded-[22px] bg-red-50 px-4 py-3 text-sm text-red-700">{saveState.error}</div> : null}
          {saveState.success ? <div className="rounded-[22px] bg-brand-green/22 px-4 py-3 text-sm text-brand-black">{saveState.success}</div> : null}
          <button
            type="submit"
            disabled={saveState.loading}
            className="w-full rounded-[24px] bg-brand-black px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveState.loading ? "Saving..." : "Save availability"}
          </button>
        </form>

        <div className="space-y-6">
          <div className="section-shell">
            <SectionHeader title="How owners will see you" />
            {profile ? <VetCard vet={{ ...profile, ...watch() }} selected /> : <EmptyState title="Profile loading" copy="Your clinic card preview will appear here." />}
          </div>
          <div className="section-shell">
            <SectionHeader title="Upcoming appointments" caption="Use these status updates to keep owners informed." />
            <div className="space-y-3">
              {bootstrap.appointments.length ? (
                bootstrap.appointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-[24px] bg-brand-mist p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag tone={statusTone(appointment.status)}>{appointment.status}</Tag>
                      <span className="text-sm font-semibold">{appointment.type}</span>
                    </div>
                    <p className="mt-2 text-sm text-brand-black/68">{appointment.pet_name || `Pet #${appointment.pet_id}`} - {formatDateTime(appointment.start_time)}</p>
                    <p className="mt-1 text-sm text-brand-black/60">{appointment.owner_name || "Owner name unavailable"}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-brand-black/55">No appointments assigned yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function MessagesPage() {
  const currentRole = useAppStore((state) => state.currentRole);
  const bootstrap = useAppStore((state) => state.bootstrap);
  const activeChatId = useAppStore((state) => state.activeChatId);
  const setActiveChat = useAppStore((state) => state.setActiveChat);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const closeChat = useAppStore((state) => state.closeChat);
  const refreshBootstrap = useAppStore((state) => state.refreshBootstrap);
  const { selectedPet } = useDashboardData();
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [vetQuery, setVetQuery] = useState("");
  const [requestState, setRequestState] = useState({ loading: false, error: "", success: "" });
  const guard = useRoleGuard(currentRole || "owner");

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  const activeThread = bootstrap.chatThreads.find((thread) => Number(thread.id) === Number(activeChatId)) || bootstrap.chatThreads[0] || null;
  const filteredVets = bootstrap.vets.filter((vet) => `${vet.full_name} ${vet.clinic_name || ""}`.toLowerCase().includes(vetQuery.toLowerCase()));

  const onSend = async (event) => {
    event.preventDefault();
    if (!body.trim() && !attachment) return;
    setError("");
    setSending(true);
    try {
      if (activeThread && Number(activeThread.id) !== Number(activeChatId)) {
        await setActiveChat(activeThread.id);
      }
      await sendMessage({ body, attachment });
      setBody("");
      setAttachment(null);
    } catch (sendError) {
      setError(sendError.message || "Unable to send message right now.");
    } finally {
      setSending(false);
    }
  };

  const requestChat = async (vetId) => {
    if (!selectedPet) {
      setRequestState({ loading: false, error: "Select a pet first.", success: "" });
      return;
    }
    setRequestState({ loading: true, error: "", success: "" });
    try {
      const result = await liveApi.createChatRequest({ vet_user_id: vetId, pet_id: selectedPet.id, message: `Chat request for ${selectedPet.name}` });
      await refreshBootstrap();
      if (result.chat_id) {
        await setActiveChat(result.chat_id);
      }
      setRequestState({ loading: false, error: "", success: "Request sent." });
    } catch (requestError) {
      setRequestState({ loading: false, error: requestError.message || "Unable to send request.", success: "" });
    }
  };

  const handleRequest = async (requestId, action) => {
    try {
      if (action === "accept") {
        const result = await liveApi.acceptChatRequest(requestId);
        await refreshBootstrap();
        if (result.chat_id) {
          await setActiveChat(result.chat_id);
        }
      } else {
        await liveApi.declineChatRequest(requestId);
        await refreshBootstrap();
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to update request.");
    }
  };

  const onCloseChat = async () => {
    if (!activeThread) return;
    try {
      await closeChat(activeThread.id);
      setError("");
    } catch (closeError) {
      setError(closeError.message || "Unable to close chat.");
    }
  };

  return (
    <AppShell title="Messages" subtitle="Owner and vet conversations in one place." accent={currentRole === "vet" ? "blue" : "orange"}>
      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="section-shell">
          {currentRole === "owner" ? (
            <div className="mb-6 space-y-3">
              <SectionHeader title="Request a chat" caption={selectedPet ? `Selected pet: ${selectedPet.name}` : "Select a pet from the top bar first."} />
              <input
                value={vetQuery}
                onChange={(event) => setVetQuery(event.target.value)}
                className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3"
                placeholder="Search vets or clinics"
              />
              {requestState.error ? <div className="rounded-[20px] bg-red-50 px-4 py-3 text-sm text-red-700">{requestState.error}</div> : null}
              {requestState.success ? <div className="rounded-[20px] bg-brand-green/20 px-4 py-3 text-sm text-brand-black">{requestState.success}</div> : null}
              <div className="space-y-3">
                {filteredVets.slice(0, 4).map((vet) => (
                  <div key={vet.id} className="rounded-[22px] bg-brand-mist p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-brand-black">{vet.full_name}</p>
                        <p className="text-sm text-brand-black/60">{vet.clinic_name || "Clinic not added"}</p>
                      </div>
                      <button
                        onClick={() => requestChat(vet.id)}
                        disabled={requestState.loading}
                        className="rounded-full bg-brand-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Request chat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {currentRole === "vet" && bootstrap.chatRequests.filter((item) => item.status === "Pending").length ? (
            <div className="mb-6 space-y-3">
              <SectionHeader title="Pending requests" />
              {bootstrap.chatRequests
                .filter((item) => item.status === "Pending")
                .map((request) => (
                  <div key={request.id} className="rounded-[22px] bg-brand-mist p-4">
                    <p className="font-medium text-brand-black">{request.owner_name || "Pet owner"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => handleRequest(request.id, "accept")} className="rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-brand-black">
                        Accept
                      </button>
                      <button onClick={() => handleRequest(request.id, "decline")} className="rounded-full border border-brand-light bg-white px-4 py-2 text-sm font-semibold text-brand-black">
                        Decline
                      </button>
                      {request.pet_id ? (
                        <Link to={`/vet/patients/${request.pet_id}`} className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-brand-black">
                          View pet profile
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
          ) : null}

          <SectionHeader title="Conversation threads" />
          {!bootstrap.chatThreads.length ? (
            <EmptyState title="No conversations yet" copy="Once a chat is created, threads will appear here with the latest message preview." />
          ) : (
            <div className="space-y-3">
              {bootstrap.chatThreads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setActiveChat(thread.id)}
                  className={`w-full rounded-[24px] p-4 text-left transition ${Number(thread.id) === Number(activeChatId) ? "bg-brand-black text-white" : "bg-brand-mist text-brand-black"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">{currentRole === "vet" ? thread.owner_name || "Pet owner" : thread.vet_name || "Veterinarian"}</h3>
                    <div className="flex items-center gap-2">
                      <Tag tone={thread.is_closed ? "default" : "success"}>{thread.is_closed ? "Closed" : "Accepted"}</Tag>
                      <span className="text-xs opacity-70">{formatDate(thread.last_at, { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                  <p className={`mt-1 text-sm ${Number(thread.id) === Number(activeChatId) ? "text-white/70" : "text-brand-black/60"}`}>{thread.pet_name || "Pet chat"}</p>
                  <p className={`mt-2 line-clamp-2 text-sm ${Number(thread.id) === Number(activeChatId) ? "text-white/70" : "text-brand-black/65"}`}>{thread.last_body || "No messages yet."}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="section-shell">
          <SectionHeader
            title="Conversation"
            caption={activeThread ? `About ${activeThread.pet_name || "this pet"}` : "Select a thread to start reading messages."}
            action={
              currentRole === "vet" && activeThread?.pet_id ? (
                <div className="flex gap-2">
                  <Link to={`/vet/patients/${activeThread.pet_id}`} className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-brand-black">
                    Open pet profile
                  </Link>
                  {!activeThread?.is_closed ? (
                    <button onClick={onCloseChat} className="rounded-full border border-brand-light bg-white px-4 py-2 text-sm font-semibold text-brand-black">
                      Close chat
                    </button>
                  ) : null}
                </div>
              ) : null
            }
          />
          {!activeThread ? (
            <EmptyState title="Choose a conversation" copy="Pick a thread on the left to open messages and reply." />
          ) : (
            <>
              {activeThread.is_closed ? <div className="mb-4 rounded-[22px] bg-brand-mist px-4 py-3 text-sm text-brand-black">This consultation is closed. Send a new request to reopen communication.</div> : null}
              <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-[24px] bg-brand-mist/70 p-4">
                {bootstrap.messages.length ? bootstrap.messages.map((message) => <ChatBubble key={message.id} message={message} />) : <p className="text-sm text-brand-black/55">No messages in this thread yet.</p>}
              </div>
              <form onSubmit={onSend} className="mt-4 space-y-3">
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={4}
                  disabled={activeThread.is_closed}
                  className="w-full rounded-[24px] border border-brand-light bg-white px-4 py-3"
                  placeholder="Write a warm, useful reply..."
                />
                <label className="flex cursor-pointer items-center gap-3 rounded-[22px] bg-brand-mist px-4 py-3">
                  <div className="rounded-[16px] bg-white p-2">
                    <ImagePlus size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-black">{attachment ? attachment.name : "Add an image or file"}</p>
                    <p className="text-xs text-brand-black/55">Send pet photos, lab snapshots, or notes directly in the thread.</p>
                  </div>
                  <input type="file" accept="image/*,.pdf,.txt,.doc,.docx" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
                </label>
                {error ? <div className="rounded-[22px] bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                <button
                  type="submit"
                  disabled={sending || activeThread.is_closed}
                  className="rounded-full bg-brand-orange px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Sending..." : attachment ? "Send message and attachment" : "Send message"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function NotificationsPage() {
  const currentRole = useAppStore((state) => state.currentRole);
  const bootstrap = useAppStore((state) => state.bootstrap);
  const markNotificationsRead = useAppStore((state) => state.markNotificationsRead);
  const [busy, setBusy] = useState(false);
  const guard = useRoleGuard(currentRole || "owner");

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  const onMarkAll = async () => {
    setBusy(true);
    try {
      await markNotificationsRead();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Notifications" subtitle="Friendly alerts for appointments, reminders, and care updates." accent={currentRole === "vet" ? "blue" : "orange"}>
      <section className="section-shell">
        <SectionHeader
          title="Recent alerts"
          action={
            <button
              onClick={onMarkAll}
              disabled={busy}
              className="rounded-full bg-brand-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Saving..." : "Mark all as read"}
            </button>
          }
        />
        {!bootstrap.notifications.length ? (
          <EmptyState title="No notifications yet" copy="When reminders or appointment updates arrive, they will show up here in a cleaner format." />
        ) : (
          <div className="space-y-3">
            {bootstrap.notifications.map((notification) => (
              <div key={notification.id} className={`rounded-[24px] p-4 ${notification.is_read ? "bg-brand-mist" : "bg-brand-yellow/20"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={notification.is_read ? "default" : "warning"}>{notification.is_read ? "Read" : "New"}</Tag>
                  <span className="text-sm font-semibold text-brand-black">{toTitleCase(notification.type || "notification")}</span>
                </div>
                <p className="mt-2 text-sm text-brand-black/70">{notification.message}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-brand-black/40">{formatDateTime(notification.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function SettingsPage() {
  const currentRole = useAppStore((state) => state.currentRole);
  const currentUser = useAppStore((state) => state.currentUser);
  const bootstrap = useAppStore((state) => state.bootstrap);
  const guard = useRoleGuard(currentRole || "owner");

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  const cards =
    currentRole === "vet"
      ? [
          `Clinic: ${bootstrap.vet?.clinic_name || "Not added yet"}`,
          `Availability: ${bootstrap.vet?.available_days || "No working days saved"}`,
          `Status: ${bootstrap.vet?.is_online ? "Accepting bookings" : "Offline"}`
        ]
      : [
          `Preferred reminders: ${bootstrap.settings?.reminders ? "Enabled" : "Not configured"}`,
          `Pets in account: ${bootstrap.pets.length}`,
          `Unread alerts: ${bootstrap.notifications.filter((item) => !item.is_read).length}`
        ];

  return (
    <AppShell title="Settings" subtitle="Manage your account and preferences." accent={currentRole === "vet" ? "blue" : "orange"}>
      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="section-shell">
          <SectionHeader title="Account" />
          <div className="space-y-3 text-sm text-brand-black/72">
            <div className="rounded-[22px] bg-brand-mist p-4">Name: {currentUser?.full_name || "Not available"}</div>
            <div className="rounded-[22px] bg-brand-mist p-4">Email: {currentUser?.email || "Not available"}</div>
            <div className="rounded-[22px] bg-brand-mist p-4">Role: {toTitleCase(currentRole || "user")}</div>
          </div>
        </div>
        <div className="section-shell">
            <SectionHeader title="CareSpace highlights" />
          <FriendlyList items={cards} emptyCopy="No settings have been saved yet." />
        </div>
      </section>
    </AppShell>
  );
}

function VetDashboardPage() {
  const guard = useRoleGuard("vet");
  const bootstrap = useAppStore((state) => state.bootstrap);
  const updateAppointment = useAppStore((state) => state.updateAppointment);
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState(null);

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  const onUpdate = async (appointment, payload) => {
    setLoadingId(appointment.id);
    try {
      await updateAppointment(appointment.id, payload);
      if (payload.status === "Completed") {
        navigate(`/vet/reports?appointmentId=${appointment.id}`);
      }
    } finally {
      setLoadingId(null);
    }
  };

  const pendingRequests = bootstrap.appointments.filter((item) => item.status === "Pending");
  const reportCount = bootstrap.appointments.filter((item) => item.has_report).length;

  return (
    <AppShell title="Veterinarian dashboard" subtitle="Appointments, patients, and messages." accent="blue">
      <section className="data-grid">
        <StatCard label="Patients" value={bootstrap.patients.length} helper="Pets connected to your appointment history." tint="blue" />
        <StatCard label="Pending visits" value={pendingRequests.length} helper="Requests that still need action from you." tint="yellow" />
        <StatCard label="Messages" value={bootstrap.chatThreads.length} helper="Conversation threads with owners." tint="green" />
          <StatCard label="Reports" value={reportCount} helper="Existing report summaries tied to appointments." />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="space-y-6">
          {bootstrap.vet ? <VetCard vet={bootstrap.vet} selected /> : <EmptyState title="Complete your clinic profile" copy="Add availability and clinic details so owners can book you smoothly." />}
          <div className="section-shell">
            <SectionHeader title="Quick actions" />
            <div className="grid gap-3">
              <DashboardTile icon={<CalendarDays size={18} />} title="Set availability" copy="Define days and hours owners can book." to="/vet/calendar" tone="blue" />
              <DashboardTile icon={<ClipboardList size={18} />} title="Open patient list" copy="See context across visits and owners." to="/vet/patients" tone="green" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="section-shell">
            <SectionHeader title="Appointment queue" caption="Keep owners updated by confirming, completing, or cancelling appointments." />
            <div className="space-y-4">
              {bootstrap.appointments.length ? (
                bootstrap.appointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-[26px] bg-brand-mist p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag tone={statusTone(appointment.status)}>{appointment.status}</Tag>
                      <span className="text-sm font-semibold text-brand-black">{appointment.type}</span>
                    </div>
                    <h3 className="mt-3 font-heading text-3xl text-brand-black">{appointment.pet_name || `Pet #${appointment.pet_id}`}</h3>
                    <p className="mt-1 text-sm text-brand-black/68">{appointment.owner_name || "Owner"} - {formatDateTime(appointment.start_time)}</p>
                    <p className="mt-2 text-sm text-brand-black/62">{appointment.notes || "No note provided for this visit."}</p>
                    <div className="mt-4">
                      <AppointmentStatusButton appointment={appointment} onUpdate={onUpdate} loadingId={loadingId} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-brand-black/55">No appointments yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function VetPatientsPage() {
  const guard = useRoleGuard("vet");
  const bootstrap = useAppStore((state) => state.bootstrap);
  const navigate = useNavigate();

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  return (
    <AppShell title="Patient list" subtitle="A readable cross-owner patient list with recent visit context." accent="blue">
      {!bootstrap.patients.length ? (
        <EmptyState title="No patients yet" copy="Once appointments are connected to your account, patients will appear here automatically." />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bootstrap.patients.map((patient) => (
            <button key={patient.pet_id} onClick={() => navigate(`/vet/patients/${patient.pet_id}`)} className="section-shell text-left transition hover:-translate-y-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-brand-black/45">Patient</p>
                  <h3 className="mt-2 font-heading text-3xl text-brand-black">{patient.pet_name}</h3>
                </div>
                <Tag tone="info">{patient.species}</Tag>
              </div>
              <div className="mt-4 space-y-3 text-sm text-brand-black/70">
                <div className="rounded-[20px] bg-brand-mist p-3">Breed: {patient.breed || "Not added"}</div>
                <div className="rounded-[20px] bg-brand-mist p-3">Owner: {patient.owner_name || "Not available"}</div>
                <div className="rounded-[20px] bg-brand-mist p-3">Weight: {patient.weight_kg || "-"} kg</div>
                <div className="rounded-[20px] bg-brand-mist p-3">Last visit: {patient.last_visit ? formatDate(patient.last_visit) : "No visit yet"}</div>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-orange">
                Open full patient record
                <ChevronRight size={16} />
              </div>
            </button>
          ))}
        </section>
      )}
    </AppShell>
  );
}

function VetPatientDetailPage() {
  const guard = useRoleGuard("vet");
  const bootstrap = useAppStore((state) => state.bootstrap);
  const { petId } = useParams();
  const [state, setState] = useState({ loading: true, error: "", detail: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setState({ loading: true, error: "", detail: null });
      try {
        const detail = await liveApi.fetchVetPatientDetail(petId);
        if (!cancelled) {
          setState({ loading: false, error: "", detail });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ loading: false, error: error.message || "Unable to load the patient record.", detail: null });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [petId]);

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  if (state.loading) {
    return (
      <AppShell title="Patient record" subtitle="Loading this pet's full profile and history." accent="blue">
          <EmptyState title="Loading patient details" copy="Loading profile and care history." />
      </AppShell>
    );
  }

  if (state.error || !state.detail) {
    return (
      <AppShell title="Patient record" subtitle="We could not open this patient yet." accent="blue">
        <EmptyState title="Patient unavailable" copy={state.error || "The requested patient record could not be loaded."} />
      </AppShell>
    );
  }

  const { patient, owner, appointments, vaccinations, medications, records, reports } = state.detail;
  const appointmentList = appointments.length
    ? appointments
    : bootstrap.appointments.filter((item) => Number(item.pet_id) === Number(petId));
  const visibleVaccinations = mergeVaccinationSources(vaccinations, appointmentList);
  const reportLinks = reports.map((report, index) => ({
    id: `${report.appointment_id || index}`,
    label: `${report.appointment_type || "Vet report"} - ${formatDateTime(report.appointment_time)}`
  }));
  const reportRecordItems = records.filter((item) => String(item.title || item.name || "").toLowerCase().includes("appointment report"));

  return (
    <AppShell title="Patient record" subtitle="A complete pet profile with owner context, visits, medications, vaccines, and reports." accent="blue">
      <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="section-shell">
          <div className="flex items-center gap-4">
            <PetAvatar pet={patient} size="lg" />
            <div>
              <h2 className="font-heading text-5xl text-brand-black">{patient.name}</h2>
              <p className="text-sm text-brand-black/60">{patient.species} - {patient.breed || "Breed not added"}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Tag tone="accent">{patient.age_months || "-"} months</Tag>
            <Tag tone="info">{patient.weight_kg || "-"} kg</Tag>
            {patient.activity_level ? <Tag tone="success">{patient.activity_level}</Tag> : null}
          </div>
          <div className="mt-6 space-y-3 text-sm text-brand-black/72">
            <div className="rounded-[22px] bg-brand-mist p-4">Owner: {owner.full_name || "Not available"}</div>
            <div className="rounded-[22px] bg-brand-mist p-4">Contact: {owner.email || "No email"} {owner.phone ? `- ${owner.phone}` : ""}</div>
            <div className="rounded-[22px] bg-brand-mist p-4">Allergies: {patient.allergies || "No allergy note yet."}</div>
            <div className="rounded-[22px] bg-brand-mist p-4">Medical history: {patient.health_conditions || patient.diseases || "No medical history added yet."}</div>
            <div className="rounded-[22px] bg-brand-mist p-4">Food restrictions: {patient.food_restrictions || "No restrictions saved."}</div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="section-shell">
              <SectionHeader title="Vaccinations" />
              <FriendlyList items={visibleVaccinations.map((item) => `${item.name} - ${item.status} - ${formatDate(item.due_date)}`)} emptyCopy="No vaccinations recorded yet." />
            </div>
            <div className="section-shell">
              <SectionHeader title="Medications" />
              <FriendlyList items={medications.map((item) => `${item.name} - ${item.dosage || "Dose pending"} - ${item.frequency || "Frequency pending"}`)} emptyCopy="No medications recorded yet." />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="section-shell">
              <SectionHeader title="Appointments" />
              <FriendlyList items={appointmentList.map((item) => `${item.type} - ${item.status} - ${formatDateTime(item.start_time)}`)} emptyCopy="No appointments on file yet." />
            </div>
            <div className="section-shell">
              <SectionHeader title="Records" />
              <div className="space-y-3">
                {reportLinks.map((item) => (
                  <Link key={item.id} to="/vet/reports" className="block rounded-[22px] bg-brand-blue/14 px-4 py-3 text-sm text-brand-black/80 transition hover:bg-brand-blue/20">
                    {item.label}
                  </Link>
                ))}
                {records.map((item) => (
                  <div key={item.id} className="rounded-[22px] bg-brand-mist px-4 py-3 text-sm text-brand-black/72">
                    {item.title || item.name || "Untitled record"}
                  </div>
                ))}
                {!reportLinks.length && !records.length ? <p className="text-sm text-brand-black/55">No uploaded records yet.</p> : null}
              </div>
            </div>
          </div>
            {reports.length ? (
              <section className="space-y-6">
                {reports.map((report, index) => (
                  <Link key={`${report.diagnosis}-${index}`} to="/vet/reports" className="block">
                    <PetReportCard report={report} petName={patient.name} />
                  </Link>
                ))}
              </section>
            ) : reportRecordItems.length ? (
              <div className="section-shell">
                <SectionHeader title="Vet reports" />
                <div className="space-y-3">
                  {reportRecordItems.map((item) => (
                    <Link key={item.id} to="/vet/reports" className="block rounded-[22px] bg-brand-blue/14 px-4 py-3 text-sm text-brand-black/80 transition hover:bg-brand-blue/20">
                      {item.title || item.name || "Appointment report"}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="section-shell">
                <SectionHeader title="Vet reports" />
                <p className="text-sm text-brand-black/60">No appointment report has been uploaded for this patient yet.</p>
              </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function VetReportsPage() {
  const guard = useRoleGuard("vet");
  const bootstrap = useAppStore((state) => state.bootstrap);
  const refreshBootstrap = useAppStore((state) => state.refreshBootstrap);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [reportValues, setReportValues] = useState({
    diagnosis: "",
    medications_and_doses: "",
    diet_recommendation: "",
    general_recommendation: ""
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [reportCards, setReportCards] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportQuery, setReportQuery] = useState("");
  const [expandedReportId, setExpandedReportId] = useState("");

  const reportAppointments = bootstrap.appointments.filter((item) => ["Confirmed", "Completed"].includes(item.status));

  useEffect(() => {
    let cancelled = false;

    const loadReportCards = async () => {
      const appointmentsWithReports = bootstrap.appointments.filter((item) => item.has_report);
      if (!appointmentsWithReports.length) {
        if (!cancelled) {
          setReportCards([]);
          setReportsLoading(false);
        }
        return;
      }

      setReportsLoading(true);
      const results = await Promise.all(
        appointmentsWithReports.map(async (appointment) => {
          try {
            const data = await liveApi.fetchAppointmentReport(appointment.id);
            if (!data.report) return null;
            return {
              appointment_id: appointment.id,
              appointment_type: appointment.type,
              appointment_time: appointment.start_time,
              diagnosis: data.report.Diagnosis,
              medications_and_doses: data.report.MedicationsAndDoses,
              diet_recommendation: data.report.DietRecommendation,
              general_recommendation: data.report.GeneralRecommendation,
              pet_name: appointment.pet_name || "Patient"
            };
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        setReportCards(results.filter(Boolean));
        setReportsLoading(false);
      }
    };

    loadReportCards();

    return () => {
      cancelled = true;
    };
  }, [bootstrap.appointments]);

  useEffect(() => {
    const appointmentId = searchParams.get("appointmentId") || "";
    if (!appointmentId) return;
    setSelectedAppointmentId(appointmentId);
    loadReport(appointmentId);
  }, [searchParams]);

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  const loadReport = async (appointmentId) => {
    setSelectedAppointmentId(appointmentId);
    if (appointmentId) {
      setSearchParams({ appointmentId: String(appointmentId) });
    } else {
      setSearchParams({});
    }
    if (!appointmentId) return;
    const data = await liveApi.fetchAppointmentReport(appointmentId);
    setReportValues({
      diagnosis: data.report?.Diagnosis || "",
      medications_and_doses: data.report?.MedicationsAndDoses || "",
      diet_recommendation: data.report?.DietRecommendation || "",
      general_recommendation: data.report?.GeneralRecommendation || ""
    });
  };

  const saveReport = async () => {
    if (!selectedAppointmentId) return;
    setSaving(true);
    setSaveMessage("");
      try {
        await liveApi.saveAppointmentReport(selectedAppointmentId, reportValues);
        await refreshBootstrap();
        setSaveMessage("Report saved.");
        setExpandedReportId(String(selectedAppointmentId));
      } catch (error) {
        setSaveMessage(error.message || "Unable to save report.");
      } finally {
        setSaving(false);
      }
    };

    const filteredReports = reportCards.filter((report) =>
      `${report.pet_name} ${report.appointment_type}`.toLowerCase().includes(reportQuery.toLowerCase())
    );

    return (
      <AppShell title="Reports" subtitle="Patient reports." accent="blue">
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="section-shell space-y-4">
          <SectionHeader title="Write a report" />
          <select value={selectedAppointmentId} onChange={(event) => loadReport(event.target.value)} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3">
              <option value="">Select appointment</option>
              {reportAppointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {`${appointment.pet_name || "Pet"} - ${appointment.type || "Appointment"} - ${formatDateTime(appointment.start_time)}`}
                </option>
              ))}
            </select>
          <textarea rows={4} value={reportValues.diagnosis} onChange={(event) => setReportValues((current) => ({ ...current, diagnosis: event.target.value }))} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3" placeholder="Diagnosis" />
          <textarea rows={3} value={reportValues.medications_and_doses} onChange={(event) => setReportValues((current) => ({ ...current, medications_and_doses: event.target.value }))} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3" placeholder="Medications and doses" />
          <textarea rows={3} value={reportValues.diet_recommendation} onChange={(event) => setReportValues((current) => ({ ...current, diet_recommendation: event.target.value }))} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3" placeholder="Diet recommendation" />
          <textarea rows={3} value={reportValues.general_recommendation} onChange={(event) => setReportValues((current) => ({ ...current, general_recommendation: event.target.value }))} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3" placeholder="General recommendation" />
          {saveMessage ? <div className="rounded-[20px] bg-brand-mist px-4 py-3 text-sm text-brand-black">{saveMessage}</div> : null}
          <button onClick={saveReport} disabled={!selectedAppointmentId || saving} className="rounded-full bg-brand-black px-5 py-3 font-semibold text-white disabled:opacity-60">
            {saving ? "Saving..." : "Save report"}
          </button>
        </div>

          <div className="space-y-4">
            <input
              value={reportQuery}
              onChange={(event) => setReportQuery(event.target.value)}
              placeholder="Search by pet name or appointment type"
              className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3"
            />
          {reportsLoading ? (
            <EmptyState title="Loading reports" copy="Saved reports are being prepared." />
          ) : !filteredReports.length ? (
            <EmptyState title="No reports available" copy="Saved reports will appear here." />
          ) : (
            <section className="space-y-6">
              {filteredReports.map((report, index) => (
                <CompactReportRow
                  key={`${report.appointment_id}-${index}`}
                  report={report}
                  expanded={expandedReportId === String(report.appointment_id)}
                  onToggle={() => setExpandedReportId((current) => (current === String(report.appointment_id) ? "" : String(report.appointment_id)))}
                />
              ))}
            </section>
          )}
          </div>
        </section>
      </AppShell>
    );
  }

function HomeRedirect() {
  const currentUser = useAppStore((state) => state.currentUser);
  const currentRole = useAppStore((state) => state.currentRole);

  if (!currentUser) {
    return <LandingPage />;
  }

  return <Navigate to={currentRole === "vet" ? "/vet/dashboard" : "/owner/dashboard"} replace />;
}

function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="grid min-h-screen place-items-center bg-hero-wash px-4">
      <div className="glass-panel max-w-lg p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue/18 text-brand-black">
          <BellRing />
        </div>
        <h1 className="mt-5 font-heading text-5xl text-brand-black">Page not found</h1>
        <p className="mt-3 text-base text-brand-black/66">We could not find <span className="font-semibold">{location.pathname}</span>. Let us bring you back to a calmer place.</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-brand-black px-5 py-3 font-semibold text-white">
          Return home
        </Link>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppRoot />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: "auth/login", element: <AuthPage mode="login" /> },
      { path: "auth/signup", element: <AuthPage mode="signup" /> },
      { path: "quiz", element: <RouteGate role="owner"><QuizPage /></RouteGate> },
        { path: "owner/dashboard", element: <RouteGate role="owner"><OwnerDashboardPage /></RouteGate> },
        { path: "owner/pets", element: <RouteGate role="owner"><PetProfilePage /></RouteGate> },
        { path: "owner/guide", element: <RouteGate role="owner"><GuidePage /></RouteGate> },
        { path: "owner/report", element: <RouteGate role="owner"><ReportPage /></RouteGate> },
      { path: "owner/vaccinations", element: <RouteGate role="owner"><VaccinationPage /></RouteGate> },
      { path: "owner/medications", element: <RouteGate role="owner"><MedicationPage /></RouteGate> },
      { path: "owner/weights", element: <RouteGate role="owner"><WeightPage /></RouteGate> },
      { path: "owner/diet-planner", element: <RouteGate role="owner"><DietPlannerPage /></RouteGate> },
      { path: "owner/ai-chat", element: <Navigate to="/owner/diet-planner" replace /> },
      { path: "owner/appointments", element: <RouteGate role="owner"><AppointmentPage /></RouteGate> },
      { path: "owner/messages", element: <RouteGate role="owner"><MessagesPage /></RouteGate> },
      { path: "owner/notifications", element: <RouteGate role="owner"><NotificationsPage /></RouteGate> },
      { path: "owner/settings", element: <RouteGate role="owner"><SettingsPage /></RouteGate> },
      { path: "vet/dashboard", element: <RouteGate role="vet"><VetDashboardPage /></RouteGate> },
      { path: "vet/patients", element: <RouteGate role="vet"><VetPatientsPage /></RouteGate> },
      { path: "vet/patients/:petId", element: <RouteGate role="vet"><VetPatientDetailPage /></RouteGate> },
      { path: "vet/calendar", element: <RouteGate role="vet"><CalendarPage /></RouteGate> },
      { path: "vet/reports", element: <RouteGate role="vet"><VetReportsPage /></RouteGate> },
      { path: "vet/messages", element: <RouteGate role="vet"><MessagesPage /></RouteGate> },
      { path: "vet/notifications", element: <RouteGate role="vet"><NotificationsPage /></RouteGate> },
      { path: "vet/settings", element: <RouteGate role="vet"><SettingsPage /></RouteGate> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
