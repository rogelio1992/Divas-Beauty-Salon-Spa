"use client";
import {useEffect, useRef, useState} from "react";
import QRCode from "qrcode";
import {getSupabaseClient} from "../../lib/supabase";
import {whatsappLink} from "../../lib/salon-content";
import type {LoyaltyCard, LoyaltyVisit} from "../../lib/loyalty";
import LoyaltyCardView from "./loyalty-card";

const money = (n: number) => new Intl.NumberFormat("es-CL", {style: "currency", currency: "CLP", maximumFractionDigits: 0}).format(n);
type Candidate = {id: number; service_name: string; service_price: number; starts_at: string; duration_minutes: number};
export default function ClientLoyalty({clientId, phone}: {clientId: number; phone: string | null}) {
    const [token, setToken] = useState<string | null>(null);
    const [cards, setCards] = useState<LoyaltyCard[]>([]);
    const [visits, setVisits] = useState<LoyaltyVisit[]>([]);
    const [appointments, setAppointments] = useState<Candidate[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [link, setLink] = useState("");
    const [qr, setQr] = useState("");
    const [selected, setSelected] = useState("");
    const locked = useRef(false);
    async function load() {
        const db = getSupabaseClient();
        if (!db) throw new Error("No se pudo conectar.");
        const [member, cycles, stamps, completed] = await Promise.all([
            db.from("loyalty_members").select("token").eq("client_id", clientId).maybeSingle(),
            db.from("loyalty_cards").select("id,required_visits,discount_percent,created_at,redeemed_at,redemption_appointment_id,original_price,discount_amount").eq("client_id", clientId).order("created_at", {ascending: false}),
            db.from("loyalty_visits").select("appointment_id,card_id,earned_at,loyalty_cards!inner(client_id)").eq("loyalty_cards.client_id", clientId),
            db.from("appointments").select("id,service_name,service_price,starts_at,duration_minutes").eq("client_id", clientId).eq("status", "completed").order("starts_at", {ascending: false})
        ]);
        if (member.error || cycles.error || stamps.error || completed.error) throw new Error("No se pudo cargar la tarjeta. Revisa la conexión, tus permisos y la migración de fidelización.");
        setToken(member.data?.token ?? null); setCards(cycles.data); setVisits(stamps.data); setAppointments(completed.data); setLoaded(true); setSelected("");
    }
    async function run(action: () => Promise<void>) {
        if (locked.current) return;
        locked.current = true; setBusy(true); setMessage("");
        try { await action(); }
        catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo completar la operación."); }
        finally { locked.current = false; setBusy(false); }
    }
    useEffect(() => {void run(load);}, [clientId]);
    useEffect(() => {
        let active = true;
        setLink(""); setQr("");
        if (token) {
            const url = `${window.location.origin}/tarjeta/${token}`;
            setLink(url);
            void QRCode.toDataURL(url, {width: 256, margin: 4, errorCorrectionLevel: "M"}).then(value => {if (active) setQr(value);}).catch(() => {if (active) setMessage("No se pudo generar el QR. Puedes usar el enlace.");});
        }
        return () => {active = false;};
    }, [token]);
    const card = cards.find(c => !c.redeemed_at);
    const earned = visits.filter(v => v.card_id === card?.id);
    const lastEnd = Math.max(0, ...earned.map(v => {const a = appointments.find(a => a.id === v.appointment_id); return a ? Date.parse(a.starts_at) + a.duration_minutes * 60000 : Infinity;}));
    const candidates = appointments.filter(a => a.service_price != null && Date.parse(a.starts_at) >= lastEnd && Date.parse(a.starts_at) <= Date.now() && !visits.some(v => v.appointment_id === a.id) && !cards.some(c => c.redemption_appointment_id === a.id));
    const choice = candidates.find(a => a.id === Number(selected));
    const ready = card && earned.length >= card.required_visits;
    async function rpc(name: string, args: Record<string, unknown>) {
        const db = getSupabaseClient(); if (!db) throw new Error("No se pudo conectar.");
        const {error} = await db.rpc(name, args);
        if (error) throw new Error(error.code === "P0001" ? error.message : "No se pudo guardar. Actualiza la tarjeta antes de reintentar.");
        await load();
    }
    const whatsapp = phone && link ? whatsappLink(phone, `Tu tarjeta de fidelización de Divas Beauty Spa: ${link}\nGuarda este enlace para consultar tus visitas y beneficios.`) : null;
    return <section className="client-loyalty">
        <h3>Tarjeta de fidelización</h3>
        {message && <p className="notice" role="status">{message}</p>}
        {!loaded ? <button className="view-appointment" disabled={busy} onClick={() => void run(load)}>{busy ? "Cargando…" : "Reintentar"}</button> : !card ? <>
            <p className="subtle">Emite la tarjeta antes de marcar la cita como completada. Las citas ya completadas no se agregan automáticamente.</p>
            <button className="primary" disabled={busy} onClick={() => void run(() => rpc("enroll_loyalty", {p_client_id: clientId}))}>Emitir tarjeta digital</button>
        </> : <>
            <LoyaltyCardView progress={{requiredVisits: card.required_visits, discountPercent: card.discount_percent, visits: earned.length, rewardsRedeemed: cards.filter(c => c.redeemed_at).length}}/>
            <div className="loyalty-share">{qr && <img src={qr} width={180} height={180} alt="QR para abrir la tarjeta digital"/>}
                <div><p className="subtle">El enlace permite ver el progreso. Compártelo solo con la clienta.</p>
                    <div className="loyalty-actions"><a className="view-appointment" href={link} target="_blank" rel="noreferrer">Abrir tarjeta</a>
                    <button className="view-appointment" disabled={busy || !link} onClick={() => void run(async () => {await navigator.clipboard.writeText(link); setMessage("Enlace copiado.");})}>Copiar enlace</button>
                    {whatsapp && <a className="view-appointment" href={whatsapp} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>}</div>
                    <button className="text-button" disabled={busy} onClick={() => {if (window.confirm("¿Invalidar el enlace y QR anteriores? Deberás compartir el nuevo enlace con la clienta.")) void run(() => rpc("rotate_loyalty_link", {p_client_id: clientId}));}}>Renovar enlace privado</button>
                </div>
            </div>
            <button className="view-appointment" disabled={busy} onClick={() => void run(load)}>Actualizar tarjeta</button>
            {ready && <form className="loyalty-redeem" onSubmit={e => {e.preventDefault(); if (!choice || !card) return; if (window.confirm(`¿Canjear ${card.discount_percent}% en ${choice.service_name}? Total con descuento: ${money(choice.service_price - Math.round(choice.service_price * card.discount_percent / 100))}. El canje quedará registrado.`)) void run(async () => {await rpc("redeem_loyalty", {p_card_id: card.id, p_appointment_id: choice.id}); setMessage("Descuento canjeado. Se emitió la siguiente tarjeta.");});}}>
                <h3>Canjear beneficio</h3><p className="subtle">Selecciona una cita posterior ya completada. El descuento se registra sobre su precio guardado; el cobro se realiza en el salón. Mientras el beneficio esté pendiente, no se acumulan nuevos sellos.</p>
                <label>Cita para el descuento<select required value={selected} disabled={busy} onChange={e => setSelected(e.target.value)}><option value="">Seleccionar cita</option>{candidates.map(a => <option key={a.id} value={a.id}>{new Date(a.starts_at).toLocaleString("es-CL", {timeZone: "America/Santiago"})} · {a.service_name} · {money(a.service_price)}</option>)}</select></label>
                {!candidates.length && <p className="subtle">Todavía no hay una cita posterior completada para canjear.</p>}
                {choice && <p>Total con descuento: <strong>{money(choice.service_price - Math.round(choice.service_price * card.discount_percent / 100))}</strong></p>}
                <button className="primary" disabled={busy || !choice}>Registrar canje del {card.discount_percent}%</button>
            </form>}
            {earned.length > 0 && <details><summary>Historial de sellos</summary>{earned.map(v => <p key={v.appointment_id}>Cita #{v.appointment_id} · Sello registrado el {new Date(v.earned_at).toLocaleDateString("es-CL", {timeZone: "America/Santiago"})}</p>)}</details>}
        </>}
        {cards.some(c => c.redeemed_at) && <details><summary>Historial de canjes</summary>{cards.filter(c => c.redeemed_at).map(c => <article className="loyalty-history" key={c.id}><strong>{new Date(c.redeemed_at!).toLocaleDateString("es-CL", {timeZone: "America/Santiago"})} · {c.discount_percent}% · Cita #{c.redemption_appointment_id}</strong><p>Precio: {money(c.original_price!)} · Descuento: {money(c.discount_amount!)} · Total: {money(c.original_price! - c.discount_amount!)}</p></article>)}</details>}
    </section>;
}
