"use client";

import { FormEvent, useMemo, useState } from "react";

type Appointment = { id: number; time: string; client: string; service: string; stylist: string; duration: number; status: "Confirmada" | "Pendiente" };

const initialAppointments: Appointment[] = [
  { id: 1, time: "09:00", client: "Camila Rojas", service: "Balayage", stylist: "Sofía", duration: 180, status: "Confirmada" },
  { id: 2, time: "10:30", client: "Valentina Díaz", service: "Manicure gel", stylist: "Valentina", duration: 60, status: "Confirmada" },
  { id: 3, time: "13:00", client: "María Paz", service: "Corte + brushing", stylist: "Sofía", duration: 75, status: "Pendiente" },
  { id: 4, time: "15:30", client: "Antonia Silva", service: "Lifting de pestañas", stylist: "Daniela", duration: 60, status: "Confirmada" }
];

const team = ["Sofía", "Valentina", "Daniela"];

export default function Home() {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("Todas");
  const [notice, setNotice] = useState("");
  const shown = useMemo(() => filter === "Todas" ? appointments : appointments.filter((item) => item.stylist === filter), [appointments, filter]);

  function addAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const appointment: Appointment = {
      id: Date.now(), time: String(data.get("time")), client: String(data.get("client")),
      service: String(data.get("service")), stylist: String(data.get("stylist")),
      duration: Number(data.get("duration")), status: "Pendiente"
    };
    setAppointments((current) => [...current, appointment].sort((a, b) => a.time.localeCompare(b.time)));
    setIsOpen(false);
    setNotice(`Cita de ${appointment.client} creada correctamente.`);
    event.currentTarget.reset();
  }

  return <main>
    <aside className="sidebar">
      <div className="brand"><span>✦</span><div>DIVAS<small>BEAUTY SPA</small></div></div>
      <nav><a className="active" href="#agenda">▦ <span>Agenda</span></a><a href="#clientes">♧ <span>Clientes</span></a><a href="#servicios">✧ <span>Servicios</span></a><a href="#equipo">♙ <span>Equipo</span></a></nav>
      <div className="profile"><div className="avatar">MR</div><div><strong>María Rodríguez</strong><small>Administradora</small></div></div>
    </aside>
    <section className="content" id="agenda">
      <header><div><p className="eyebrow">MARTES, 2 DE SEPTIEMBRE</p><h1>Buenos días, María <span>✦</span></h1><p className="subtle">Aquí tienes el resumen de tu salón.</p></div><button className="primary" onClick={() => setIsOpen(true)}>＋ Nueva cita</button></header>
      <section className="summary"><div><span className="summary-icon pink">◷</span><p>Citas de hoy<strong>{appointments.length}</strong></p></div><div><span className="summary-icon purple">♙</span><p>Profesionales activas<strong>{team.length}</strong></p></div><div><span className="summary-icon peach">$</span><p>Ingresos estimados<strong>$184.000</strong></p></div></section>
      <section className="agenda-card"><div className="agenda-top"><div><h2>Agenda de hoy</h2><p>{shown.length} citas programadas</p></div><div className="filters"><button className={filter === "Todas" ? "selected" : ""} onClick={() => setFilter("Todas")}>Todas</button>{team.map((name) => <button key={name} className={filter === name ? "selected" : ""} onClick={() => setFilter(name)}>{name}</button>)}</div></div>
      {notice && <div className="notice">✓ {notice}<button onClick={() => setNotice("")}>×</button></div>}
      <div className="appointments">{shown.map((item) => <article className="appointment" key={item.id}><time>{item.time}</time><div className="line"/><div className="details"><strong>{item.client}</strong><span>{item.service} · {item.duration} min</span></div><span className="stylist">{item.stylist}</span><span className={`status ${item.status === "Confirmada" ? "confirmed" : "pending"}`}>{item.status}</span><button className="more" aria-label={`Opciones para ${item.client}`}>•••</button></article>)}</div></section>
    </section>
    {isOpen && <div className="modal-backdrop"><form className="modal" onSubmit={addAppointment}><div className="modal-title"><div><p className="eyebrow">AGENDA</p><h2>Nueva cita</h2></div><button type="button" onClick={() => setIsOpen(false)}>×</button></div><label>Cliente<input required name="client" placeholder="Nombre de la clienta" /></label><label>Servicio<input required name="service" placeholder="Ej. Manicure gel" /></label><div className="form-row"><label>Hora<input required name="time" type="time" defaultValue="10:00" /></label><label>Duración<select name="duration" defaultValue="60"><option value="30">30 min</option><option value="60">60 min</option><option value="90">90 min</option><option value="120">120 min</option></select></label></div><label>Profesional<select name="stylist">{team.map((name) => <option key={name}>{name}</option>)}</select></label><button className="primary full" type="submit">Guardar cita</button></form></div>}
  </main>;
}
