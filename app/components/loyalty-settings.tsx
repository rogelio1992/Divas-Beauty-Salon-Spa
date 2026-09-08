"use client";

import {FormEvent, useEffect, useRef, useState} from "react";
import {getSupabaseClient} from "../../lib/supabase";

export default function LoyaltySettings() {
    const [visits, setVisits] = useState("");
    const [discount, setDiscount] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const saving = useRef(false);

    async function load() {
        setBusy(true);
        setMessage("");
        try {
            const db = getSupabaseClient();
            if (!db) throw new Error("No se pudo conectar.");
            const {data, error} = await db.from("loyalty_settings")
                .select("required_visits,discount_percent").eq("id", 1).single();
            if (error) throw new Error("No se pudo cargar la configuración. Comprueba que la migración de fidelización esté aplicada y tu acceso de administración siga habilitado.");
            setVisits(data.required_visits == null ? "" : String(data.required_visits));
            setDiscount(data.discount_percent == null ? "" : String(data.discount_percent));
            setLoaded(true);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "No se pudo conectar.");
        } finally { setBusy(false); }
    }

    useEffect(() => { void load(); }, []);

    const requiredVisits = Number(visits);
    const discountPercent = Number(discount);
    const valid = [requiredVisits, discountPercent].every(value => Number.isInteger(value) && value >= 1 && value <= 100);

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving.current) return;
        if (!valid) { setMessage("Ingresa visitas y descuento como números enteros entre 1 y 100."); return; }
        saving.current = true;
        setBusy(true);
        setMessage("");
        try {
            const db = getSupabaseClient();
            if (!db) throw new Error("No se pudo conectar.");
            const {data, error} = await db.from("loyalty_settings")
                .update({required_visits: requiredVisits, discount_percent: discountPercent})
                .eq("id", 1).select("required_visits,discount_percent").single();
            if (error) throw new Error("No se pudo guardar la configuración. Revisa tu conexión y tus permisos.");
            setVisits(String(data.required_visits));
            setDiscount(String(data.discount_percent));
            setMessage("Configuración de fidelización guardada.");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
        } finally { saving.current = false; setBusy(false); }
    }

    return <>
        <header><div><p className="eyebrow">DIVAS BEAUTY SPA</p><h1>Fidelización</h1><p className="subtle">Define el beneficio de la tarjeta de tus clientas.</p></div></header>
        {message && <p className="notice" role="status">{message}</p>}
        {!loaded ? <button className="primary" disabled={busy} onClick={() => void load()}>{busy ? "Cargando…" : "Reintentar"}</button> :
            <section className="directory-card salon-editor">
                <h2>Visitas y descuento</h2>
                <p className="subtle">Las nuevas tarjetas usarán estas condiciones. Las tarjetas en curso conservan sus visitas y descuento hasta el canje. Emite y consulta cada tarjeta desde Clientas → Ver ficha.</p>
                <form onSubmit={save}>
                    <div className="form-row">
                        <label>Visitas necesarias<input type="number" inputMode="numeric" required min={1} max={100} step={1} value={visits} disabled={busy} onChange={e => {setVisits(e.target.value); setMessage("");}}/></label>
                        <label>Descuento (%)<input type="number" inputMode="numeric" required min={1} max={100} step={1} value={discount} disabled={busy} onChange={e => {setDiscount(e.target.value); setMessage("");}}/></label>
                    </div>
                    {valid && <p className="notice">Al completar {requiredVisits} {requiredVisits === 1 ? "visita" : "visitas"}, la clienta obtiene un {discountPercent}% de descuento.</p>}
                    <button className="primary full" disabled={busy}>{busy ? "Guardando…" : "Guardar configuración"}</button>
                </form>
            </section>}
    </>;
}
