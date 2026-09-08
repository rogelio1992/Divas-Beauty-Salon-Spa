"use client";
import SalonLogo from "../components/salon-logo";

import {FormEvent, useEffect, useMemo, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import SalonContent from "../components/salon-content";
import type {User} from "@supabase/supabase-js";
import {getSupabaseClient} from "../../lib/supabase";
import {BOOKING_CONFLICT_MESSAGE, isBookingConflict} from "../../lib/booking-errors";
import Directory, {Client, Profile} from "../components/directory";
import {santiagoDayEnd, santiagoDayStart, santiagoInstant} from "../../lib/santiago-time";

type View = "agenda" | "clientes" | "servicios" | "equipo" | "contenido";
type AgendaMode = "day" | "week";
export type Service = { id: number; name: string; category: string; duration_minutes: number; price: number; active: boolean };
export type Professional = { id: number; name: string; specialty: string; work_days: number[]; work_start_time: string; work_end_time: string; active: boolean };
export type Appointment = {
    id: number;
    clientId: number;
    price: number | null;
    date: string;
    time: string;
    client: string;
    service: string;
    stylist: string;
    duration: number;
    status: string;
    serviceId: number;
    phone: string | null
};
const formatMoney = (price: number) => new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
}).format(price);
const addDays = (value: string, days: number) => {
    const next = new Date(`${value}T12:00:00`);
    next.setDate(next.getDate() + days);
    return next.toISOString().slice(0, 10);
};
const weekFor = (value: string) => {
    const current = new Date(`${value}T12:00:00`);
    const mondayOffset = (current.getDay() + 6) % 7;
    return Array.from({length: 7}, (_, index) => addDays(value, index - mondayOffset));
};
const santiagoToday = () => {
    const parts = new Intl.DateTimeFormat("en-CA", {timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(new Date());
    const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
};

export default function Home() {
    const router = useRouter();
    const currentUserId = useRef<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [accessLoading, setAccessLoading] = useState(true);
    const [clients, setClients] = useState<Client[]>([]);
    const [ready, setReady] = useState(false);
    const [view, setView] = useState<View>("agenda");
    const [agendaMode, setAgendaMode] = useState<AgendaMode>("day");
    const [date, setDate] = useState(santiagoToday);
    const [filter, setFilter] = useState("Todas");
    const [services, setServices] = useState<Service[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [notice, setNotice] = useState("");
    const [formError, setFormError] = useState("");
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Appointment | null>(null);
    const [details, setDetails] = useState<Appointment | null>(null);
    const [remindersOpen, setRemindersOpen] = useState(false);

    useEffect(() => {
        const supabase = getSupabaseClient();
        if (!supabase) {
            setReady(true);
            return;
        }
        supabase.auth.getUser().then(({data}) => {
            currentUserId.current = data.user?.id ?? null;
            setUser(data.user);
            setReady(true);
        });
        const {data: listener} = supabase.auth.onAuthStateChange((_event, session) => {
            currentUserId.current = session?.user.id ?? null;
            setUser(previous => {
                if (previous?.id !== session?.user.id) {
                    setProfile(null); setAppointments([]); setClients([]); setServices([]); setProfessionals([]);
                    setOpen(false); setEditing(null); setDetails(null); setRemindersOpen(false); setView("agenda"); setAccessLoading(true);
                }
                return session?.user ?? null;
            });
        });
        return () => listener.subscription.unsubscribe();
    }, []);

    useEffect(() => { if (ready && !user) router.replace("/admin/login"); }, [ready, user, router]);

    async function loadData() {
        const supabase = getSupabaseClient();
        if (!supabase || !user) return;
        const {data: member, error: profileError} = await supabase.from("profiles").select("id,full_name,email,role,active,professional_id").eq("id", user.id).maybeSingle();
        if (currentUserId.current !== user.id) return;
        setProfile(member);
        setAccessLoading(false);
        if (profileError || !member?.active) {
            setAppointments([]); setClients([]); setProfessionals([]); setServices([]);
            setNotice(profileError ? "No se pudo comprobar tu acceso. Intenta nuevamente." : "Tu cuenta está pendiente de autorización. Contacta a la administradora.");
            return;
        }
        const [serviceResult, appointmentResult, professionalResult, clientResult] = await Promise.all([
            supabase.from("services").select("id,name,category,duration_minutes,price,active").order("name"),
            supabase.from("appointments").select("id,client_id,client_name,client_phone,service_id,service_name,service_price,professional_id,professional_name,starts_at,duration_minutes,status").order("starts_at"),
            supabase.from("professionals").select("id,name,specialty,work_days,work_start_time,work_end_time,active").order("name"),
            supabase.from("clients").select("id,full_name,phone,email,notes").order("full_name")
        ]);
        if (currentUserId.current !== user.id) return;
        if (serviceResult.error || appointmentResult.error || professionalResult.error || clientResult.error) {
            setNotice("No se pudo cargar la agenda. Revisa la migración de Supabase.");
            return;
        }
        const loadedServices = serviceResult.data ?? [];
        const servicesById = new Map(loadedServices.map((service) => [service.id, service]));
        setClients(clientResult.data ?? []);
        setServices(loadedServices);
        setProfessionals(professionalResult.data ?? []);
        setAppointments((appointmentResult.data ?? []).map((item: any) => {
            const startsAt = new Date(item.starts_at);
            return {
                id: item.id,
                clientId: item.client_id,
                price: item.service_price,
                date: startsAt.toLocaleDateString("en-CA", {timeZone: "America/Santiago"}),
                time: startsAt.toLocaleTimeString("es-CL", {
                    timeZone: "America/Santiago",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false
                }),
                client: item.client_name,
                service: item.service_name ?? servicesById.get(item.service_id)?.name ?? "Servicio",
                stylist: professionalResult.data?.find(p => p.id === item.professional_id)?.name ?? item.professional_name ?? "Equipo Divas",
                duration: item.duration_minutes,
                status: item.status,
                serviceId: item.service_id,
                phone: item.client_phone
            };
        }));
    }

    useEffect(() => {
        void loadData();
    }, [user?.id]);
    const items = useMemo(() => appointments.filter(item => item.date === date && (filter === "Todas" || item.stylist === filter)), [appointments, date, filter]);
    const weekDates = useMemo(() => weekFor(date), [date]);
    const team = professionals.filter(item => item.active).map(item => item.name);
    const weekItems = useMemo(() => appointments.filter(item => weekDates.includes(item.date) && (filter === "Todas" || item.stylist === filter)), [appointments, weekDates, filter]);
    const reminderDate = addDays(date, 1);
    const reminderAppointments = useMemo(() => appointments.filter(item => item.date === reminderDate && !["cancelled", "completed", "no_show"].includes(item.status)), [appointments, reminderDate]);
    const moveDate = (days: number) => {
        setDate(addDays(date, days));
    };

    async function createAppointment(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const service = services.find(item => item.id === Number(form.get("service")));
        const supabase = getSupabaseClient();
        if (!supabase || !service) return;
        const appointmentDate = String(form.get("date"));
        const startsAt = santiagoInstant(appointmentDate, String(form.get("time")));
        const professional = String(form.get("professional"));
        const professionalId = professionals.find(p => p.name === professional)?.id;
        if (!professionalId) { setFormError("Selecciona una profesional válida."); return; }
        const {
            data: existing,
            error: availabilityError
        } = await supabase.from("appointments").select("starts_at,duration_minutes,status").eq("professional_id", professionalId).gte("starts_at", santiagoDayStart(appointmentDate)).lte("starts_at", santiagoDayEnd(appointmentDate)).neq("status", "cancelled");
        const requested = String(form.get("time")).split(":").map(Number).reduce((total, value, index) => total + value * (index === 0 ? 60 : 1), 0);
        const conflict = (existing ?? []).some((item) => {
            const time = new Date(item.starts_at).toLocaleTimeString("es-CL", {
                timeZone: "America/Santiago",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }).split(":").map(Number);
            const start = time[0] * 60 + time[1];
            return requested < start + item.duration_minutes && requested + service.duration_minutes > start;
        });
        if (availabilityError || conflict) {
            setFormError(conflict ? "Ese horario ya está ocupado para esta profesional. Elige otra hora o profesional." : "No se pudo comprobar la disponibilidad.");
            return;
        }
        const {error} = await supabase.from("appointments").insert({
            client_id: Number(form.get("clientId")) || null,
            client_name: String(form.get("client")).trim(),
            client_phone: String(form.get("phone")).trim() || null,
            service_id: service.id,
            professional_name: professional,
            starts_at: startsAt,
            duration_minutes: service.duration_minutes,
            status: "pending"
        });
        if (error) {
            setFormError(isBookingConflict(error) ? BOOKING_CONFLICT_MESSAGE : "No se pudo guardar la cita. Inténtalo nuevamente.");
            return;
        }
        setFormError("");
        setOpen(false);
        setDate(appointmentDate);
        setNotice("Cita guardada correctamente.");
        void loadData();
    }

    async function removeAppointment(id: number) {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const {error} = await supabase.from("appointments").delete().eq("id", id).select("id").single();
        if (error) {
            setNotice("No se pudo eliminar la cita.");
            return;
        }
        setNotice("Cita eliminada.");
        void loadData();
    }

    async function updateAppointment(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!editing) return;
        const form = new FormData(event.currentTarget);
        const service = services.find(item => item.id === Number(form.get("service")));
        const supabase = getSupabaseClient();
        if (!supabase || !service) return;
        const appointmentDate = String(form.get("date"));
        const appointmentTime = String(form.get("time"));
        const professional = String(form.get("professional"));
        const professionalId = professionals.find(p => p.name === professional)?.id;
        if (!professionalId) { setFormError("Selecciona una profesional válida."); return; }
        const status = String(form.get("status"));
        const {
            data: existing,
            error: availabilityError
        } = await supabase.from("appointments").select("starts_at,duration_minutes,status").eq("professional_id", professionalId).gte("starts_at", santiagoDayStart(appointmentDate)).lte("starts_at", santiagoDayEnd(appointmentDate)).neq("status", "cancelled").neq("id", editing.id);
        const requested = appointmentTime.split(":").map(Number).reduce((total, value, index) => total + value * (index === 0 ? 60 : 1), 0);
        const conflict = status !== "cancelled" && (existing ?? []).some((item) => {
            const time = new Date(item.starts_at).toLocaleTimeString("es-CL", {
                timeZone: "America/Santiago",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }).split(":").map(Number);
            const start = time[0] * 60 + time[1];
            return requested < start + item.duration_minutes && requested + (editing.serviceId === service.id ? editing.duration : service.duration_minutes) > start;
        });
        if (availabilityError || conflict) {
            setFormError(conflict ? "Ese horario ya está ocupado para esta profesional. Elige otra hora o profesional." : "No se pudo comprobar la disponibilidad.");
            return;
        }
        const {error} = await supabase.from("appointments").update({
            client_id: Number(form.get("clientId")) || null,
            client_name: String(form.get("client")).trim(),
            client_phone: String(form.get("phone")).trim() || null,
            service_id: service.id,
            professional_name: professional,
            starts_at: santiagoInstant(appointmentDate, appointmentTime),
            duration_minutes: editing.serviceId === service.id ? editing.duration : service.duration_minutes,
            status
        }).eq("id", editing.id).select("id").single();
        if (error) {
            setFormError(isBookingConflict(error) ? BOOKING_CONFLICT_MESSAGE : "No se pudo actualizar la cita. Inténtalo nuevamente.");
            return;
        }
        const updatedAppointment: Appointment = {id: editing.id, clientId: Number(form.get("clientId")) || editing.clientId, price: editing.serviceId === service.id ? editing.price : service.price, date: appointmentDate, time: appointmentTime, client: String(form.get("client")).trim(), phone: String(form.get("phone")).trim() || null, service: editing.serviceId === service.id ? editing.service : service.name, stylist: professional, duration: editing.serviceId === service.id ? editing.duration : service.duration_minutes, status, serviceId: service.id};
        setFormError("");
        setEditing(null);
        setDate(appointmentDate);
        setNotice("Cita actualizada correctamente.");
        if (status === "confirmed") setDetails(updatedAppointment);
        void loadData();
    }

    async function updateStatus(appointment: Appointment, status: string) {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const {error} = await supabase.from("appointments").update({status}).eq("id", appointment.id).select("id").single();
        setNotice(error ? (isBookingConflict(error) ? BOOKING_CONFLICT_MESSAGE : "No se pudo actualizar el estado.") : status === "confirmed" ? "Cita confirmada. Envía el mensaje a la clienta." : "Estado de la cita actualizado.");
        if (!error) {
            if (status === "confirmed") setDetails({...appointment, status});
            void loadData();
        }
    }

    if (!ready) return <main className="auth-page"><p>Cargando Divas Beauty Spa…</p></main>;
    if (!user) return <main className="auth-page"><p>Abriendo acceso del equipo…</p></main>;
    if (accessLoading) return <main className="auth-page"><p>Comprobando acceso…</p></main>;
    if (!profile?.active) return <main className="auth-page"><section className="auth-card"><h1>Acceso al salón</h1><p role="status">{notice || "Tu cuenta está pendiente de autorización."}</p><button className="primary full" onClick={() => void loadData()}>Comprobar acceso</button><button className="text-button" onClick={() => getSupabaseClient()?.auth.signOut()}>Cerrar sesión</button></section></main>;
    const activeServices = services.filter(service => service.active);
    const nav: { id: View; icon: string; label: string }[] = [{
        id: "agenda",
        icon: "▦",
        label: "Agenda"
    }, {id: "clientes", icon: "♧", label: "Clientes"}, {id: "servicios", icon: "✧", label: "Servicios"}, {
        id: "equipo",
        icon: "♙",
        label: "Equipo"
    }];
    if (profile.role === "admin") nav.push({id: "contenido", icon: "✿", label: "Contenido"});
    return <main>
        <aside className="sidebar">
            <div className="brand"><SalonLogo/></div>
            <nav>{nav.map(item => <button key={item.id} className={view === item.id ? "active" : ""}
                                          onClick={() => setView(item.id)}>{item.icon}<span>{item.label}</span>
            </button>)}</nav>
            <div className="profile">
                <div className="avatar">{user.email?.[0].toUpperCase()}</div>
                <div><strong>{profile.full_name}</strong><small>{profile.role === "admin" ? "Administración" : "Trabajadora"}</small>
                    <button className="sign-out" onClick={() => getSupabaseClient()?.auth.signOut()}>Cerrar sesión
                    </button>
                </div>
            </div>
        </aside>
        <section className="content"><div className="session-bar"><a className="text-button" href="/" target="_blank" rel="noreferrer">Ver página del salón ↗</a><span>{profile.full_name} · {profile.role === "admin" ? "Administración" : "Mi agenda"}</span><button className="text-button" onClick={() => getSupabaseClient()?.auth.signOut()}>Cerrar sesión</button></div>{view === "agenda" ? <>
            <header>
                <div><p className="eyebrow">SANTIAGO, CHILE</p><h1>Agenda de Divas <span>✦</span></h1><p
                    className="subtle">Consulta y gestiona las citas del salón.</p></div>
                <div className="header-actions">
                    <button className="reminders-button" onClick={() => setRemindersOpen(true)}>◷ Recordatorios</button>
                    <button className="primary" onClick={() => {
                        setFormError("");
                        setEditing(null);
                        setOpen(true);
                    }}>＋ Nueva cita
                    </button>
                </div>
            </header>
            <section className="summary">
                <div><span className="summary-icon pink">◷</span><p>Citas del
                    día<strong>{appointments.filter(item => item.date === date).length}</strong></p></div>
                <div><span className="summary-icon purple">♙</span><p>Servicios
                    activos<strong>{activeServices.length}</strong></p></div>
                <div><span className="summary-icon peach">$</span><p>Estado<strong>En línea</strong></p></div>
            </section>
            <section className="agenda-card">
                <div className="agenda-top">
                    <div>
                        <div className="date-controls">
                            <button aria-label={agendaMode === "week" ? "Semana anterior" : "Día anterior"} onClick={() => moveDate(agendaMode === "week" ? -7 : -1)}>‹</button>
                            <h2>{agendaMode === "week" ? `${new Intl.DateTimeFormat("es-CL", {day: "numeric", month: "short"}).format(new Date(`${weekDates[0]}T12:00:00`))} – ${new Intl.DateTimeFormat("es-CL", {day: "numeric", month: "short"}).format(new Date(`${weekDates[6]}T12:00:00`))}` : new Intl.DateTimeFormat("es-CL", {weekday: "long", day: "numeric", month: "long"}).format(new Date(`${date}T12:00:00`))}</h2>
                            <button aria-label={agendaMode === "week" ? "Semana siguiente" : "Día siguiente"} onClick={() => moveDate(agendaMode === "week" ? 7 : 1)}>›</button>
                        </div>
                        <p>{agendaMode === "week" ? `${weekItems.length} citas programadas esta semana` : `${items.length} citas programadas`}</p></div>
                    <div className="agenda-tools"><div className="view-toggle" aria-label="Vista de agenda">
                        <button className={agendaMode === "day" ? "selected" : ""} onClick={() => setAgendaMode("day")}>Día</button>
                        <button className={agendaMode === "week" ? "selected" : ""} onClick={() => setAgendaMode("week")}>Semana</button>
                    </div><div className="filters">
                        <button className={filter === "Todas" ? "selected" : ""}
                                onClick={() => setFilter("Todas")}>Todas
                        </button>
                        {team.map(name => <button key={name} className={filter === name ? "selected" : ""}
                                                  onClick={() => setFilter(name)}>{name}</button>)}</div></div>
                </div>
                {notice && <div className="notice">✓ {notice}
                    <button onClick={() => setNotice("")}>×</button>
                </div>}
                {agendaMode === "week" ? <WeeklyAgenda dates={weekDates} appointments={weekItems} selectedDate={date} onSelectDay={(selectedDate) => { setDate(selectedDate); setAgendaMode("day"); }}/> : <div className="appointments">{items.map(item => <article className="appointment" key={item.id}>
                    <time>{item.time}</time>
                    <div className="line"/>
                    <div className="details">
                        <strong>{item.client}</strong><span>{item.service} · {item.duration} min</span></div>
                    <span className="stylist">{item.stylist}</span><select className="status-select" value={item.status}
                                                                           onChange={event => updateStatus(item, event.target.value)}>
                    <option value="pending">Pendiente</option>
                    <option value="confirmed">Confirmada</option>
                    <option value="completed">Completada</option>
                    <option value="cancelled">Cancelada</option>
                    <option value="no_show">No asistió</option>
                </select>
                    <button className="edit" type="button" aria-label={`Editar cita de ${item.client}`} title="Editar cita" onClick={() => {
                        setFormError("");
                        setOpen(false);
                        setEditing(item);
                    }}>✎ <span>Editar</span>
                    </button>
                    <button className="view-appointment" type="button" onClick={() => setDetails(item)}>Ver</button>
                    <button className="delete" onClick={() => removeAppointment(item.id)}>x</button>
                </article>)}{!items.length && <p className="empty">No hay citas para este día.</p>}</div>}
            </section>
        </> : view === "contenido" ? (profile.role === "admin" ? <SalonContent/> : <p>Solo administración puede editar el contenido.</p>) : <Directory key={view} view={view} services={services} clients={clients} appointments={appointments} profile={profile} professionals={professionals} onRefresh={loadData}/>}</section>
        {open && <AppointmentForm clients={clients} date={date} services={activeServices} professionals={team} error={formError} onClose={() => setOpen(false)}
                                  onSubmit={createAppointment}/>} {editing &&
        <AppointmentForm clients={clients} key={editing.id} date={editing.date} services={services.filter(s => s.active || s.id === editing.serviceId)} professionals={Array.from(new Set([...team, editing.stylist]))} error={formError}
                         appointment={editing} onClose={() => setEditing(null)} onSubmit={updateAppointment}/>} {details &&
        <AppointmentDetails appointment={details} service={services.find(service => service.id === details.serviceId)} onClose={() => setDetails(null)} onEdit={() => { setDetails(null); setFormError(""); setEditing(details); }}/>} {remindersOpen &&
        <ReminderPanel date={reminderDate} appointments={reminderAppointments} onClose={() => setRemindersOpen(false)}/>}</main>;
}

function WeeklyAgenda({dates, appointments, selectedDate, onSelectDay}: { dates: string[]; appointments: Appointment[]; selectedDate: string; onSelectDay: (date: string) => void }) {
    const dayLabel = new Intl.DateTimeFormat("es-CL", {weekday: "short"});
    return <div className="week-grid">{dates.map(day => {
        const dayAppointments = appointments.filter(appointment => appointment.date === day);
        const current = day === selectedDate;
        return <button className={`week-day${current ? " current" : ""}`} key={day} onClick={() => onSelectDay(day)}>
            <span className="week-date"><small>{dayLabel.format(new Date(`${day}T12:00:00`)).replace(".", "")}</small><strong>{new Date(`${day}T12:00:00`).getDate()}</strong></span>
            <span className="week-appointments">{dayAppointments.map(appointment => <span className={`week-appointment ${appointment.status}`} key={appointment.id}><b>{appointment.time}</b>{appointment.client}<small>{appointment.service}</small></span>)}{!dayAppointments.length && <span className="week-empty">Sin citas</span>}</span>
        </button>;
    })}</div>;
}

function AppointmentDetails({appointment, service, onClose, onEdit}: { appointment: Appointment; service?: Service; onClose: () => void; onEdit: () => void }) {
    const statusLabels: Record<string, string> = {pending: "Pendiente", confirmed: "Confirmada", completed: "Completada", cancelled: "Cancelada", no_show: "No asistió"};
    const displayDate = new Intl.DateTimeFormat("es-CL", {weekday: "long", day: "numeric", month: "long", year: "numeric"}).format(new Date(`${appointment.date}T12:00:00`));
    const rawPhone = appointment.phone?.replace(/\D/g, "");
    const phone = rawPhone?.length === 9 && rawPhone.startsWith("9") ? `56${rawPhone}` : rawPhone;
    const confirmation = `Hola ${appointment.client}, te escribimos desde Divas Beauty Spa para confirmar tu cita.\n\nServicio: ${appointment.service}\nFecha: ${displayDate}\nHora: ${appointment.time} hrs\nProfesional: ${appointment.stylist}\n\nPor favor responde a este mensaje para confirmar tu asistencia. ¡Te esperamos! ✦`;
    const whatsappUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(confirmation)}` : null;
    return <div className="modal-backdrop"><section className="modal appointment-details" role="dialog" aria-modal="true" aria-label={`Detalle de cita de ${appointment.client}`}>
        <div className="modal-title"><div><p className="eyebrow">DIVAS BEAUTY SPA · CITA</p><h2>Detalle de la cita</h2></div><button type="button" aria-label="Cerrar detalle" onClick={onClose}>×</button></div>
        <div className="details-client"><div className="initials">{appointment.client.split(" ").map(part => part[0]).join("").slice(0, 2)}</div><div><strong>{appointment.client}</strong><span>{appointment.phone ?? "Sin teléfono registrado"}</span></div><b className={`details-status ${appointment.status}`}>{statusLabels[appointment.status] ?? appointment.status}</b></div>
        <dl className="appointment-data"><div><dt>Servicio solicitado</dt><dd>{appointment.service}</dd></div><div><dt>Duración</dt><dd>{appointment.duration} minutos</dd></div><div><dt>Fecha</dt><dd>{displayDate}</dd></div><div><dt>Horario</dt><dd>{appointment.time} hrs</dd></div><div><dt>Profesional</dt><dd>{appointment.stylist}</dd></div><div><dt>Valor</dt><dd>{appointment.price != null ? formatMoney(appointment.price) : "No disponible"}</dd></div></dl>
        {whatsappUrl ? <a className="whatsapp-confirm" href={whatsappUrl} target="_blank" rel="noreferrer">◉ Enviar confirmación por WhatsApp</a> : <p className="missing-phone">Agrega un teléfono para enviar la confirmación por WhatsApp.</p>}
        <button className="primary full" onClick={onEdit}>✎ Editar cita</button>
    </section></div>;
}

function ReminderPanel({date, appointments, onClose}: { date: string; appointments: Appointment[]; onClose: () => void }) {
    const displayDate = new Intl.DateTimeFormat("es-CL", {weekday: "long", day: "numeric", month: "long"}).format(new Date(`${date}T12:00:00`));
    return <div className="modal-backdrop"><section className="modal reminders-panel" role="dialog" aria-modal="true" aria-label="Recordatorios de citas">
        <div className="modal-title"><div><p className="eyebrow">DIVAS BEAUTY SPA · AGENDA</p><h2>Recordatorios</h2><p className="subtle">Citas para {displayDate}</p></div><button type="button" aria-label="Cerrar recordatorios" onClick={onClose}>×</button></div>
        <div className="reminder-list">{appointments.map(appointment => {
            const rawPhone = appointment.phone?.replace(/\D/g, "");
            const phone = rawPhone?.length === 9 && rawPhone.startsWith("9") ? `56${rawPhone}` : rawPhone;
            const message = `Hola ${appointment.client}, te recordamos tu cita de mañana en Divas Beauty Spa.\n\nServicio: ${appointment.service}\nHora: ${appointment.time} hrs\nProfesional: ${appointment.stylist}\n\n¡Te esperamos! Si necesitas reagendar, responde a este mensaje. ✦`;
            return <article className="reminder-row" key={appointment.id}><div><strong>{appointment.time} · {appointment.client}</strong><span>{appointment.service} · {appointment.stylist}</span></div>{phone ? <a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Enviar WhatsApp</a> : <span className="phone-needed">Sin WhatsApp</span>}</article>;
        })}{!appointments.length && <p className="empty">No hay citas que requieran recordatorio para este día.</p>}</div>
    </section></div>;
}

function AppointmentForm({clients, date, services, professionals, error, appointment, onClose, onSubmit}: {
    clients: Client[];
    date: string;
    services: Service[];
    professionals: string[];
    error: string;
    appointment?: Appointment;
    onClose: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
}) {
    const [selectedDate, setSelectedDate] = useState(appointment?.date ?? date), [serviceId, setServiceId] = useState(appointment ? String(appointment.serviceId) : ""), [professional, setProfessional] = useState(appointment?.stylist ?? ""), [slots, setSlots] = useState<string[]>([]), [loading, setLoading] = useState(false);
    const [slotError, setSlotError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [clientId, setClientId] = useState(String(appointment?.clientId ?? ""));
    const selectedClient = clients.find(c => String(c.id) === clientId);
    const [selectedTime, setSelectedTime] = useState(appointment?.time ?? "");
    useEffect(() => {
        if (!serviceId || !professional) {
            setSlots([]);
            return;
        }
        const controller = new AbortController();
        setLoading(true);
        setSlotError("");
        if (error === BOOKING_CONFLICT_MESSAGE) setSelectedTime("");
        const exclude = appointment ? `&excludeAppointmentId=${appointment.id}` : "";
        async function loadSlots() {
            try {
                const session = await getSupabaseClient()?.auth.getSession();
                const token = session?.data.session?.access_token;
                const response = await fetch(`/api/public-booking?date=${selectedDate}&serviceId=${serviceId}&professional=${encodeURIComponent(professional)}${exclude}`, {signal: controller.signal, headers: token ? {Authorization: `Bearer ${token}`} : {}});
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "No se pudieron cargar los horarios.");
                if (controller.signal.aborted) return;
                const available: string[] = data.slots ?? [];
                const isOriginalSlot = error !== BOOKING_CONFLICT_MESSAGE && appointment?.date === selectedDate && appointment.serviceId === Number(serviceId) && appointment.stylist === professional;
                setSlots(isOriginalSlot && appointment.time && !available.includes(appointment.time) ? [appointment.time, ...available] : available);
            } catch (error) {
                if (!controller.signal.aborted) {setSlots([]); setSlotError(error instanceof Error ? error.message : "No se pudieron cargar los horarios.");}
            } finally { if (!controller.signal.aborted) setLoading(false); }
        }
        void loadSlots();
        return () => controller.abort();
    }, [selectedDate, serviceId, professional, appointment, error]);
    return <div className="modal-backdrop">
        <form className="modal" onSubmit={async event => { event.preventDefault(); if (submitting) return; setSubmitting(true); try { await onSubmit(event); } finally { setSubmitting(false); } }}>
            <div className="modal-title">
                <div><p className="eyebrow">DIVAS BEAUTY SPA · AGENDA</p>
                    <h2>{appointment ? "Editar cita" : "Nueva cita"}</h2></div>
                <button type="button" onClick={onClose}>×</button>
            </div>
            <label>Ficha de clienta<select name="clientId" value={clientId} onChange={e => setClientId(e.target.value)}><option value="">Nueva clienta</option>{clients.map(c => <option key={c.id} value={c.id}>{c.full_name}{c.phone ? ` · ${c.phone}` : ""}</option>)}</select></label>
            <label>Cliente<input key={`name-${clientId}`} required name="client" readOnly={!!selectedClient} defaultValue={selectedClient?.full_name ?? (clientId ? appointment?.client : "")}
                                 placeholder="Nombre de la clienta"/></label><label>WhatsApp<input key={`phone-${clientId}`} name="phone" type="tel" readOnly={!!selectedClient} defaultValue={selectedClient?.phone ?? (clientId ? appointment?.phone ?? "" : "")}
                                 placeholder="+56 9 ..."/></label><label>Servicio<select required
                                                                                                    name="service"
                                                                                                    value={serviceId}
                                                                                                    onChange={event => { setServiceId(event.target.value); setSelectedTime(""); }}>
            <option disabled value="">Selecciona un servicio</option>
            {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
        </select></label>
            <div className="form-row"><label>Fecha<input required name="date" type="date" value={selectedDate}
                                                         onChange={event => { setSelectedDate(event.target.value); setSelectedTime(""); }}/></label><label>Profesional<select
                required name="professional" value={professional}
                onChange={event => { setProfessional(event.target.value); setSelectedTime(""); }}>
                <option disabled value="">Selecciona</option>
                {professionals.map(name => <option key={name}>{name}</option>)}</select></label></div>
            <label>Hora disponible<select required name="time" disabled={!slots.length} value={selectedTime}
                                          onChange={event => setSelectedTime(event.target.value)}>
                <option value="">{loading ? "Buscando horarios…" : "Selecciona una hora"}</option>
                {slots.map(slot => <option key={slot}>{slot}</option>)}</select></label>{appointment &&
            <label>Estado<select name="status" defaultValue={appointment.status}>
                <option value="pending">Pendiente</option>
                <option value="confirmed">Confirmada</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
                <option value="no_show">No asistió</option>
            </select></label>}{error && <p className="form-error">{error}</p>}
            {slotError && <p className="form-error" role="alert">{slotError}</p>}
            <button className="primary full" disabled={submitting || loading || !slots.length}>{submitting ? "Guardando…" : appointment ? "Guardar cambios" : "Guardar cita"}</button>
        </form>
    </div>;
}
