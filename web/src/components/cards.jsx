import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Clock3, FileText, PawPrint, Pill, ShieldPlus, Syringe } from "lucide-react";
import { Tag } from "./ui";

export function PetAvatar({ pet, size = "md" }) {
  const sizes = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-24 w-24"
  };
  return <img src={pet.photo_url} alt={pet.name} className={`${sizes[size]} rounded-[26px] object-cover`} />;
}

export function PetCard({ pet, onSelect, selected = false }) {
  return (
    <button
      onClick={() => onSelect?.(pet.id)}
      className={`w-full rounded-[34px] border p-6 text-left transition hover:-translate-y-1 ${selected ? "border-brand-orange bg-[linear-gradient(135deg,rgba(242,140,56,0.16),rgba(255,255,255,0.95))] shadow-card" : "border-brand-light/70 bg-white hover:border-brand-blue/45 hover:shadow-card"}`}
    >
      <div className="flex items-start gap-4">
        <div className="rounded-[28px] bg-brand-yellow/18 p-1">
          <PetAvatar pet={pet} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-3xl leading-none text-brand-black">{pet.name}</h3>
            <Tag tone="info">{pet.species}</Tag>
          </div>
          <p className="mt-2 text-sm leading-6 text-brand-black/60">{pet.breed || "Breed not added"} - {pet.age_months || "-"} months - {pet.weight_kg || "-"} kg</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {pet.allergies ? <Tag tone="warning">{pet.allergies}</Tag> : <Tag tone="default">No allergy note</Tag>}
            {pet.food_restrictions ? <Tag tone="info">{pet.food_restrictions}</Tag> : null}
          </div>
        </div>
      </div>
    </button>
  );
}

export function VetCard({ vet, selected = false, onSelect }) {
  const availableDays = String(vet.available_days || "Mon,Tue,Fri")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <button
      onClick={() => onSelect?.(vet)}
      className={`w-full rounded-[34px] border p-6 text-left transition hover:-translate-y-1 ${selected ? "border-brand-blue bg-[linear-gradient(135deg,rgba(111,167,214,0.16),rgba(255,255,255,0.95))] shadow-card" : "border-brand-light/70 bg-white hover:border-brand-blue/40 hover:shadow-card"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-brand-black/45">Veterinarian</p>
          <h3 className="mt-2 font-heading text-4xl leading-none">{vet.full_name}</h3>
          <p className="mt-2 text-sm leading-6 text-brand-black/65">{vet.clinic_name || "Clinic details not added"}</p>
        </div>
        <Tag tone={vet.is_online ? "success" : "default"}>{vet.is_online ? "Available" : "Offline"}</Tag>
      </div>
      <p className="mt-4 text-sm leading-6 text-brand-black/70">{vet.bio || "Friendly care with no bio added yet."}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {availableDays.map((day) => (
          <Tag key={day} tone="info">{day}</Tag>
        ))}
        <Tag tone="accent">{vet.start_hour ?? 8}:00 - {vet.end_hour ?? 18}:00</Tag>
      </div>
    </button>
  );
}

export function AppointmentSlot({ slot, disabled = false, active = false, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onClick?.(slot)}
      className={`rounded-[22px] border px-4 py-3 text-sm font-extrabold transition ${
        disabled
          ? "cursor-not-allowed border-brand-light/60 bg-brand-light/20 text-brand-black/35"
          : active
            ? "border-brand-black bg-brand-black text-white shadow-card"
            : "border-brand-light bg-white text-brand-black hover:-translate-y-0.5 hover:border-brand-orange hover:shadow-sm"
      }`}
    >
      {slot}
    </button>
  );
}

export function VaccinationTimeline({ items }) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="rounded-[28px] border border-brand-light/70 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-yellow/25">
              <Syringe size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold text-brand-black">{item.name}</h4>
                <Tag tone={item.status === "Given" ? "success" : "warning"}>{item.status}</Tag>
              </div>
              <p className="mt-1 text-sm text-brand-black/60">Due: {item.due_date || "Not set"}</p>
              <p className="mt-2 text-sm text-brand-black/72">{item.notes || "No notes added."}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatBubble({ message }) {
  const mine = message.sender_role === "owner" || message.sender === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] rounded-[28px] px-5 py-4 text-sm leading-7 ${mine ? "bg-brand-black text-white shadow-card" : "bg-white text-brand-black shadow-sm"}`}>
        {message.body || message.text ? <p>{message.body || message.text}</p> : null}
        {message.attachment_url && message.attachment_type === "image" ? (
          <a href={message.attachment_url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-[22px]">
            <img src={message.attachment_url} alt={message.attachment_name || "Attachment"} className="max-h-72 w-full rounded-[22px] object-cover" />
          </a>
        ) : null}
        {message.attachment_url && message.attachment_type === "file" ? (
          <a
            href={message.attachment_url}
            target="_blank"
            rel="noreferrer"
            className={`mt-3 inline-flex rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] ${mine ? "bg-white/10 text-white" : "bg-brand-mist text-brand-black"}`}
          >
            {message.attachment_name || "Open attachment"}
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function PetReportCard({ report, petName }) {
  const blocks = [
    ["Diagnosis", report.diagnosis, <ShieldPlus key="d" size={16} />],
    ["Medications", report.medications_and_doses, <Pill key="m" size={16} />],
    ["Diet plan", report.diet_recommendation, <Clock3 key="t" size={16} />],
    ["General notes", report.general_recommendation, <FileText key="f" size={16} />]
  ];
  return (
    <div className="section-shell paper-panel">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-brand-blue/15 p-3 text-brand-blue">
          <FileText size={18} />
        </div>
        <div>
          <h3 className="font-heading text-4xl leading-none text-brand-black">{petName} report</h3>
          <p className="text-sm text-brand-black/60">A readable summary of the latest clinical notes.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {blocks.map(([title, copy, icon]) => (
          <div key={title} className="rounded-[28px] bg-brand-mist p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-black/75">
              {icon}
              {title}
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-brand-black/74">{copy || "No details available yet."}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgressPawIndicator({ total, current }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm text-white/80">
        <span>Step {current} of {total}</span>
        <span>{Math.round((current / total) * 100)}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-orange to-brand-yellow transition-all" style={{ width: `${(current / total) * 100}%` }} />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: total }).map((_, index) => (
          <div key={index} className={`flex h-10 w-10 items-center justify-center rounded-full ${index < current ? "bg-white text-brand-orange" : "bg-white/15 text-white/45"}`}>
            <PawPrint size={16} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeightGraph({ data, petKey }) {
  return (
    <div className="section-shell paper-panel">
      <div className="mb-4">
        <h3 className="font-heading text-4xl leading-none text-brand-black">Weight tracker</h3>
        <p className="text-sm text-brand-black/60">Simple, readable weight changes over time.</p>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="4 4" stroke="#D9D3D3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey={petKey} stroke="#F28C38" strokeWidth={3} dot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function NutritionChart({ items }) {
  const palette = ["#F28C38", "#6FA7D6", "#A7C66B", "#EACB5A"];
  return (
    <div className="section-shell paper-panel">
      <div className="mb-4">
        <h3 className="font-heading text-4xl leading-none text-brand-black">Nutrition mix</h3>
        <p className="text-sm text-brand-black/60">A simple visual guide for the AI-generated plan.</p>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} dataKey="value" nameKey="label" innerRadius={52} outerRadius={86}>
              {items.map((entry, index) => (
                <Cell key={entry.label} fill={palette[index % palette.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
