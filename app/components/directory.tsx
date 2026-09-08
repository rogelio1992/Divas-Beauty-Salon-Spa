"use client";

import {FormEvent, ReactNode, useEffect, useRef, useState} from "react";
import {getSupabaseClient} from "../../lib/supabase";
import type {Appointment, Professional, Service} from "../admin/page";
export type Profile = {id: string; full_name: string; email: string | null; role: "admin" | "staff"; active: boolean; professional_id: number | null};
export type Client = {id: number; full_name: string; phone: string | null; email: string | null; notes: string};
const money = (value: number) => new Intl.NumberFormat("es-CL", {style: "currency", currency: "CLP", maximumFractionDigits: 0}).format(value);
const statuses: Record<string, string> = {pending: "Pendiente", confirmed: "Confirmada", completed: "Completada", cancelled: "Cancelada", no_show: "No asistió"};

export function Modal({title, children, onClose}: {title: string; children: ReactNode; onClose: () => void}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { ref.current?.showModal(); }, []);
    return <dialog ref={ref} className="phase-dialog modal" onCancel={event => { event.preventDefault(); onClose(); }} aria-label={title}>
        <div className="modal-title"><h2>{title}</h2><button type="button" aria-label="Cerrar" onClick={onClose}>×</button></div>{children}
    </dialog>;
}

