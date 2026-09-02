"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";

type View = "agenda" | "clientes" | "servicios" | "equipo";
type Service = { id: number; name: string; category: string; duration_minutes: number; price: number };
type Appointment = { id: number; date: string; time: string; client: string; service: string; stylist: string; duration: number; status: string; serviceId: number };
const team = ["Sofía", "Valentina", "Daniela"];
const formatMoney = (price: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(price);

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("agenda");
  const [date, setDate] = useState("2026-09-02");
  const [filter, setFilter] = useState("Todas");
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) { setReady(true); return; }
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadData() {
    const supabase = getSupabaseClient();
    if (!supabase || !user) return;
    const [serviceResult, appointmentResult] = await Promise.all([
      supabase.from("services").select("id,name,category,duration_minutes,price").eq("active", true).order("name"),
      supabase.from("appointments").select("id,client_name,service_id,professional_name,starts_at,duration_minutes,status").order("starts_at")
    ]);
    if (serviceResult.error || appointmentResult.error) { setNotice("No se pudo cargar la agenda. Revisa la migración de Supabase."); return; }
    const loadedServices = serviceResult.data ?? [];
    const servicesById = new Map(loadedServices.map((service) => [service.id, service]));
    setServices(loadedServices);
    setAppointments((appointmentResult.data ?? []).map((item: any) => {
      const startsAt = new Date(item.starts_at);
      return { id: item.id, date: startsAt.toLocaleDateString("en-CA", { timeZone: "America/Santiago" }), time: startsAt.toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }), client: item.client_name, service: servicesById.get(item.service_id)?.name ?? "Servicio", stylist: item.professional_name ?? "Equipo Divas", duration: item.duration_minutes, status: item.status, serviceId: item.service_id };
    }));
  }

  useEffect(() => { void loadData(); }, [user?.id]);
  const items = useMemo(() => appointments.filter(item => item.date === date && (filter === "Todas" || item.stylist === filter)), [appointments, date, filter]);
  const clients = useMemo(() => Array.from(new Set(appointments.map(item => item.client))).map(name => ({ name, visits: appointments.filter(item => item.client === name).length })), [appointments]);
  const moveDate = (days: number) => { const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + days); setDate(next.toISOString().slice(0, 10)); };

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const service = services.find(item => item.id === Number(form.get("service"))); const supabase = getSupabaseClient();
    if (!supabase || !service) return;
    const startsAt = `${form.get("date")}T${form.get("time")}:00-03:00`;
    const professional = String(form.get("professional"));
    const { data: existing, error: availabilityError } = await supabase.from("appointments").select("starts_at,duration_minutes,status").eq("professional_name", professional).gte("starts_at", `${form.get("date")}T00:00:00-03:00`).lte("starts_at", `${form.get("date")}T23:59:59-03:00`).neq("status", "cancelled");
    const requested = String(form.get("time")).split(":").map(Number).reduce((total, value, index) => total + value * (index === 0 ? 60 : 1), 0);
    const conflict = (existing ?? []).some((item) => { const time = new Date(item.starts_at).toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number); const start = time[0] * 60 + time[1]; return requested < start + item.duration_minutes && requested + service.duration_minutes > start; });
    if (availabilityError || conflict) { setFormError(conflict ? "Ese horario ya está ocupado para esta profesional. Elige otra hora o profesional." : "No se pudo comprobar la disponibilidad."); return; }
    const { error } = await supabase.from("appointments").insert({ client_name: form.get("client"), service_id: service.id, professional_name: professional, starts_at: startsAt, duration_minutes: service.duration_minutes, status: "pending" });
    if (error) { setFormError("No se pudo guardar la cita. Inténtalo nuevamente."); return; }
    setFormError(""); setOpen(false); setDate(String(form.get("date"))); setNotice("Cita guardada correctamente."); void loadData();
  }
  async function removeAppointment(id: number) { const supabase = getSupabaseClient(); if (!supabase) return; const { error } = await supabase.from("appointments").delete().eq("id", id); if (error) { setNotice("No se pudo eliminar la cita."); return; } setNotice("Cita eliminada."); void loadData(); }
  async function editClient(id: number, client: string) { const name = window.prompt("Nombre de la clienta", client); if (!name?.trim()) return; const supabase = getSupabaseClient(); if (!supabase) return; const { error } = await supabase.from("appointments").update({ client_name: name.trim() }).eq("id", id); setNotice(error ? "No se pudo editar la cita." : "Cita actualizada."); if (!error) void loadData(); }
  async function updateStatus(id: number, status: string) { const supabase = getSupabaseClient(); if (!supabase) return; const { error } = await supabase.from("appointments").update({ status }).eq("id", id); setNotice(error ? "No se pudo actualizar el estado." : "Estado de la cita actualizado."); if (!error) void loadData(); }

  if (!ready) return <main className="auth-page"><p>Cargando Divas Beauty Spa…</p></main>;
  if (!user) return <Auth />;
  const nav: { id: View; icon: string; label: string }[] = [{ id: "agenda", icon: "▦", label: "Agenda" }, { id: "clientes", icon: "♧", label: "Clientes" }, { id: "servicios", icon: "✧", label: "Servicios" }, { id: "equipo", icon: "♙", label: "Equipo" }];
  return <main><aside className="sidebar"><div className="brand"><span>✦</span><div>DIVAS<small>BEAUTY SPA</small></div></div><nav>{nav.map(item => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>{item.icon}<span>{item.label}</span></button>)}</nav><div className="profile"><div className="avatar">{user.email?.[0].toUpperCase()}</div><div><strong>{user.email}</strong><button className="sign-out" onClick={() => getSupabaseClient()?.auth.signOut()}>Cerrar sesión</button></div></div></aside><section className="content">{view === "agenda" ? <><header><div><p className="eyebrow">SANTIAGO, CHILE</p><h1>Agenda de Divas <span>✦</span></h1><p className="subtle">Agenda sincronizada en tiempo real.</p></div><div className="header-actions"><button className="primary" onClick={() => { setFormError(""); setOpen(true); }}>＋ Nueva cita</button></div></header><section className="summary"><div><span className="summary-icon pink">◷</span><p>Citas del día<strong>{appointments.filter(item => item.date === date).length}</strong></p></div><div><span className="summary-icon purple">♙</span><p>Servicios activos<strong>{services.length}</strong></p></div><div><span className="summary-icon peach">$</span><p>Estado<strong>En línea</strong></p></div></section><section className="agenda-card"><div className="agenda-top"><div><div className="date-controls"><button onClick={() => moveDate(-1)}>‹</button><h2>{new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`))}</h2><button onClick={() => moveDate(1)}>›</button></div><p>{items.length} citas programadas</p></div><div className="filters"><button className={filter === "Todas" ? "selected" : ""} onClick={() => setFilter("Todas")}>Todas</button>{team.map(name => <button key={name} className={filter === name ? "selected" : ""} onClick={() => setFilter(name)}>{name}</button>)}</div></div>{notice && <div className="notice">✓ {notice}<button onClick={() => setNotice("")}>×</button></div>}<div className="appointments">{items.map(item => <article className="appointment" key={item.id}><time>{item.time}</time><div className="line"/><div className="details"><strong>{item.client}</strong><span>{item.service} · {item.duration} min</span></div><span className="stylist">{item.stylist}</span><select className="status-select" value={item.status} onChange={event => updateStatus(item.id, event.target.value)}><option value="pending">Pendiente</option><option value="confirmed">Confirmada</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option><option value="no_show">No asistió</option></select><button className="edit" onClick={() => editClient(item.id, item.client)}>Editar</button><button className="delete" onClick={() => removeAppointment(item.id)}>x</button></article>)}{!items.length && <p className="empty">No hay citas para este día.</p>}</div></section></> : <Directory view={view} services={services} clients={clients} />}</section>{open && <AppointmentForm date={date} services={services} error={formError} onClose={() => setOpen(false)} onSubmit={createAppointment}/>}</main>;
}

function Auth() { const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [message, setMessage] = useState(""); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const supabase = getSupabaseClient(); if (!supabase) { setMessage("Faltan las variables de Supabase en Vercel."); return; } const { error } = await supabase.auth.signInWithPassword({ email, password }); setMessage(error ? "Datos incorrectos. Si aún no tienes acceso, crea tu cuenta." : "Sesión iniciada."); } async function signUp() { const supabase = getSupabaseClient(); if (!supabase) return; const { error } = await supabase.auth.signUp({ email, password }); setMessage(error ? error.message : "Revisa tu correo y confirma la cuenta para ingresar."); } return <main className="auth-page"><form className="auth-card" onSubmit={submit}><div className="brand"><span>✦</span><div>DIVAS<small>BEAUTY SPA</small></div></div><h1>Agenda del salón</h1><p>Ingresa con tu cuenta para ver las citas.</p><label>Correo<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Contraseña<input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></label>{message && <p className="auth-message">{message}</p>}<button className="primary full">Iniciar sesión</button><button className="text-button" type="button" onClick={signUp}>Crear primera cuenta</button></form></main>; }

function Directory({ view, services, clients }: { view: View; services: Service[]; clients: { name: string; visits: number }[] }) { const title = view[0].toUpperCase() + view.slice(1); return <><header><div><p className="eyebrow">DIVAS BEAUTY SPA</p><h1>{title} <span>✦</span></h1><p className="subtle">{view === "clientes" ? "Historial de las clientas con citas agendadas." : view === "servicios" ? "Catálogo activo de servicios." : "Profesionales y horarios de referencia."}</p></div></header><section className="directory-card">{view === "clientes" && <div className="directory-list">{clients.map(client => <article className="directory-row" key={client.name}><div className="initials">{client.name.split(" ").map(word => word[0]).join("")}</div><div><strong>{client.name}</strong><span>Registrada en la agenda</span></div><b>{client.visits} visita{client.visits > 1 ? "s" : ""}</b></article>)}{!clients.length && <p className="empty">Aún no hay clientas registradas.</p>}</div>}{view === "servicios" && <div className="service-grid">{services.map(service => <article className="service-card" key={service.id}><span>{service.category}</span><h3>{service.name}</h3><p>{service.duration_minutes} min</p><strong>{formatMoney(service.price)}</strong></article>)}</div>}{view === "equipo" && <div className="team-grid">{team.map((name, index) => <article className="team-card" key={name}><div className="team-avatar">{name[0]}</div><h3>{name}</h3><p>{["Manicure y pedicure", "Manicure y pestañas", "Depilación y pestañas"][index]}</p><span>{["09:00 – 18:00", "10:00 – 19:00", "09:30 – 18:30"][index]}</span></article>)}</div>}</section></>; }
function AppointmentForm({ date, services, error, onClose, onSubmit }: { date: string; services: Service[]; error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [selectedDate, setSelectedDate] = useState(date), [serviceId, setServiceId] = useState(""), [professional, setProfessional] = useState(""), [slots, setSlots] = useState<string[]>([]), [loading, setLoading] = useState(false);
  useEffect(() => { if (!serviceId || !professional) { setSlots([]); return; } setLoading(true); fetch(`/api/public-booking?date=${selectedDate}&serviceId=${serviceId}&professional=${encodeURIComponent(professional)}`).then(response => response.json()).then(data => setSlots(data.slots ?? [])).finally(() => setLoading(false)); }, [selectedDate, serviceId, professional]);
  return <div className="modal-backdrop"><form className="modal" onSubmit={onSubmit}><div className="modal-title"><div><p className="eyebrow">DIVAS BEAUTY SPA · AGENDA</p><h2>Nueva cita</h2></div><button type="button" onClick={onClose}>×</button></div><label>Cliente<input required name="client" placeholder="Nombre de la clienta"/></label><label>Servicio<select required name="service" value={serviceId} onChange={event => setServiceId(event.target.value)}><option disabled value="">Selecciona un servicio</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><div className="form-row"><label>Fecha<input required name="date" type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)}/></label><label>Profesional<select required name="professional" value={professional} onChange={event => setProfessional(event.target.value)}><option disabled value="">Selecciona</option>{team.map(name => <option key={name}>{name}</option>)}</select></label></div><label>Hora disponible<select required name="time" disabled={!slots.length} defaultValue=""><option value="">{loading ? "Buscando horarios…" : "Selecciona una hora"}</option>{slots.map(slot => <option key={slot}>{slot}</option>)}</select></label>{error && <p className="form-error">{error}</p>}<button className="primary full">Guardar cita</button></form></div>;
}
