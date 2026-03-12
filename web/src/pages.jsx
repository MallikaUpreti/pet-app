import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { createBrowserRouter, Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BellRing,
  Bone,
  CalendarDays,
  CalendarPlus2,
  ChevronRight,
  ClipboardList,
  LoaderCircle,
  MessageSquareText,
  PawPrint,
  Pill,
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
  return stamp.toISOString();
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
          <h1 className="mt-5 font-heading text-4xl text-brand-black">Warming up PawCare HQ</h1>
          <p className="muted-copy mt-2">Pulling in pets, appointments, reminders, and chat history from your live backend.</p>
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
    orange: "from-brand-orange/20 to-white",
    blue: "from-brand-blue/18 to-white",
    green: "from-brand-green/20 to-white",
    yellow: "from-brand-yellow/26 to-white"
  };
  return (
    <Link to={to} className={`rounded-[28px] border border-white/70 bg-gradient-to-br ${tones[tone]} p-5 shadow-soft transition hover:-translate-y-1`}>
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-[22px] bg-white p-3 text-brand-black">{icon}</div>
        <ChevronRight size={18} className="text-brand-black/40" />
      </div>
      <h3 className="mt-5 font-heading text-3xl text-brand-black">{title}</h3>
      <p className="mt-2 text-sm text-brand-black/65">{copy}</p>
    </Link>
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

function AppointmentStatusButton({ appointment, onUpdate, loadingId }) {
  const canConfirm = appointment.status === "Pending";
  const canComplete = appointment.status === "Confirmed";

  return (
    <div className="flex flex-wrap gap-2">
      {canConfirm ? (
        <button
          onClick={() => onUpdate(appointment.id, { status: "Confirmed" })}
          disabled={loadingId === appointment.id}
          className="rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-brand-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingId === appointment.id ? "Saving..." : "Confirm"}
        </button>
      ) : null}
      {canComplete ? (
        <button
          onClick={() => onUpdate(appointment.id, { status: "Completed" })}
          disabled={loadingId === appointment.id}
          className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-brand-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingId === appointment.id ? "Saving..." : "Mark complete"}
        </button>
      ) : null}
      {appointment.status !== "Cancelled" && appointment.status !== "Completed" ? (
        <button
          onClick={() => onUpdate(appointment.id, { status: "Cancelled" })}
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
    selectedPet?.activity_level || "Everyday activity not added",
    selectedPet?.allergies ? `Allergies: ${selectedPet.allergies}` : "No allergy note"
  ];

  return (
    <div className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(242,140,56,0.12),rgba(234,203,90,0.18),rgba(255,255,255,0.95))]">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="eyebrow">Today with {selectedPet?.name || "your pet"}</span>
          <h2 className="mt-4 font-heading text-5xl text-brand-black">A calmer care routine, all in one place.</h2>
          <p className="mt-3 max-w-2xl text-base text-brand-black/68">
            Keep meals, reminders, checkups, and conversations feeling easy. The dashboard focuses on what pet parents actually need next.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Tag key={tag} tone={tag.startsWith("Allergies") ? "warning" : "accent"}>
                {tag}
              </Tag>
            ))}
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <div className="rounded-[26px] bg-white/85 p-4">
              <p className="text-sm font-semibold text-brand-black/50">Next visit</p>
              <p className="mt-2 font-heading text-3xl text-brand-black">
                {nextAppointment ? formatDateTime(nextAppointment.start_time) : "Nothing booked yet"}
              </p>
              <p className="mt-2 text-sm text-brand-black/65">
                {nextAppointment ? `${nextAppointment.type} with ${nextAppointment.vet_name || "your veterinarian"}` : "Pick a slot when you are ready."}
              </p>
            </div>
            <div className="rounded-[26px] bg-brand-black p-4 text-white">
              <p className="text-sm font-semibold text-white/55">Diet focus</p>
              <p className="mt-2 font-heading text-3xl">Safer meals, less guesswork</p>
              <p className="mt-2 text-sm text-white/72">Generate a plan and ask pantry questions without digging through technical screens.</p>
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
    <div className="min-h-screen bg-hero-wash px-4 py-5 md:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-[26px] bg-brand-orange p-4 text-white shadow-soft">
              <PawPrint size={24} />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-brand-black/45">Pet care platform</p>
              <h1 className="font-heading text-4xl text-brand-black md:text-5xl">PawCare HQ</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/auth/login" className="rounded-full border border-brand-black/15 bg-white px-5 py-3 font-semibold text-brand-black">
              Login
            </Link>
            <Link to="/auth/signup" className="rounded-full bg-brand-black px-5 py-3 font-semibold text-white">
              Start now
            </Link>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="glass-panel overflow-hidden p-8 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <span className="eyebrow">Friendly care coordination</span>
                <h2 className="mt-4 font-heading text-5xl leading-none text-brand-black md:text-7xl">Warm pet-care flows with real backend integration.</h2>
                <p className="mt-4 max-w-xl text-base text-brand-black/68">
                  Owner and veterinarian workspaces, live appointments, full pet records, diet planning, messaging, and reminders without the developer-looking clutter.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/auth/signup" className="rounded-full bg-brand-orange px-5 py-3 font-semibold text-white">
                    Create an owner account
                  </Link>
                  <Link to="/auth/login" className="rounded-full bg-brand-blue px-5 py-3 font-semibold text-brand-black">
                    Open dashboards
                  </Link>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[30px] bg-brand-yellow p-5 text-brand-black">
                  <p className="text-sm uppercase tracking-[0.2em] text-brand-black/45">Owners</p>
                  <h3 className="mt-3 font-heading text-4xl">Easy daily care</h3>
                  <p className="mt-2 text-sm text-brand-black/70">Meals, checkups, reminders, and messages that feel light instead of technical.</p>
                </div>
                <div className="rounded-[30px] bg-brand-green p-5 text-brand-black">
                  <p className="text-sm uppercase tracking-[0.2em] text-brand-black/45">Vets</p>
                  <h3 className="mt-3 font-heading text-4xl">Clear clinical flow</h3>
                  <p className="mt-2 text-sm text-brand-black/70">Availability, patient context, reports, and communication in one clean workspace.</p>
                </div>
                <div className="rounded-[30px] bg-brand-black p-5 text-white sm:col-span-2">
                  <p className="text-sm uppercase tracking-[0.2em] text-white/45">Designed for real usage</p>
                  <h3 className="mt-3 font-heading text-4xl">Modern telehealth energy, but pet-first.</h3>
                  <p className="mt-2 max-w-lg text-sm text-white/72">
                    Rounded cards, stronger color, simpler navigation, clearer forms, and live API-driven features that can grow with your MSSQL backend.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="glass-panel p-6">
              <SectionHeader title="What feels better now" caption="Less backend talk, more real care moments." />
              <div className="grid gap-3">
                {[
                  "Owner dashboard centered on pets, meals, visits, and alerts",
                  "Diet AI split into plan generation and pantry question chat",
                  "Cleaner appointment booking with visible time slots and state feedback",
                  "Dedicated veterinarian calendar and patient management"
                ].map((item, index) => (
                  <div key={item} className={`rounded-[24px] p-4 text-sm ${index % 2 === 0 ? "bg-brand-mist" : "bg-brand-blue/12"}`}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-panel p-6">
              <SectionHeader title="Built for two roles" />
              <div className="space-y-3">
                <div className="rounded-[26px] bg-brand-orange/16 p-5">
                  <h3 className="font-heading text-3xl text-brand-black">Pet owner experience</h3>
                  <p className="mt-2 text-sm text-brand-black/68">Onboarding, pet profiles, vaccination tracking, diet support, appointments, chat, notifications, and settings.</p>
                </div>
                <div className="rounded-[26px] bg-brand-blue/16 p-5">
                  <h3 className="font-heading text-3xl text-brand-black">Veterinarian experience</h3>
                  <p className="mt-2 text-sm text-brand-black/68">Availability setup, incoming appointments, full patient view, reports, messaging, and clinic profile controls.</p>
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
    <div className="grid min-h-screen place-items-center bg-hero-wash px-4 py-6">
      <div className="grid w-full max-w-6xl gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="glass-panel p-8 md:p-10">
          <span className="eyebrow">{mode === "signup" ? "Create your account" : "Welcome back"}</span>
          <h1 className="mt-4 font-heading text-5xl text-brand-black">
            {mode === "signup" ? "Let us set up your pet-care home." : "Step back into your care workspace."}
          </h1>
          <p className="mt-3 text-base text-brand-black/66">
            The form stays intentionally simple. Once you are in, the rest of the product adapts to whether you are a pet owner or a veterinarian.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-brand-black">Role</span>
              <select {...register("role", { required: "Please choose a role." })} className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3">
                <option value="owner">Pet owner</option>
                <option value="vet">Veterinarian</option>
              </select>
            </label>
            {mode === "signup" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-brand-black">Full name</span>
                <input
                  {...register("full_name", { required: "Please add your full name." })}
                  className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3"
                  placeholder="Taylor and Mochi"
                />
                {errors.full_name ? <p className="mt-2 text-sm text-red-600">{errors.full_name.message}</p> : null}
              </label>
            ) : null}
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-brand-black">Email</span>
              <input
                {...register("email", {
                  required: "Please add your email.",
                  pattern: { value: /\S+@\S+\.\S+/, message: "Please enter a valid email." }
                })}
                type="email"
                className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3"
                placeholder="name@example.com"
              />
              {errors.email ? <p className="mt-2 text-sm text-red-600">{errors.email.message}</p> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-brand-black">Password</span>
              <input
                {...register("password", {
                  required: "Please add a password.",
                  minLength: { value: 6, message: "Use at least 6 characters." }
                })}
                type="password"
                className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3"
                placeholder="At least 6 characters"
              />
              {errors.password ? <p className="mt-2 text-sm text-red-600">{errors.password.message}</p> : null}
            </label>
            {error ? <div className="rounded-[22px] bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[24px] bg-brand-black px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Working..." : mode === "signup" ? "Continue to pet onboarding" : "Open workspace"}
            </button>
          </form>
        </div>

        <div className="grid gap-6">
          <div className="glass-panel p-8">
            <SectionHeader title="What you can do" caption="Designed around real owner and vet jobs." />
            <div className="grid gap-4 md:grid-cols-2">
              {[
                [<CalendarDays key="a" size={18} />, "Book visits with live slots"],
                [<Bone key="b" size={18} />, "Generate pet diet plans"],
                [<Syringe key="c" size={18} />, "Track vaccines and reminders"],
                [<MessageSquareText key="d" size={18} />, "Chat with your vet team"],
                [<ClipboardList key="e" size={18} />, "Review reports and meds"],
                [<Settings2 key="f" size={18} />, "Manage profile and preferences"]
              ].map(([icon, label]) => (
                <div key={label} className="rounded-[24px] bg-brand-mist p-4 text-sm font-medium text-brand-black">
                  <div className="mb-3 inline-flex rounded-2xl bg-white p-3">{icon}</div>
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div className="glass-panel overflow-hidden p-0">
            <div className="grid gap-0 md:grid-cols-3">
              <div className="bg-brand-orange p-6 text-white">
                <p className="text-sm uppercase tracking-[0.2em] text-white/65">Warm</p>
                <h3 className="mt-3 font-heading text-4xl">Friendly</h3>
              </div>
              <div className="bg-brand-blue p-6 text-brand-black">
                <p className="text-sm uppercase tracking-[0.2em] text-brand-black/50">Clear</p>
                <h3 className="mt-3 font-heading text-4xl">Simple</h3>
              </div>
              <div className="bg-brand-green p-6 text-brand-black">
                <p className="text-sm uppercase tracking-[0.2em] text-brand-black/50">Reliable</p>
                <h3 className="mt-3 font-heading text-4xl">Useful</h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuizPage() {
  const navigate = useNavigate();
  const submitQuiz = useAppStore((state) => state.submitQuiz);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
  const currentValue = watch(currentStep.key);

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
      await submitQuiz(data);
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

            <div className="mt-5 rounded-[24px] bg-brand-orange/10 px-4 py-3 text-sm text-brand-black/70">
              Current answer: {String(currentValue || "Not answered yet")}
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
        <EmptyState title="Your first pet is waiting" copy="Finish onboarding to unlock diet plans, checkup booking, and the rest of the care tools." />
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
            <SectionHeader title="My pets" caption="Switch between profiles without losing the bigger picture." />
            <div className="grid gap-4 lg:grid-cols-2">
              {bootstrap.pets.map((pet) => (
                <PetCard key={pet.id} pet={pet} selected={Number(selectedPet?.id) === Number(pet.id)} onSelect={selectPet} />
              ))}
            </div>
          </div>
          <WeightGraph data={bootstrap.weightSeries} petKey={selectedPet?.name || ""} />
        </div>

        <div className="space-y-6">
          <div className="section-shell">
            <SectionHeader title="Care snapshot" caption="A softer summary for what matters next." />
            <div className="flex items-center gap-4">
              {selectedPet ? <PetAvatar pet={selectedPet} size="lg" /> : null}
              <div>
                <h3 className="font-heading text-4xl text-brand-black">{selectedPet?.name}</h3>
                <p className="text-sm text-brand-black/60">{selectedPet?.breed || "Breed not added"} - {selectedPet?.age_months || "-"} months</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {selectedPet?.activity_level ? <Tag tone="accent">{selectedPet.activity_level}</Tag> : null}
              {selectedPet?.allergies ? <Tag tone="warning">{selectedPet.allergies}</Tag> : <Tag tone="default">No allergy note</Tag>}
              {selectedPet?.food_restrictions ? <Tag tone="info">{selectedPet.food_restrictions}</Tag> : null}
            </div>
            <div className="mt-5 space-y-3 text-sm text-brand-black/72">
              <div className="rounded-[22px] bg-brand-green/18 p-4">Weight tracking is available without any misleading health score.</div>
              <div className="rounded-[22px] bg-brand-yellow/20 p-4">
                {nextAppointment ? `Next visit: ${formatDateTime(nextAppointment.start_time)}` : "No upcoming visit yet. Choose a time slot whenever you're ready."}
              </div>
              <div className="rounded-[22px] bg-brand-blue/16 p-4">Use Diet AI for meal plans and pantry-safe cooking questions tailored to this pet profile.</div>
            </div>
          </div>

          <div className="section-shell">
            <SectionHeader title="Quick actions" />
            <div className="grid gap-3">
              <DashboardTile icon={<CalendarPlus2 size={18} />} title="Appointment booking" copy="Find a slot, add notes, and confirm." to="/owner/appointments" tone="orange" />
              <DashboardTile icon={<Sparkles size={18} />} title="Diet planner" copy="Generate a daily meal chart for your pet." to="/owner/diet-planner" tone="blue" />
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

  return (
    <AppShell title="Pet profile" subtitle="Everything a pet parent should see in one caring, readable profile.">
      <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="section-shell">
          <div className="flex items-center gap-4">
            <PetAvatar pet={selectedPet} size="lg" />
            <div>
              <h2 className="font-heading text-5xl text-brand-black">{selectedPet.name}</h2>
              <p className="text-sm text-brand-black/60">{selectedPet.species} - {selectedPet.breed || "Breed pending"}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Tag tone="accent">{selectedPet.age_months || "-"} months</Tag>
            <Tag tone="info">{selectedPet.weight_kg || "-"} kg</Tag>
            {selectedPet.activity_level ? <Tag tone="success">{selectedPet.activity_level}</Tag> : null}
          </div>
          <div className="mt-6 space-y-3 text-sm text-brand-black/72">
            <div className="rounded-[22px] bg-brand-mist p-4">Allergies: {selectedPet.allergies || "No allergy note yet."}</div>
            <div className="rounded-[22px] bg-brand-mist p-4">Food restrictions: {selectedPet.food_restrictions || "No restriction added yet."}</div>
            <div className="rounded-[22px] bg-brand-mist p-4">Medical history: {selectedPet.health_conditions || "No medical condition added yet."}</div>
            <div className="rounded-[22px] bg-brand-mist p-4">Vaccination history: {selectedPet.vaccination_history || "No vaccination summary added yet."}</div>
          </div>
        </div>

        <div className="space-y-6">
          <WeightGraph data={bootstrap.weightSeries} petKey={selectedPet.name} />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="section-shell">
              <SectionHeader title="Vaccination history" />
              <FriendlyList
                items={petVaccinations.map((item) => `${item.name} - ${item.status} - ${formatDate(item.due_date)}`)}
                emptyCopy="No vaccinations recorded for this pet yet."
              />
            </div>
            <div className="section-shell">
              <SectionHeader title="Medications" />
              <FriendlyList
                items={petMedications.map((item) => `${item.name} - ${item.frequency || "No frequency"} - ${item.dosage || "No dosage"}`)}
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
              <FriendlyList items={petRecords.map((item) => item.title || item.name || "Untitled report")} emptyCopy="No reports uploaded yet." />
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

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  if (!selectedPet) {
    return <Navigate to="/owner/dashboard" replace />;
  }

  const latestReport = bootstrap.reports[0];
  const plan = bootstrap.generatedDietPlan || bootstrap.dietPlans[0];
  const vaccinationItems = bootstrap.vaccinations.filter((item) => Number(item.pet_id) === Number(selectedPet.id));
  const medicationItems = bootstrap.medications.filter((item) => Number(item.pet_id) === Number(selectedPet.id));

  return (
    <AppShell title="Pet health report" subtitle="Readable reports with weight, vaccines, medications, vet notes, allergies, and diet guidance.">
      {!latestReport ? (
        <EmptyState title="No vet report yet" copy="Once a report is saved from the veterinarian side, it will appear here in a cleaner summary format." />
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <PetReportCard report={latestReport} petName={selectedPet.name} />
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

function VaccinationPage() {
  const guard = useRoleGuard("owner");
  const { bootstrap, selectedPet } = useDashboardData();

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  const petVaccinations = selectedPet
    ? bootstrap.vaccinations.filter((item) => Number(item.pet_id) === Number(selectedPet.id))
    : bootstrap.vaccinations;

  return (
    <AppShell title="Vaccination tracker" subtitle="Upcoming shots, history, reminders, and a calmer vaccine dashboard.">
      {!petVaccinations.length ? (
        <EmptyState title="No vaccine records yet" copy="Vaccinations saved in the backend will appear here with due dates and a friendlier timeline." />
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="section-shell">
            <SectionHeader title="Vaccination timeline" caption="See what is done, what is upcoming, and what needs a reminder." />
            <VaccinationTimeline items={petVaccinations} />
          </div>
          <div className="space-y-6">
            <div className="section-shell">
              <SectionHeader title="Upcoming reminders" />
              <FriendlyList
                items={petVaccinations.filter((item) => item.status !== "Given").map((item) => `${item.name} is due around ${formatDate(item.due_date)}`)}
                emptyCopy="Everything currently looks up to date."
              />
            </div>
            <div className="section-shell">
              <SectionHeader title="Helpful nudges" />
              <div className="space-y-3 text-sm text-brand-black/72">
                <div className="rounded-[22px] bg-brand-yellow/20 p-4">Keep vaccine records attached to the right pet profile so reminders stay accurate.</div>
                <div className="rounded-[22px] bg-brand-blue/16 p-4">When booking a vaccine visit, note the vaccine name so your vet can prepare correctly.</div>
                <div className="rounded-[22px] bg-brand-green/18 p-4">You can use notifications as a simple memory aid without exposing backend-style details.</div>
              </div>
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
        <EmptyState title="No medications yet" copy="Medication entries from the backend will show up here with friendlier labels and timing." />
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
    <AppShell title="Diet AI" subtitle="Generate a pet diet chart and ask pantry-safe meal questions in one warm, practical workspace.">
      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-6">
          <form onSubmit={planForm.handleSubmit(onGeneratePlan)} className="section-shell space-y-4">
            <SectionHeader title="Generate a diet plan" caption="Powered by Gemini using age, breed, allergies, weight, and activity context from the selected pet." />
            <div className="rounded-[26px] bg-brand-mist p-4 text-sm text-brand-black/72">
              <p><strong>{selectedPet.name}</strong> - {selectedPet.breed || "Breed pending"} - {selectedPet.weight_kg || "-"} kg</p>
              <p className="mt-1">Allergies: {selectedPet.allergies || "None noted"} - Activity: {selectedPet.activity_level || "Not set"}</p>
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
    if (!selectedVetId && bootstrap.vets[0]) {
      setSelectedVetId(bootstrap.vets[0].id);
    }
  }, [bootstrap.vets, selectedVetId]);

  const appointmentKind = watch("appointment_kind");
  const selectedVet = bootstrap.vets.find((vet) => Number(vet.id) === Number(selectedVetId)) || null;

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

  const onSubmit = async (values) => {
    if (!selectedPet || !selectedVet || !selectedDate || !selectedSlot) {
      setBookingState({ loading: false, error: "Please choose a vet, date, and time slot first.", success: "" });
      return;
    }

    setBookingState({ loading: true, error: "", success: "" });
    try {
      await bookAppointment({
        pet_id: selectedPet.id,
        vet_user_id: selectedVet.id,
        appointment_kind: values.appointment_kind,
        vaccine_name: values.vaccine_name || undefined,
        notes: values.notes,
        start_time: isoForSlot(selectedDate, selectedSlot),
        end_time: plusThirtyMinutes(selectedDate, selectedSlot),
        type: values.appointment_kind === "vaccination" ? "Vaccination" : "General Checkup"
      });
      reset({ appointment_kind: values.appointment_kind, vaccine_name: "", notes: "" });
      setSelectedSlot("");
      setBookingState({ loading: false, error: "", success: "Appointment request sent successfully." });
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

  return (
    <AppShell title="Appointment booking" subtitle="Foodmandu-style slot selection with live availability, clear states, and less friction.">
      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="space-y-6">
          <div className="section-shell">
            <SectionHeader title="Choose your vet" caption="Pick the care partner and see their available hours right away." />
            <div className="space-y-4">
              {bootstrap.vets.map((vet) => (
                <VetCard
                  key={vet.id}
                  vet={vet}
                  selected={Number(selectedVetId) === Number(vet.id)}
                  onSelect={(item) => {
                    setSelectedVetId(item.id);
                    setSelectedDate("");
                    setSelectedSlot("");
                  }}
                />
              ))}
            </div>
          </div>

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
                <input
                  {...register("vaccine_name")}
                  className="w-full rounded-[22px] border border-brand-light bg-white px-4 py-3"
                  placeholder="Rabies"
                />
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
            {bookingState.error ? <div className="rounded-[22px] bg-red-50 px-4 py-3 text-sm text-red-700">{bookingState.error}</div> : null}
            {bookingState.success ? <div className="rounded-[22px] bg-brand-green/22 px-4 py-3 text-sm text-brand-black">{bookingState.success}</div> : null}
            <button
              type="submit"
              disabled={bookingState.loading || !selectedSlot}
              className="w-full rounded-[24px] bg-brand-black px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bookingState.loading ? "Booking..." : selectedSlot ? `Book ${selectedSlot}` : "Choose a time slot first"}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="section-shell">
            <SectionHeader title="Available dates" caption={selectedVet ? `${selectedVet.full_name} - ${selectedVet.start_hour ?? 8}:00 to ${selectedVet.end_hour ?? 17}:00` : "Select a vet first."} />
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
            {!activeDay ? (
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
            <SectionHeader title="Appointment status" caption="See what has been requested, confirmed, or completed." />
            <div className="space-y-3">
              {bootstrap.appointments.filter((item) => Number(item.pet_id) === Number(selectedPet.id)).length ? (
                bootstrap.appointments
                  .filter((item) => Number(item.pet_id) === Number(selectedPet.id))
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
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const guard = useRoleGuard(currentRole || "owner");

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  const activeThread = bootstrap.chatThreads.find((thread) => Number(thread.id) === Number(activeChatId)) || bootstrap.chatThreads[0] || null;

  const onSend = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setError("");
    setSending(true);
    try {
      if (activeThread && Number(activeThread.id) !== Number(activeChatId)) {
        await setActiveChat(activeThread.id);
      }
      await sendMessage(body);
      setBody("");
    } catch (sendError) {
      setError(sendError.message || "Unable to send message right now.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell title="Messages" subtitle="Warm, organized conversations between owners and vets without clutter or admin noise." accent={currentRole === "vet" ? "blue" : "orange"}>
      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="section-shell">
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
                    <span className="text-xs opacity-70">{formatDate(thread.last_at, { month: "short", day: "numeric" })}</span>
                  </div>
                  <p className={`mt-1 text-sm ${Number(thread.id) === Number(activeChatId) ? "text-white/70" : "text-brand-black/60"}`}>{thread.pet_name || "Pet chat"}</p>
                  <p className={`mt-2 line-clamp-2 text-sm ${Number(thread.id) === Number(activeChatId) ? "text-white/70" : "text-brand-black/65"}`}>{thread.last_body || "No messages yet."}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="section-shell">
          <SectionHeader title="Conversation" caption={activeThread ? `About ${activeThread.pet_name || "this pet"}` : "Select a thread to start reading messages."} />
          {!activeThread ? (
            <EmptyState title="Choose a conversation" copy="Pick a thread on the left to open messages and reply." />
          ) : (
            <>
              <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-[24px] bg-brand-mist/70 p-4">
                {bootstrap.messages.length ? bootstrap.messages.map((message) => <ChatBubble key={message.id} message={message} />) : <p className="text-sm text-brand-black/55">No messages in this thread yet.</p>}
              </div>
              <form onSubmit={onSend} className="mt-4 space-y-3">
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={4}
                  className="w-full rounded-[24px] border border-brand-light bg-white px-4 py-3"
                  placeholder="Write a warm, useful reply..."
                />
                {error ? <div className="rounded-[22px] bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-full bg-brand-orange px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Sending..." : "Send message"}
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
    <AppShell title="Settings" subtitle="Account and workspace preferences presented without technical clutter." accent={currentRole === "vet" ? "blue" : "orange"}>
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
          <SectionHeader title="Workspace highlights" />
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
  const [loadingId, setLoadingId] = useState(null);

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  const onUpdate = async (appointmentId, payload) => {
    setLoadingId(appointmentId);
    try {
      await updateAppointment(appointmentId, payload);
    } finally {
      setLoadingId(null);
    }
  };

  const pendingRequests = bootstrap.appointments.filter((item) => item.status === "Pending");

  return (
    <AppShell title="Veterinarian dashboard" subtitle="A cleaner clinical overview for appointments, patients, and owner communication." accent="blue">
      <section className="data-grid">
        <StatCard label="Patients" value={bootstrap.patients.length} helper="Pets connected to your appointment history." tint="blue" />
        <StatCard label="Pending visits" value={pendingRequests.length} helper="Requests that still need action from you." tint="yellow" />
        <StatCard label="Messages" value={bootstrap.chatThreads.length} helper="Conversation threads with owners." tint="green" />
        <StatCard label="Reports" value={bootstrap.reports.length} helper="Existing report summaries tied to appointments." />
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
            <div key={patient.pet_id} className="section-shell">
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
            </div>
          ))}
        </section>
      )}
    </AppShell>
  );
}

function VetReportsPage() {
  const guard = useRoleGuard("vet");
  const bootstrap = useAppStore((state) => state.bootstrap);

  if (guard.denied) {
    return <Navigate to={guard.redirectTo} replace />;
  }

  return (
    <AppShell title="Reports" subtitle="Patient reports displayed in a cleaner, easier-to-review layout." accent="blue">
      {!bootstrap.reports.length ? (
        <EmptyState title="No reports available" copy="Once appointment reports exist in the backend, they will appear here in summary cards." />
      ) : (
        <section className="space-y-6">
          {bootstrap.reports.map((report, index) => (
            <PetReportCard key={`${report.diagnosis}-${index}`} report={report} petName={bootstrap.patients[index]?.pet_name || "Patient"} />
          ))}
        </section>
      )}
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
      { path: "vet/calendar", element: <RouteGate role="vet"><CalendarPage /></RouteGate> },
      { path: "vet/reports", element: <RouteGate role="vet"><VetReportsPage /></RouteGate> },
      { path: "vet/messages", element: <RouteGate role="vet"><MessagesPage /></RouteGate> },
      { path: "vet/notifications", element: <RouteGate role="vet"><NotificationsPage /></RouteGate> },
      { path: "vet/settings", element: <RouteGate role="vet"><SettingsPage /></RouteGate> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
