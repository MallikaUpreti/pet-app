import clsx from "clsx";
import { motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  Plus,
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
          <div className="site-nav-row">
            <Link to="/" className="flex items-center gap-3">
              <div className="rounded-[22px] bg-brand-orange p-3 text-white shadow-soft">
                <PawPrint size={20} />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-brand-black/40">
                  {currentRole === "owner" ? "Pet owner space" : "Veterinary space"}
                </p>
                <p className="font-heading text-3xl leading-none text-brand-black">PawCare</p>
              </div>
            </Link>

            <nav className="hidden flex-1 items-center justify-center gap-2 xl:flex">
              {navItems.map(([to, label, Icon]) => (
                <NavLink key={to} to={to} className={({ isActive }) => clsx("nav-chip website-chip", isActive && "active")}>
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="website-user">
                <span className="website-user-label">Signed in as</span>
                <span className="website-user-name">{currentUser.full_name}</span>
              </div>
              <Link to={currentRole === "owner" ? "/owner/notifications" : "/vet/notifications"} className="website-pill">
                <Bell size={16} />
                Alerts
              </Link>
              {currentRole === "owner" && bootstrap.pets.length ? (
                <label className="website-pill gap-3 pr-3">
                  <PawPrint size={16} />
                  <select
                    value={selectedPetId || bootstrap.pets[0]?.id || ""}
                    onChange={(event) => selectPet(Number(event.target.value))}
                    className="min-w-[128px] border-0 bg-transparent p-0 text-base font-medium focus:shadow-none"
                  >
                    {bootstrap.pets.map((pet) => (
                      <option key={pet.id} value={pet.id}>{pet.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </label>
              ) : null}
              {currentRole === "owner" ? (
                <Link to="/quiz" className={clsx("website-pill", quickLinkClass)}>
                  <Plus size={16} />
                  Add Pet
                </Link>
              ) : null}
              <button onClick={logout} className="website-pill bg-brand-black text-white">
                <LogOut size={16} />
                Log out
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