export default function Directory({view, services, clients, professionals, appointments, profile, onRefresh}: {
    view: string; services: Service[]; clients: Client[]; professionals: Professional[]; appointments: Appointment[]; profile: Profile; onRefresh: () => Promise<void>;
}) {
    const admin = profile.role === "admin";
    const [editor, setEditor] = useState<{kind: "service" | "client" | "professional"; id?: number} | null>(null);
    const [selectedClient, setSelectedClient] = useState<number | null>(null);
    const [accounts, setAccounts] = useState<Profile[]>([]);
    const [account, setAccount] = useState<Profile | null>(null);
    const [query, setQuery] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const [accountsLoading, setAccountsLoading] = useState(false);
    const [accountsMessage, setAccountsMessage] = useState("");
    const accountsRequest = useRef(false);
    async function loadAccounts() {
        if (!admin || accountsRequest.current) return;
        accountsRequest.current = true;
        setAccountsLoading(true);
        setAccountsMessage("");
        try {
            const db = getSupabaseClient();
            if (!db) throw new Error("Sin conexión");
            const result = await db.from("profiles").select("id,full_name,email,role,active,professional_id").order("full_name");
            if (result.error) throw result.error;
            const loaded: Profile[] = result.data ?? [];
            setAccounts(loaded);
            const disabled = loaded.filter(item => !item.active).length;
            setAccountsMessage(disabled ? `Lista actualizada. ${disabled} cuenta${disabled === 1 ? " sin habilitar" : "s sin habilitar"}.` : "Lista actualizada. No hay cuentas pendientes de habilitar.");
        } catch {
            setAccountsMessage("No se pudieron actualizar los accesos. Inténtalo nuevamente.");
        } finally {
            accountsRequest.current = false;
            setAccountsLoading(false);
        }
    }
    useEffect(() => { if (view === "equipo") void loadAccounts(); }, [view, admin]);
    const service = services.find(item => item.id === editor?.id);
    const client = clients.find(item => item.id === editor?.id);
    const professional = professionals.find(item => item.id === editor?.id);
    const detail = clients.find(item => item.id === selectedClient);
    function edit(kind: "service" | "client" | "professional", id?: number) { setMessage(""); setEditor({kind, id}); }
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!editor || busy || !admin) return;
        const form = new FormData(event.currentTarget);
        const text = (key: string) => String(form.get(key) ?? "").trim();
        const db = getSupabaseClient(); if (!db) return;
        let table: string, values: Record<string, unknown>;
        if (editor.kind === "service") {
            table = "services";
            values = {name: text("name"), category: text("category"), price: Number(text("price")), duration_minutes: Number(text("duration")), active: form.has("active")};
            if (!values.name || !values.category || !Number.isInteger(values.price) || Number(values.price) < 0 || !Number.isInteger(values.duration_minutes) || Number(values.duration_minutes) <= 0) { setMessage("Revisa nombre, categoría, precio y duración."); return; }
        } else if (editor.kind === "client") {
            table = "clients"; values = {full_name: text("name"), phone: text("phone") || null, email: text("email") || null, notes: text("notes")};
            if (!values.full_name) { setMessage("Indica el nombre de la clienta."); return; }
        } else {
            table = "professionals";
            const days = form.getAll("days").map(Number);
            if (!text("name") || !days.length || text("start") >= text("end")) { setMessage("Indica un nombre, al menos un día y una hora de término posterior al inicio."); return; }
            values = {name: text("name"), specialty: text("specialty"), work_days: days, work_start_time: text("start"), work_end_time: text("end"), active: form.has("active")};
        }
        setBusy(true); setMessage("");
        try {
            const result = editor.id ? await db.from(table).update(values).eq("id", editor.id).select("id").single() : await db.from(table).insert(values).select("id").single();
            if (result.error) { setMessage(result.error.code === "23505" ? "Ya existe un registro con esos datos. Revisa la ficha existente." : "No se pudo guardar. Revisa los datos y tus permisos."); return; }
            setEditor(null); setMessage("Cambios guardados."); await onRefresh();
        } catch { setMessage("No se pudo conectar. Inténtalo nuevamente."); } finally { setBusy(false); }
    }
    async function saveAccount(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (!account || busy || !admin) return;
        const form = new FormData(event.currentTarget);
        const role = String(form.get("role"));
        const professionalId = Number(form.get("professional")) || null;
        const active = form.has("active");
        if (role === "staff" && active && !professionalId) { setMessage("Selecciona una profesional para habilitar esta cuenta."); return; }
        setBusy(true); setMessage("");
        try {
            const result = await getSupabaseClient()?.from("profiles").update({role, active, professional_id: professionalId, full_name: String(form.get("name")).trim()}).eq("id", account.id).select("id").single();
            if (!result || result.error) { setMessage(result?.error?.code === "23505" ? "Esa profesional ya tiene una cuenta asignada." : "No se pudo actualizar el acceso."); return; }
            setAccount(null); setMessage("Acceso actualizado."); await loadAccounts(); await onRefresh();
        } catch { setMessage("No se pudo conectar. Inténtalo nuevamente."); } finally { setBusy(false); }
    }
    const visibleClients = clients.filter(item => `${item.full_name} ${item.phone ?? ""} ${item.email ?? ""}`.toLowerCase().includes(query.toLowerCase()));
    return <>
        <header><div><p className="eyebrow">DIVAS BEAUTY SPA</p><h1>{view === "clientes" ? "Clientas" : view === "servicios" ? "Servicios" : "Equipo"} <span>✦</span></h1><p className="subtle">{view === "clientes" ? (admin ? "Fichas de contacto e historial de citas." : "Clientas e historial de tus citas.") : view === "servicios" ? "Servicios, precios y duración." : "Profesionales, jornadas y accesos al salón."}</p></div>
        {admin && <button className="primary" onClick={() => edit(view === "clientes" ? "client" : view === "servicios" ? "service" : "professional")}>＋ {view === "clientes" ? "Nueva clienta" : view === "servicios" ? "Nuevo servicio" : "Agregar profesional"}</button>}</header>
        {message && !editor && !account && <p className="notice" role="status">{message}</p>}
        <section className="directory-card">
        {view === "clientes" && <><label className="directory-search">Buscar clienta<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre, teléfono o correo"/></label><div className="directory-list">{visibleClients.map(item => <article className="directory-row" key={item.id}><div className="initials">{item.full_name.slice(0, 2)}</div><div><strong>{item.full_name}</strong><span>{item.phone || "Sin teléfono"}</span></div><b>{appointments.filter(a => a.clientId === item.id && a.status === "completed").length} atendidas</b><button className="view-appointment" onClick={() => setSelectedClient(item.id)}>Ver ficha</button></article>)}{!visibleClients.length && <p className="empty">No hay clientas que mostrar.</p>}</div></>}
        {view === "servicios" && <div className="service-grid">{services.map(item => <article className="service-card" key={item.id}><span>{item.category} · {item.active ? "Activo" : "Inactivo"}</span><h3>{item.name}</h3><p>{item.duration_minutes} min</p><strong>{money(item.price)}</strong>{admin && <div><button className="view-appointment" onClick={() => edit("service", item.id)}>Editar servicio</button></div>}</article>)}{!services.length && <p className="empty">Aún no hay servicios.</p>}</div>}
        {view === "equipo" && <><div className="team-grid">{professionals.map(item => <article className={`team-card${item.active ? "" : " inactive"}`} key={item.id}><div className="team-avatar">{item.name[0]}</div><h3>{item.name}</h3><p>{item.specialty} · {item.active ? "Activa" : "Inactiva"}</p><span>{item.work_start_time.slice(0, 5)} – {item.work_end_time.slice(0, 5)}</span><small>{item.work_days.map(day => ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"][day]).join(" · ")}</small>{admin && <button className="view-appointment" onClick={() => edit("professional", item.id)}>Configurar</button>}</article>)}{!professionals.length && <p className="empty">Aún no hay profesionales.</p>}</div>
        {admin && <section className="accounts"><h2>Accesos del equipo</h2><p className="subtle">Cada trabajadora solicita su acceso desde el inicio de sesión. Aquí puedes vincularla a una profesional y habilitar su cuenta.</p><button className="view-appointment" onClick={loadAccounts} disabled={accountsLoading}>{accountsLoading ? "Actualizando…" : "Actualizar solicitudes"}</button><p className="subtle" role="status" aria-live="polite">{accountsMessage}</p>{accounts.map(item => <article className="directory-row" key={item.id}><div><strong>{item.full_name}</strong><span>{item.email}</span><span>{item.role === "admin" ? "Administración" : "Trabajadora"} · {item.active ? "Habilitada" : "Sin acceso"} · {professionals.find(p => p.id === item.professional_id)?.name ?? "Sin profesional asignada"}</span></div>{item.id === profile.id ? <b>Tu cuenta</b> : <button className="view-appointment" onClick={() => {setMessage(""); setAccount(item);}}>Gestionar acceso</button>}</article>)}</section>}</>}
        </section>
        {editor && <Modal title={editor.kind === "service" ? "Servicio" : editor.kind === "client" ? "Ficha de clienta" : "Profesional y jornada"} onClose={() => !busy && setEditor(null)}><form onSubmit={save}>
        <label>Nombre<input name="name" required maxLength={150} defaultValue={editor.kind === "service" ? service?.name : editor.kind === "client" ? client?.full_name : professional?.name}/></label>
        {editor.kind === "service" && <><label>Categoría<input name="category" required maxLength={100} defaultValue={service?.category}/></label><div className="form-row"><label>Precio (CLP)<input name="price" type="number" required min={0} step={1} defaultValue={service?.price}/></label><label>Duración (min)<input name="duration" type="number" required min={1} step={1} defaultValue={service?.duration_minutes}/></label></div><label className="check-label"><input type="checkbox" name="active" defaultChecked={service?.active ?? true}/>Disponible para nuevas reservas</label></>}
        {editor.kind === "client" && <><label>Teléfono / WhatsApp<input name="phone" type="tel" maxLength={30} defaultValue={client?.phone ?? ""}/></label><label>Correo<input name="email" type="email" maxLength={200} defaultValue={client?.email ?? ""}/></label><label>Notas y preferencias<textarea name="notes" maxLength={5000} rows={4} defaultValue={client?.notes}/></label></>}
        {editor.kind === "professional" && <><label>Especialidad<input name="specialty" required maxLength={150} defaultValue={professional?.specialty ?? "Servicios de belleza"}/></label><fieldset className="work-days"><legend>Días de atención</legend>{["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map((day, index) => <label className="check-label" key={day}><input type="checkbox" name="days" value={index} defaultChecked={(professional?.work_days ?? [1,2,3,4,5,6]).includes(index)}/>{day}</label>)}</fieldset><div className="form-row"><label>Desde<input name="start" type="time" required defaultValue={professional?.work_start_time.slice(0,5) ?? "09:00"}/></label><label>Hasta<input name="end" type="time" required defaultValue={professional?.work_end_time.slice(0,5) ?? "18:00"}/></label></div><label className="check-label"><input type="checkbox" name="active" defaultChecked={professional?.active ?? true}/>Profesional activa</label></>}
        {message && <p role="alert" className="form-error">{message}</p>}<button className="primary full" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button></form></Modal>}
        {detail && !editor && <Modal title={detail.full_name} onClose={() => setSelectedClient(null)}><p>{detail.phone || "Sin teléfono"} · {detail.email || "Sin correo"}</p><p className="client-notes">{detail.notes || "Sin notas registradas."}</p>{admin && <button className="view-appointment" onClick={() => edit("client", detail.id)}>Editar ficha</button>}<h3>Historial {admin ? "de citas" : "de tus citas"}</h3><div className="client-history">{appointments.filter(a => a.clientId === detail.id).sort((a,b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).map(a => <article key={a.id}><strong>{a.date} · {a.time}</strong><p>{a.service} · {a.duration} min · {a.price == null ? "Valor no registrado" : money(a.price)}</p><span>{a.stylist} · {statuses[a.status] ?? a.status}</span></article>)}{!appointments.some(a => a.clientId === detail.id) && <p className="empty">Aún no hay citas.</p>}</div></Modal>}
        {account && <Modal title="Gestionar acceso" onClose={() => !busy && setAccount(null)}><form onSubmit={saveAccount}><p>{account.email}</p><label>Nombre<input name="name" required defaultValue={account.full_name}/></label><label>Rol<select name="role" defaultValue={account.role}><option value="staff">Trabajadora</option><option value="admin">Administración</option></select></label><label>Profesional vinculada<select name="professional" defaultValue={account.professional_id ?? ""}><option value="">Sin asignar</option>{professionals.map(p => <option key={p.id} value={p.id}>{p.name}{p.active ? "" : " (inactiva)"}</option>)}</select></label><label className="check-label"><input type="checkbox" name="active" defaultChecked={account.active}/>Habilitar acceso</label>{message && <p role="alert" className="form-error">{message}</p>}<button className="primary full" disabled={busy}>{busy ? "Guardando…" : "Guardar acceso"}</button></form></Modal>}
    </>;
}
