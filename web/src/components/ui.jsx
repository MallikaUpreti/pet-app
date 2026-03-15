import clsx from "clsx";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  MessageSquareHeart,
  PawPrint,
  Settings,
  Sparkles,
  Stethoscope
} from "lucide-react";
import { Link, Navigate, NavLink } from "react-router-dom";
import { useAppStore } from "../store/appStore";

export function AppShell({ title, subtitle, accent = "orange", children }) {
  const { currentRole, currentUser, logout, bootstrap, selectedPetId, selectPet } = useAppStore();
  if (!currentUser) {
    return <Navigate to="/auth/login" replace />;
  }

  const navItems =
    currentRole === "owner"
      ? [
          ["/owner/dashboard", "Home", LayoutDashboard],
          ["/owner/pets", "My Pets", PawPrint],
          ["/owner/guide", "Guide", ClipboardCheck],
          ["/owner/appointments", "Appointments", CalendarDays],
          ["/owner/diet-planner", "Diet AI", Sparkles],
          ["/owner/messages", "Messages", MessageSquareHeart],
          ["/owner/settings", "Settings", Settings]
        ]
      : [
          ["/vet/dashboard", "Overview", LayoutDashboard],
          ["/vet/patients", "Patients", PawPrint],
          ["/vet/calendar", "Availability", CalendarDays],
          ["/vet/reports", "Reports", Stethoscope],
          ["/vet/messages", "Messages", MessageSquareHeart],
          ["/vet/settings", "Settings", Settings]
        ];

  const quickLinkClass =
    currentRole === "owner"
      ? "bg-brand-orange text-white"
      : "bg-brand-blue text-brand-black";
  return (
    <div className="site-stage min-h-screen px-4 py-5 md:px-6">
      <div className="mx-auto max-w-[1380px] space-y-6">
        <header className="site-nav-shell">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="rounded-[20px] bg-brand-orange p-2 text-white shadow-soft">
                <PawPrint size={18} />
              </div>
              <p className="font-heading text-2xl text-brand-black">
                {currentRole === "owner" ? `${currentUser.full_name.split(" ")[0] || "Your"}'s CareSpace` : "Veterinary CareSpace"}
              </p>
            </Link>

            <nav className="hidden flex-1 items-center justify-center gap-2 xl:flex">
              {currentRole === "owner" ? (
                <>
                  <NavLink to="/owner/dashboard" className={({ isActive }) => clsx("nav-chip website-chip !px-3 !py-2", isActive && "active")} title="Dashboard">
                    <LayoutDashboard size={16} />
                  </NavLink>
                  <NavLink to="/owner/appointments" className={({ isActive }) => clsx("nav-chip website-chip !px-3 !py-2", isActive && "active")} title="Appointments">
                    <CalendarDays size={16} />
                  </NavLink>
                  <NavLink to="/owner/guide" className={({ isActive }) => clsx("nav-chip website-chip !px-3 !py-2", isActive && "active")} title="Guide">
                    <ClipboardCheck size={16} />
                  </NavLink>
                  <NavLink to="/owner/pets" className={({ isActive }) => clsx("nav-chip website-chip !px-3 !py-2", isActive && "active")} title="My pets">
                    <PawPrint size={16} />
                  </NavLink>
                  <NavLink to="/owner/messages" className={({ isActive }) => clsx("nav-chip website-chip !px-3 !py-2", isActive && "active")} title="Messages">
                    <MessageSquareHeart size={16} />
                  </NavLink>
                  <NavLink to="/owner/diet-planner" className={({ isActive }) => clsx("nav-chip website-chip !px-3 !py-2", isActive && "active")} title="Diet AI">
                    <Sparkles size={16} />
                  </NavLink>
                </>
              ) : (
                navItems.map(([to, label, Icon]) => (
                  <NavLink key={to} to={to} className={({ isActive }) => clsx("nav-chip website-chip !px-3 !py-2", isActive && "active")} title={label}>
                    <Icon size={16} />
                  </NavLink>
                ))
              )}
            </nav>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {currentRole === "owner" && bootstrap.pets.length ? (
                <label className="website-pill gap-2 pr-3">
                  <PawPrint size={16} />
                  <select
                    value={selectedPetId || bootstrap.pets[0]?.id || ""}
                    onChange={(event) => selectPet(Number(event.target.value))}
                    className="min-w-[120px] appearance-none border-0 bg-transparent p-0 pr-2 text-sm font-medium focus:shadow-none"
                  >
                    {bootstrap.pets.map((pet) => (
                      <option key={pet.id} value={pet.id}>{pet.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <Link to={currentRole === "owner" ? "/owner/settings" : "/vet/settings"} className="website-pill" title="Settings">
                <Settings size={16} />
              </Link>
              <button onClick={logout} className="website-pill bg-brand-black text-white" title="Log out">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main className="space-y-6">{children}</main>
      </div>
    </div>
  );
}

export function StatCard({ label, value, helper, tint = "orange" }) {
  const tints = {
    orange: "from-brand-orange/18 via-white to-brand-yellow/12",
    blue: "from-brand-blue/18 via-white to-brand-green/12",
    green: "from-brand-green/20 via-white to-brand-yellow/12",
    yellow: "from-brand-yellow/26 via-white to-brand-orange/12"
  };
  return (
    <motion.div whileHover={{ y: -6, rotate: -0.5 }} className={`section-shell paper-panel bg-gradient-to-br ${tints[tint]}`}>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-brand-black/45">{label}</p>
      <p className="mt-3 font-heading text-5xl leading-none text-brand-black">{value}</p>
      <p className="mt-3 text-sm leading-6 text-brand-black/60">{helper}</p>
    </motion.div>
  );
}

export function SectionHeader({ title, caption, action }) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="font-heading text-4xl leading-none text-brand-black">{title}</h2>
        {caption ? <p className="muted-copy mt-1">{caption}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Tag({ children, tone = "default" }) {
  const tones = {
    default: "bg-brand-light/45 text-brand-black/75",
    success: "bg-brand-green/35 text-brand-black",
    info: "bg-brand-blue/20 text-brand-black",
    warning: "bg-brand-yellow/35 text-brand-black",
    accent: "bg-brand-orange/24 text-brand-black"
  };
  return <span className={clsx("rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em]", tones[tone])}>{children}</span>;
}

export function EmptyState({ title, copy }) {
  return (
    <div className="section-shell paper-panel py-14 text-center">
      <div className="floating-paw mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-orange/15 text-brand-orange">
        <PawPrint />
      </div>
      <h3 className="mt-4 font-heading text-4xl leading-none text-brand-black">{title}</h3>
      <p className="muted-copy mt-2">{copy}</p>
    </div>
  );
}

export function ToastViewport() {
  const toasts = useAppStore((state) => state.toasts);
  const dismissToast = useAppStore((state) => state.dismissToast);
  const tones = {
    success: "border-brand-green/40 bg-brand-green/18",
    warning: "border-brand-yellow/40 bg-brand-yellow/18",
    error: "border-red-200 bg-red-50",
    info: "border-brand-blue/40 bg-brand-blue/16"
  };

  if (!toasts.length) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-brand-black/22 px-4 backdrop-blur-[2px]">
      <div className="flex w-full max-w-md flex-col gap-3">
        {toasts.map((toast) => (
          <div key={toast.id} className={clsx("rounded-[26px] border bg-white px-5 py-4 shadow-[0_20px_60px_rgba(15,15,15,0.18)]", tones[toast.tone] || tones.info)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-brand-black">{toast.title}</p>
                {toast.message ? <p className="mt-2 text-sm leading-6 text-brand-black/72">{toast.message}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-full border border-brand-black/10 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-brand-black/60"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
