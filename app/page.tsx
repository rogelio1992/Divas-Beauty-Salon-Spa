"use client";

import {FormEvent, useEffect, useMemo, useState} from "react";
import type {User} from "@supabase/supabase-js";
import {getSupabaseClient} from "../lib/supabase";
import {santiagoDayEnd, santiagoDayStart, santiagoInstant} from "../lib/santiago-time";

type View = "agenda" | "clientes" | "servicios" | "equipo";
type AgendaMode = "day" | "week";
type Service = { id: number; name: string; category: string; duration_minutes: number; price: number };
type Professional = { id: number; name: string; specialty: string; work_days: number[]; work_start_time: string; work_end_time: string; active: boolean };
type Appointment = {
    id: number;
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

export default function Home() {
    const [user, setUser] = useState<User | null>(null);
    const [ready, setReady] = useState(false);
    const [view, setView] = useState<View>("agenda");
    const [agendaMode, setAgendaMode] = useState<AgendaMode>("day");
    const [date, setDate] = useState("2026-09-02");
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
            setUser(data.user);
            setReady(true);
        });
        const {data: listener} = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
        return () => listener.subscription.unsubscribe();
    }, []);

    async function loadData() {
        const supabase = getSupabaseClient();
        if (!supabase || !user) return;
        const [serviceResult, appointmentResult, professionalResult] = await Promise.all([
            supabase.from("services").select("id,name,category,duration_minutes,price").eq("active", true).order("name"),
            supabase.from("appointments").select("id,client_name,client_phone,service_id,professional_name,starts_at,duration_minutes,status").order("starts_at"),
            supabase.from("professionals").select("id,name,specialty,work_days,work_start_time,work_end_time,active").order("name")
        ]);
        if (serviceResult.error || appointmentResult.error || professionalResult.error) {
            setNotice("No se pudo cargar la agenda. Revisa la migración de Supabase.");
            return;
        }
        const loadedServices = serviceResult.data ?? [];
        const servicesById = new Map(loadedServices.map((service) => [service.id, service]));
        setServices(loadedServices);
        setProfessionals(professionalResult.data ?? []);
        setAppointments((appointmentResult.data ?? []).map((item: any) => {
            const startsAt = new Date(item.starts_at);
            return {
                id: item.id,
                date: startsAt.toLocaleDateString("en-CA", {timeZone: "America/Santiago"}),
                time: startsAt.toLocaleTimeString("es-CL", {
                    timeZone: "America/Santiago",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false
                }),
                client: item.client_name,
                service: servicesById.get(item.service_id)?.name ?? "Servicio",
                stylist: item.professional_name ?? "Equipo Divas",
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
    const clients = useMemo(() => Array.from(new Set(appointments.map(item => item.client))).map(name => ({
        name,
        visits: appointments.filter(item => item.client === name).length
    })), [appointments]);
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
        const {
            data: existing,
            error: availabilityError
        } = await supabase.from("appointments").select("starts_at,duration_minutes,status").eq("professional_name", professional).gte("starts_at", santiagoDayStart(appointmentDate)).lte("starts_at", santiagoDayEnd(appointmentDate)).neq("status", "cancelled");
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
            client_name: form.get("client"),
            client_phone: String(form.get("phone")).trim() || null,
            service_id: service.id,
            professional_name: professional,
            starts_at: startsAt,
            duration_minutes: service.duration_minutes,
            status: "pending"
        });
        if (error) {
            setFormError("No se pudo guardar la cita. Inténtalo nuevamente.");
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
        const {error} = await supabase.from("appointments").delete().eq("id", id);
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
        const status = String(form.get("status"));
        const {
            data: existing,
            error: availabilityError
        } = await supabase.from("appointments").select("starts_at,duration_minutes,status").eq("professional_name", professional).gte("starts_at", santiagoDayStart(appointmentDate)).lte("starts_at", santiagoDayEnd(appointmentDate)).neq("status", "cancelled").neq("id", editing.id);
        const requested = appointmentTime.split(":").map(Number).reduce((total, value, index) => total + value * (index === 0 ? 60 : 1), 0);
        const conflict = status !== "cancelled" && (existing ?? []).some((item) => {
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
        const {error} = await supabase.from("appointments").update({
            client_name: String(form.get("client")).trim(),
            client_phone: String(form.get("phone")).trim() || null,
            service_id: service.id,
            professional_name: professional,
            starts_at: santiagoInstant(appointmentDate, appointmentTime),
            duration_minutes: service.duration_minutes,
            status
        }).eq("id", editing.id);
        if (error) {
            setFormError("No se pudo actualizar la cita. Inténtalo nuevamente.");
            return;
        }
        const updatedAppointment: Appointment = {id: editing.id, date: appointmentDate, time: appointmentTime, client: String(form.get("client")).trim(), phone: String(form.get("phone")).trim() || null, service: service.name, stylist: professional, duration: service.duration_minutes, status, serviceId: service.id};
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
        const {error} = await supabase.from("appointments").update({status}).eq("id", appointment.id);
        setNotice(error ? "No se pudo actualizar el estado." : status === "confirmed" ? "Cita confirmada. Envía el mensaje a la clienta." : "Estado de la cita actualizado.");
        if (!error) {
            if (status === "confirmed") setDetails({...appointment, status});
            void loadData();
        }
    }

    if (!ready) return <main className="auth-page"><p>Cargando Divas Beauty Spa…</p></main>;
    if (!user) return <Auth/>;
    const nav: { id: View; icon: string; label: string }[] = [{
        id: "agenda",
        icon: "▦",
        label: "Agenda"
    }, {id: "clientes", icon: "♧", label: "Clientes"}, {id: "servicios", icon: "✧", label: "Servicios"}, {
        id: "equipo",
        icon: "♙",
        label: "Equipo"
    }];
    return <main>
        <aside className="sidebar">
            <div className="brand"><span>✦</span>
                <div>DIVAS<small>BEAUTY SPA</small></div>
            </div>
            <nav>{nav.map(item => <button key={item.id} className={view === item.id ? "active" : ""}
                                          onClick={() => setView(item.id)}>{item.icon}<span>{item.label}</span>
            </button>)}</nav>
            <div className="profile">
                <div className="avatar">{user.email?.[0].toUpperCase()}</div>
                <div><strong>{user.email}</strong>
                    <button className="sign-out" onClick={() => getSupabaseClient()?.auth.signOut()}>Cerrar sesión
                    </button>
                </div>
            </div>
        </aside>
        <section className="content">{view === "agenda" ? <>
            <header>
                <div><p className="eyebrow">SANTIAGO, CHILE</p><h1>Agenda de Divas <span>✦</span></h1><p
                    className="subtle">Agenda sincronizada en tiempo real.</p></div>
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
                    activos<strong>{services.length}</strong></p></div>
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
        </> : <Directory view={view} services={services} clients={clients} professionals={professionals} onRefresh={loadData}/>}</section>
        {open && <AppointmentForm date={date} services={services} professionals={team} error={formError} onClose={() => setOpen(false)}
                                  onSubmit={createAppointment}/>} {editing &&
        <AppointmentForm key={editing.id} date={editing.date} services={services} professionals={team} error={formError}
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
        <dl className="appointment-data"><div><dt>Servicio solicitado</dt><dd>{appointment.service}</dd></div><div><dt>Duración</dt><dd>{appointment.duration} minutos</dd></div><div><dt>Fecha</dt><dd>{displayDate}</dd></div><div><dt>Horario</dt><dd>{appointment.time} hrs</dd></div><div><dt>Profesional</dt><dd>{appointment.stylist}</dd></div><div><dt>Valor</dt><dd>{service ? formatMoney(service.price) : "No disponible"}</dd></div></dl>
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

function Auth() {
    const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [message, setMessage] = useState("");

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const supabase = getSupabaseClient();
        if (!supabase) {
            setMessage("Faltan las variables de Supabase en Vercel.");
            return;
        }
        const {error} = await supabase.auth.signInWithPassword({email, password});
        setMessage(error ? "Datos incorrectos. Si aún no tienes acceso, crea tu cuenta." : "Sesión iniciada.");
    }

    async function signUp() {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const {error} = await supabase.auth.signUp({email, password});
        setMessage(error ? error.message : "Revisa tu correo y confirma la cuenta para ingresar.");
    }

    return <main className="auth-page">
        <form className="auth-card" onSubmit={submit}>
            <div className="brand"><span>✦</span>
                <div>DIVAS<small>BEAUTY SPA</small></div>
            </div>
            <h1>Agenda del salón</h1><p>Ingresa con tu cuenta para ver las citas.</p><label>Correo<input type="email"
                                                                                                         required
                                                                                                         value={email}
                                                                                                         onChange={e => setEmail(e.target.value)}/></label><label>Contraseña<input
            type="password" required minLength={6} value={password}
            onChange={e => setPassword(e.target.value)}/></label>{message && <p className="auth-message">{message}</p>}
            <button className="primary full">Iniciar sesión</button>
            <button className="text-button" type="button" onClick={signUp}>Crear primera cuenta</button>
        </form>
    </main>;
}

function Directory({view, services, clients, professionals, onRefresh}: {
    view: View;
    services: Service[];
    clients: { name: string; visits: number }[];
    professionals: Professional[];
    onRefresh: () => Promise<void>
}) {
    const title = view[0].toUpperCase() + view.slice(1);
    async function editProfessional(professional?: Professional) {
        const name = window.prompt("Nombre de la profesional", professional?.name ?? "");
        if (!name?.trim()) return;
        const specialty = window.prompt("Especialidad", professional?.specialty ?? "Servicios de belleza");
        const days = window.prompt("Días de trabajo (0 domingo, 1 lunes... separados por coma)", professional?.work_days.join(",") ?? "1,2,3,4,5,6");
        const start = window.prompt("Hora de inicio (HH:MM)", professional?.work_start_time.slice(0, 5) ?? "09:00");
        const end = window.prompt("Hora de término (HH:MM)", professional?.work_end_time.slice(0, 5) ?? "18:00");
        const workDays = days?.split(",").map(value => Number(value.trim())).filter(value => Number.isInteger(value) && value >= 0 && value <= 6) ?? [];
        if (!specialty?.trim() || !workDays.length || !/^\d{2}:\d{2}$/.test(start ?? "") || !/^\d{2}:\d{2}$/.test(end ?? "")) return;
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const values = {name: name.trim(), specialty: specialty.trim(), work_days: workDays, work_start_time: start, work_end_time: end, active: professional?.active ?? true};
        const {error} = professional ? await supabase.from("professionals").update(values).eq("id", professional.id) : await supabase.from("professionals").insert(values);
        if (error) window.alert("No se pudo guardar la profesional."); else void onRefresh();
    }
    async function toggleProfessional(professional: Professional) {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const {error} = await supabase.from("professionals").update({active: !professional.active}).eq("id", professional.id);
        if (error) window.alert("No se pudo actualizar la profesional."); else void onRefresh();
    }
    return <>
        <header>
            <div><p className="eyebrow">DIVAS BEAUTY SPA</p><h1>{title} <span>✦</span></h1><p
                className="subtle">{view === "clientes" ? "Historial de las clientas con citas agendadas." : view === "servicios" ? "Catálogo activo de servicios." : "Profesionales y horarios de referencia."}</p>
            </div>
        </header>
        <section className="directory-card">{view === "clientes" &&
            <div className="directory-list">{clients.map(client => <article className="directory-row" key={client.name}>
                <div className="initials">{client.name.split(" ").map(word => word[0]).join("")}</div>
                <div><strong>{client.name}</strong><span>Registrada en la agenda</span></div>
                <b>{client.visits} visita{client.visits > 1 ? "s" : ""}</b></article>)}{!clients.length &&
                <p className="empty">Aún no hay clientas registradas.</p>}</div>}{view === "servicios" &&
            <div className="service-grid">{services.map(service => <article className="service-card" key={service.id}>
                <span>{service.category}</span><h3>{service.name}</h3><p>{service.duration_minutes} min</p>
                <strong>{formatMoney(service.price)}</strong></article>)}</div>}{view === "equipo" && <><div className="team-actions"><button className="primary" onClick={() => editProfessional()}>＋ Agregar profesional</button></div>
            <div className="team-grid">{professionals.map(professional => <article className={`team-card${professional.active ? "" : " inactive"}`} key={professional.id}>
                <div className="team-avatar">{professional.name[0]}</div><h3>{professional.name}</h3><p>{professional.specialty}</p>
                <span>{professional.work_start_time.slice(0, 5)} – {professional.work_end_time.slice(0, 5)}</span><small>{professional.work_days.map(day => ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"][day]).join(" · ")}</small>
                <button className="view-appointment" onClick={() => editProfessional(professional)}>Configurar</button><button className="view-appointment" onClick={() => toggleProfessional(professional)}>{professional.active ? "Desactivar" : "Activar"}</button></article>)}{!professionals.length && <p className="empty">Aún no hay profesionales configuradas.</p>}</div></>}</section>
    </>;
}

function AppointmentForm({date, services, professionals, error, appointment, onClose, onSubmit}: {
    date: string;
    services: Service[];
    professionals: string[];
    error: string;
    appointment?: Appointment;
    onClose: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
    const [selectedDate, setSelectedDate] = useState(appointment?.date ?? date), [serviceId, setServiceId] = useState(appointment ? String(appointment.serviceId) : ""), [professional, setProfessional] = useState(appointment?.stylist ?? ""), [slots, setSlots] = useState<string[]>([]), [loading, setLoading] = useState(false);
    const [selectedTime, setSelectedTime] = useState(appointment?.time ?? "");
    useEffect(() => {
        if (!serviceId || !professional) {
            setSlots([]);
            return;
        }
        setLoading(true);
        const exclude = appointment ? `&excludeAppointmentId=${appointment.id}` : "";
        fetch(`/api/public-booking?date=${selectedDate}&serviceId=${serviceId}&professional=${encodeURIComponent(professional)}${exclude}`).then(response => response.json()).then(data => {
            const available = data.slots ?? [];
            const isOriginalSlot = appointment?.date === selectedDate && appointment.serviceId === Number(serviceId) && appointment.stylist === professional;
            setSlots(isOriginalSlot && appointment.time && !available.includes(appointment.time) ? [appointment.time, ...available] : available);
        }).finally(() => setLoading(false));
    }, [selectedDate, serviceId, professional, appointment]);
    return <div className="modal-backdrop">
        <form className="modal" onSubmit={onSubmit}>
            <div className="modal-title">
                <div><p className="eyebrow">DIVAS BEAUTY SPA · AGENDA</p>
                    <h2>{appointment ? "Editar cita" : "Nueva cita"}</h2></div>
                <button type="button" onClick={onClose}>×</button>
            </div>
            <label>Cliente<input required name="client" defaultValue={appointment?.client}
                                 placeholder="Nombre de la clienta"/></label><label>WhatsApp<input name="phone" type="tel" defaultValue={appointment?.phone ?? ""}
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
            <button className="primary full">{appointment ? "Guardar cambios" : "Guardar cita"}</button>
        </form>
    </div>;
}
