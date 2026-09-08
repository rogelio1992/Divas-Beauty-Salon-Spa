"use client";
import SalonLogo from "../components/salon-logo";
import {FormEvent, useEffect, useRef, useState} from "react";

type Service = { id: number; name: string; category: string; duration_minutes: number; price: number };
const today = () => new Date().toLocaleDateString("en-CA", {timeZone: "America/Santiago"});
export default function Reserve() {
    const [services, setServices] = useState<Service[]>([]), [professionals, setProfessionals] = useState<string[]>([]), [date, setDate] = useState(today()), [serviceId, setServiceId] = useState(""), [professional, setProfessional] = useState(""), [slots, setSlots] = useState<string[]>([]), [message, setMessage] = useState(""), [loading, setLoading] = useState(false);
    const [selectedTime, setSelectedTime] = useState("");
    const [refresh, setRefresh] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const saving = useRef(false);
    useEffect(() => {
        fetch("/api/public-booking").then(r => r.json()).then(data => {
            setServices(data.services ?? []);
            const requested = new URLSearchParams(window.location.search).get("serviceId");
            if (requested && (data.services ?? []).some((s: Service) => String(s.id) === requested)) setServiceId(requested);
            setProfessionals(data.professionals ?? []);
        }).catch(() => setMessage("No se pudieron cargar los servicios."));
    }, []);
    useEffect(() => {
        if (!serviceId || !professional) {
            setSelectedTime("");
            setLoading(false);
            setSlots([]);
            return;
        }
        const controller = new AbortController();
        setSelectedTime("");
        setSlots([]);
        setLoading(true);
        fetch(`/api/public-booking?date=${date}&serviceId=${serviceId}&professional=${encodeURIComponent(professional)}`, {signal: controller.signal}).then(async r => {
            if (!r.ok) throw new Error("No se pudieron cargar los horarios.");
            return r.json();
        }).then(data => { if (!controller.signal.aborted) setSlots(data.slots ?? []); })
          .catch(() => { if (!controller.signal.aborted) setMessage("No se pudieron cargar los horarios. Intenta nuevamente."); })
          .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [date, serviceId, professional, refresh]);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving.current) return;
        const form = event.currentTarget;
        const data = Object.fromEntries(new FormData(form));
        saving.current = true;
        setSubmitting(true);
        try {
            const response = await fetch("/api/public-booking", {
                method: "POST", headers: {"Content-Type": "application/json"},
                body: JSON.stringify({...data, serviceId: Number(serviceId), date, professional})
            });
            const result = await response.json();
            setMessage(response.ok && result.ok ? "¡Solicitud recibida! Divas Beauty Spa confirmará tu hora por WhatsApp." : result.error || "No se pudo crear la reserva.");
            if (response.ok && result.ok) form.reset();
            if (response.status === 409 || (response.ok && result.ok)) {
                setSelectedTime(""); setSlots([]); setRefresh(value => value + 1);
            }
        } catch { setMessage("No se pudo conectar. Comprueba si recibimos tu reserva antes de volver a enviarla."); }
        finally { saving.current = false; setSubmitting(false); }
    }

    return <main className="booking-page">
        <section className="booking-card">
            <div className="brand"><SalonLogo/></div>
            <a className="text-button" href="/">← Volver al salón</a><p className="eyebrow">RESERVA ONLINE · SANTIAGO</p><h1>Reserva tu momento Divas</h1><p
            className="subtle">Elige tu servicio y horario. Confirmaremos tu cita por WhatsApp.</p>
            <form onSubmit={submit}><label>Nombre completo<input required name="clientName"
                                                                 placeholder="¿Cómo te llamas?"/></label><label>WhatsApp<input
                required name="phone" type="tel" placeholder="+56 9 ..."/></label><label>Servicio<select required
                                                                                                         value={serviceId}
                                                                                                         onChange={e => setServiceId(e.target.value)}>
                <option value="">Selecciona un servicio</option>
                {services.map(service => <option key={service.id}
                                                 value={service.id}>{service.name} · {service.duration_minutes} min</option>)}
            </select></label>
                <div className="form-row"><label>Fecha<input required type="date" min={today()} value={date}
                                                             onChange={e => setDate(e.target.value)}/></label><label>Profesional<select
                    required value={professional} onChange={e => setProfessional(e.target.value)}>
                    <option value="">Selecciona</option>
                    {professionals.map(name => <option key={name}>{name}</option>)}</select></label></div>
                <label>Hora disponible<select required name="time" value={selectedTime} onChange={e => setSelectedTime(e.target.value)} disabled={loading || !slots.length || submitting}>
                    <option value="">{loading ? "Buscando horarios…" : "Selecciona una hora"}</option>
                    {slots.map(slot => <option key={slot}>{slot}</option>)}</select></label><input className="honeypot"
                                                                                                   name="website"
                                                                                                   tabIndex={-1}
                                                                                                   autoComplete="off"/>
                <button className="primary full" disabled={submitting || loading || !selectedTime || !slots.length}>{submitting ? "Enviando…" : "Solicitar reserva"}</button>
                {message && <p className="booking-message">{message}</p>}</form>
        </section>
    </main>;
}
