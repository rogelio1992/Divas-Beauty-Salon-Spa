"use client";
import {useState} from "react";
import {getSupabaseClient} from "../../lib/supabase";
import type {Client} from "./directory";

type Preview = {appointments: number; upcomingAppointments: number; cards: number; stamps: number; redemptions: number};
export default function ClientLifecycle({client, onChanged, onDeleted}: {client: Client; onChanged: () => Promise<void>; onDeleted: () => void}) {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [preview, setPreview] = useState<Preview | null>(null);
    const [confirmation, setConfirmation] = useState("");
    async function archive() {
        if (busy) return;
        if (!window.confirm(client.archived ? `¿Restaurar la ficha de ${client.full_name}? Tendrá un nuevo enlace para su tarjeta.` : `¿Archivar a ${client.full_name}? Se conservarán sus citas y beneficios, pero su tarjeta dejará de ser pública y no se podrán crear nuevas citas con esta ficha. Las citas existentes no se cancelan.`)) return;
        setBusy(true); setMessage("");
        let saved = false;
        try {
            const db = getSupabaseClient(); if (!db) throw new Error();
            const {error} = await db.from("clients").update({archived: !client.archived}).eq("id", client.id).select("id").single();
            if (error) throw error;
            saved = true; await onChanged();
            setMessage(client.archived ? "Clienta restaurada. Comparte su nuevo enlace de tarjeta." : "Clienta archivada. Su historial se conserva.");
        } catch {setMessage(saved ? "El cambio se guardó. Recarga la página para actualizar la ficha." : "No se pudo cambiar el estado. Revisa tu conexión y tus permisos.");}
        finally {setBusy(false);}
    }
    async function review() {
        if (busy) return;
        setBusy(true); setMessage(""); setConfirmation(""); setPreview(null);
        try {
            const db = getSupabaseClient(); if (!db) throw new Error();
            const {data,error} = await db.rpc("client_deletion_preview", {p_client_id: client.id});
            if (error || !data) throw error;
            setPreview(data);
        } catch {setMessage("No se pudo revisar el historial. Comprueba la conexión, los permisos y la migración de clientas.");}
        finally {setBusy(false);}
    }
    async function destroy() {
        if (busy || !preview || confirmation !== client.full_name) return;
        setBusy(true); setMessage("");
        try {
            const db = getSupabaseClient(); if (!db) throw new Error();
            const {error} = await db.rpc("delete_client_completely", {p_client_id: client.id, p_confirmation: confirmation, p_expected: preview});
            if (error) {setMessage(error.code === "P0001" ? error.message : "No se pudo eliminar. Actualiza la ficha para comprobar su estado antes de reintentar."); return;}
            onDeleted(); await onChanged();
        } catch {setMessage("No se pudo confirmar la operación. Recarga la lista antes de reintentar.");}
        finally {setBusy(false);}
    }
    return <section className="client-lifecycle">
        <h3>Administrar ficha</h3>
        <p className="subtle">{client.archived ? "Archivada: se conserva el historial y la tarjeta está deshabilitada." : "Archivar conserva el historial. Eliminar definitivamente borra también todas sus citas y beneficios."}</p>
        <div className="directory-actions"><button className="view-appointment" disabled={busy} onClick={() => void archive()}>{client.archived ? "Restaurar clienta" : "Archivar clienta"}</button><button className="directory-delete" disabled={busy} onClick={() => void review()}>Eliminar definitivamente…</button></div>
        {message && <p className="notice" role="status">{message}</p>}
        {preview && <form className="client-delete-confirm" onSubmit={e => {e.preventDefault(); void destroy();}}>
            <h3>Eliminar a {client.full_name}</h3>
            <p>Se borrarán permanentemente su ficha, datos de contacto, notas y:</p>
            <ul><li>{preview.appointments} citas, incluidas {preview.upcomingAppointments} próximas pendientes o confirmadas.</li><li>{preview.cards} tarjetas de fidelización.</li><li>{preview.stamps} sellos y {preview.redemptions} canjes.</li></ul>
            <p>Sus enlaces y QR dejarán de funcionar. Esta acción no se puede deshacer.</p>
            <label>Escribe «{client.full_name}» para confirmar<input value={confirmation} onChange={e => setConfirmation(e.target.value)} required disabled={busy} autoComplete="off"/></label>
            <div className="directory-actions"><button className="directory-delete" type="submit" disabled={busy || confirmation !== client.full_name}>{busy ? "Eliminando…" : "Eliminar clienta y todo su historial"}</button><button className="view-appointment" type="button" disabled={busy} onClick={() => {setPreview(null); setMessage("");}}>Cancelar</button></div>
        </form>}
    </section>;
}
