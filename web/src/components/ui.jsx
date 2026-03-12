import clsx from "clsx";
import { motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  HeartHandshake,
  LayoutDashboard,
  MessageSquareHeart,
  PawPrint,
  Settings,
  Sparkles,
  Stethoscope
} from "lucide-react";
import { Link, Navigate, NavLink } from "react-router-dom";
import { useAppStore } from "../store/appStore";

export function AppShell({ title, subtitle, accent = "orange", children }) {
  const { currentRole, currentUser, logout } = useAppStore();
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

  const accentClass = accent === "blue" ? "from-brand-blue to-brand-green" : "from-brand-orange to-brand-yellow";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(242,140,56,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(111,167,214,0.18),_transparent_30%),linear-gradient(180deg,#fff7ef_0%,#ffffff_72%)] p-4 md:p-6">
      <div className="mx-auto grid max-w-[1520px] gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="glass-panel overflow-hidden">
          <div className={`bg-gradient-to-br ${accentClass} p-6 text-white`}>
            <div className="flex items-center gap-3">
              <div className="rounded-[22px] bg-white/20 p-3">
                <PawPrint size={22} />
              </div>
              <div>
                <Link to="/" className="font-heading text-3xl leading-none">
                  PawCare HQ
                </Link>
                <p className="mt-1 text-sm text-white/80">Gentle care, smarter routines</p>
              </div>
            </div>
            <div className="mt-6 rounded-[28px] bg-white/20 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-white/75">{currentRole === "owner" ? "Pet owner" : "Veterinarian"}</p>
              <h2 className="mt-2 font-heading text-3xl">{currentUser.full_name}</h2>
              <p className="mt-1 text-sm text-white/85">{currentUser.email}</p>
            </div>
          </div>
          <div className="p-4">
            <nav className="space-y-2">
              {navItems.map(([to, label, Icon]) => (
                <NavLink key={to} to={to} className={({ isActive }) => clsx("nav-chip", isActive && "active")}>
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-6 rounded-[26px] bg-brand-mist p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white p-2 text-brand-orange">
                  <HeartHandshake size={18} />
                </div>
                <div>
                  <p className="font-semibold text-brand-black">Made for real care moments</p>
                  <p className="text-sm text-brand-black/65">Clean, friendly workflows for owners and vets.</p>
                </div>
              </div>
            </div>
            <button onClick={logout} className="mt-4 w-full rounded-2xl border border-brand-light bg-white px-4 py-3 text-sm font-semibold text-brand-black transition hover:bg-brand-light/30">
              Log out
            </button>
          </div>
        </aside>

        <main className="space-y-6">
          <header className="glass-panel p-5 md:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="eyebrow">{currentRole === "owner" ? "Pet care workspace" : "Clinical workspace"}</span>
                <h1 className="page-title mt-3">{title}</h1>
                <p className="muted-copy mt-2 max-w-3xl">{subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to={currentRole === "owner" ? "/owner/notifications" : "/vet/notifications"} className="stat-pill bg-brand-yellow/25 text-brand-black">
                  <Bell size={16} />
                  Notifications
                </Link>
                <Link to={currentRole === "owner" ? "/owner/messages" : "/vet/messages"} className="stat-pill bg-brand-blue/15 text-brand-black">
                  <MessageSquareHeart size={16} />
                  Messages
                </Link>
              </div>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

export function StatCard({ label, value, helper, tint = "orange" }) {
  const tints = {
    orange: "from-brand-orange/18 to-white",
    blue: "from-brand-blue/18 to-white",
    green: "from-brand-green/20 to-white",
    yellow: "from-brand-yellow/26 to-white"
  };
  return (
    <motion.div whileHover={{ y: -4 }} className={`section-shell bg-gradient-to-br ${tints[tint]}`}>
      <p className="text-sm font-semibold text-brand-black/55">{label}</p>
      <p className="mt-3 font-heading text-4xl text-brand-black">{value}</p>
      <p className="mt-2 text-sm text-brand-black/60">{helper}</p>
    </motion.div>
  );
}

export function SectionHeader({ title, caption, action }) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="font-heading text-3xl text-brand-black">{title}</h2>
        {caption ? <p className="muted-copy mt-1">{caption}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Tag({ children, tone = "default" }) {
  const tones = {
    default: "bg-brand-light/50 text-brand-black/75",
    success: "bg-brand-green/30 text-brand-black",
    info: "bg-brand-blue/20 text-brand-black",
    warning: "bg-brand-yellow/30 text-brand-black",
    accent: "bg-brand-orange/22 text-brand-black"
  };
  return <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function EmptyState({ title, copy }) {
  return (
    <div className="section-shell py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-orange/15 text-brand-orange">
        <PawPrint />
      </div>
      <h3 className="mt-4 font-heading text-3xl text-brand-black">{title}</h3>
      <p className="muted-copy mt-2">{copy}</p>
    </div>
  );
}
