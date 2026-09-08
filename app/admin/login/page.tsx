"use client";
import SalonLogo from "../../components/salon-logo";
import {FormEvent, useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseClient} from "../../../lib/supabase";

export default function Auth() {
    const router = useRouter();
    useEffect(() => {
        const db = getSupabaseClient();
        if (!db) return;
        db.auth.getUser().then(({data}) => { if (data.user) router.replace("/admin"); });
        const {data} = db.auth.onAuthStateChange((_event, session) => { if (session?.user) router.replace("/admin"); });
        return () => data.subscription.unsubscribe();
    }, [router]);
    const [requestAccess, setRequestAccess] = useState(false);
    const [busy, setBusy] = useState(false);
    const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [message, setMessage] = useState("");

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const supabase = getSupabaseClient();
        if (!supabase) {
            setMessage("Faltan las variables de Supabase en Vercel.");
            return;
        }
        if (busy) return;
        setBusy(true);
        try {
            const {error} = requestAccess ? await supabase.auth.signUp({email, password, options: {emailRedirectTo: `${window.location.origin}/admin/login`}}) : await supabase.auth.signInWithPassword({email, password});
            setMessage(error ? "No se pudo completar. Revisa el correo y la contraseña e intenta nuevamente." : requestAccess ? "Revisa tu correo para confirmar la cuenta. Administración debe habilitar tu acceso." : "Sesión iniciada.");
        } catch { setMessage("No se pudo conectar. Inténtalo nuevamente."); } finally { setBusy(false); }
    }

    return <main className="auth-page">
        <form className="auth-card" onSubmit={submit}>
            <div className="brand"><SalonLogo/></div>
            <a className="text-button" href="/">← Volver al salón</a><h1>{requestAccess ? "Solicitar acceso" : "Agenda del salón"}</h1><p>{requestAccess ? "Crea tu cuenta y solicita a administración que la habilite." : "Ingresa con tu cuenta para ver las citas."}</p><label>Correo<input type="email"
                                                                                                         required
                                                                                                         value={email}
                                                                                                         onChange={e => setEmail(e.target.value)}/></label><label>Contraseña<input
            type="password" required minLength={6} value={password}
            onChange={e => setPassword(e.target.value)}/></label>{message && <p className="auth-message">{message}</p>}
            <button className="primary full" disabled={busy}>{busy ? "Procesando…" : requestAccess ? "Solicitar acceso" : "Iniciar sesión"}</button>
            <button className="text-button" type="button" onClick={() => {setRequestAccess(!requestAccess); setMessage("");}}>{requestAccess ? "Ya tengo cuenta" : "Solicitar acceso al equipo"}</button>
        </form>
    </main>;
}

