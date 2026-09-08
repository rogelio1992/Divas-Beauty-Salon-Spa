"use client";
import {FormEvent, useEffect, useRef, useState} from "react";
import {getSupabaseClient} from "../../lib/supabase";
import {DEFAULT_SALON, SalonPost, SalonSettings, instagramLink, whatsappLink} from "../../lib/salon-content";
import {Modal} from "./directory";
const types = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"};
export default function SalonContent() {
    const [settings, setSettings] = useState<SalonSettings>(DEFAULT_SALON);
    const [posts, setPosts] = useState<SalonPost[]>([]);
    const [services, setServices] = useState<{id: number; name: string}[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const saving = useRef(false);
    const [editor, setEditor] = useState<{post: SalonPost; isNew: boolean} | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState("");
    async function load() {
        const db = getSupabaseClient(); if (!db) {setMessage("No se pudo conectar."); return;}
        const [info, content, catalog] = await Promise.all([
            db.from("salon_settings").select("id,headline,introduction,address,opening_hours,whatsapp,instagram").eq("id", 1).single(),
            db.from("salon_posts").select("id,kind,title,description,image_path,service_id,published,starts_on,ends_on,sort_order").order("sort_order").order("created_at", {ascending: false}),
            db.from("services").select("id,name").eq("active", true).order("name")
        ]);
        if (info.error || content.error || catalog.error) {setMessage("No se pudo cargar el contenido. Comprueba que la migración del sitio público esté aplicada y que tu acceso siga habilitado."); return;}
        setSettings(info.data); setPosts(content.data as SalonPost[]); setServices(catalog.data); setLoaded(true);
    }
    useEffect(() => {void load();}, []);
    useEffect(() => {
        let active = true;
        if (file) {
            const url = URL.createObjectURL(file); setPreview(url);
            return () => URL.revokeObjectURL(url);
        }
        setPreview("");
        if (editor?.post.image_path) void getSupabaseClient()?.storage.from("salon-media").createSignedUrl(editor.post.image_path, 600).then(result => {if (active && result.data) setPreview(result.data.signedUrl);});
        return () => {active = false;};
    }, [file, editor?.post.image_path]);
    function open(post?: SalonPost, kind: SalonPost["kind"] = "gallery") {
        setFile(null); setMessage("");
        setEditor({isNew: !post, post: post ?? {id: crypto.randomUUID(), kind, title: "", description: "", image_path: null, service_id: null, published: false, starts_on: null, ends_on: null, sort_order: 0}});
    }
    async function saveSettings(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (saving.current) return;
        const form = new FormData(event.currentTarget);
        const value = (key: string) => String(form.get(key) ?? "").trim();
        if ((value("whatsapp") && !whatsappLink(value("whatsapp"))) || (value("instagram") && !instagramLink(value("instagram")))) {setMessage("Revisa el número de WhatsApp y el usuario de Instagram (sin URL)."); return;}
        saving.current = true; setBusy(true); setMessage("");
        try {
            const result = await getSupabaseClient()?.from("salon_settings").update({headline: value("headline"), introduction: value("introduction"), address: value("address"), opening_hours: value("opening_hours"), whatsapp: value("whatsapp"), instagram: value("instagram")}).eq("id",1).select("id").single();
            if (!result || result.error) throw new Error("No se pudieron guardar los datos del salón.");
            await load(); setMessage("Datos del salón actualizados.");
        } catch(error) {setMessage(error instanceof Error ? error.message : "No se pudo conectar.");}
        finally {saving.current = false; setBusy(false);}
    }
    async function savePost(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (!editor || saving.current) return;
        const db = getSupabaseClient(); if (!db) return;
        const form = new FormData(event.currentTarget);
        const value = (key: string) => String(form.get(key) ?? "").trim();
        if (value("starts_on") && value("ends_on") && value("starts_on") > value("ends_on")) {setMessage("La fecha de término debe ser posterior o igual al inicio."); return;}
        if (editor.post.kind === "gallery" && !file && !editor.post.image_path) {setMessage("Selecciona una foto del trabajo."); return;}
        saving.current = true; setBusy(true); setMessage("");
        let uploaded: string | null = null;
        try {
            if (file) {
                const extension = types[file.type as keyof typeof types];
                if (!extension || file.size > 8388608) throw new Error("Usa una foto JPG, PNG o WebP de hasta 8 MB.");
                uploaded = `${editor.post.id}/${crypto.randomUUID()}.${extension}`;
                const upload = await db.storage.from("salon-media").upload(uploaded, file, {contentType: file.type, upsert: false});
                if (upload.error) throw new Error("No se pudo subir la imagen. Revisa el formato, tamaño y conexión.");
            }
            const values = {id: editor.post.id, kind: editor.post.kind, title: value("title"), description: value("description"), image_path: uploaded ?? editor.post.image_path, service_id: Number(value("service_id")) || null, published: form.has("published"), starts_on: editor.post.kind === "promotion" ? value("starts_on") || null : null, ends_on: editor.post.kind === "promotion" ? value("ends_on") || null : null, sort_order: Number(value("sort_order"))};
            const result = editor.isNew ? await db.from("salon_posts").insert(values).select("id").single() : await db.from("salon_posts").update(values).eq("id",editor.post.id).select("id").single();
            if (result.error) throw new Error("No se pudo guardar la publicación. Revisa los datos y tus permisos.");
            // Keep older assets private instead of deleting a file that might still be in use.
            uploaded = null;
            setEditor(null); setFile(null); await load(); setMessage(values.published ? "Contenido guardado. Se mostrará durante su vigencia." : "Borrador guardado. Solo administración puede verlo.");
        } catch(error) {
            if (uploaded) await db.storage.from("salon-media").remove([uploaded]);
            setMessage(error instanceof Error ? error.message : "No se pudo guardar el contenido.");
        } finally {saving.current = false; setBusy(false);}
    }
    async function remove(post: SalonPost) {
        if (saving.current || !window.confirm(`¿Eliminar «${post.title}» de forma permanente?`)) return;
        saving.current = true; setBusy(true); setMessage("");
        try {
            const result = await getSupabaseClient()?.from("salon_posts").delete().eq("id", post.id).select("id").single();
            if (!result || result.error) throw new Error("No se pudo eliminar la publicación.");
            await load(); setMessage("Publicación eliminada.");
        } catch(error) {setMessage(error instanceof Error ? error.message : "No se pudo conectar.");}
        finally {saving.current = false; setBusy(false);}
    }
    const today = new Date().toLocaleDateString("en-CA", {timeZone: "America/Santiago"});
    const status = (p: SalonPost) => !p.published ? "Borrador" : p.kind === "promotion" && p.starts_on && p.starts_on > today ? "Programada" : p.kind === "promotion" && p.ends_on && p.ends_on < today ? "Finalizada" : "Publicada";
    return <>
        <header><div><p className="eyebrow">DIVAS BEAUTY SPA</p><h1>Contenido del salón</h1><p className="subtle">Fotos, promociones y datos que ven tus clientas.</p></div><a className="whatsapp" href="/" target="_blank" rel="noreferrer">Ver portada ↗</a></header>
        {message && !editor && <p className="notice" role="status">{message}</p>}
        {!loaded ? <button className="primary" onClick={load}>Cargar contenido</button> : <>
        <section className="directory-card salon-editor"><h2>Datos de la portada</h2><form onSubmit={saveSettings}>
            <label>Frase principal<input name="headline" required maxLength={150} defaultValue={settings.headline}/></label>
            <label>Presentación<textarea name="introduction" rows={3} maxLength={1000} defaultValue={settings.introduction}/></label>
            <div className="form-row"><label>WhatsApp del salón<input name="whatsapp" type="tel" placeholder="+56 9 …" maxLength={30} defaultValue={settings.whatsapp}/></label><label>Usuario de Instagram<input name="instagram" placeholder="@usuario" maxLength={31} defaultValue={settings.instagram}/></label></div>
            <label>Dirección<input name="address" maxLength={300} defaultValue={settings.address}/></label><label>Horarios de atención<textarea name="opening_hours" rows={2} maxLength={500} defaultValue={settings.opening_hours}/></label>
            <button className="primary full" disabled={busy}>{busy ? "Guardando…" : "Guardar datos públicos"}</button>
        </form></section>
        <section className="directory-card salon-editor"><div className="salon-editor-heading"><h2>Fotos y promociones</h2><div className="header-actions"><button className="primary" disabled={busy} onClick={() => open(undefined,"gallery")}>＋ Foto de trabajo</button><button className="reminders-button" disabled={busy} onClick={() => open(undefined,"promotion")}>＋ Promoción</button></div></div>
        <p className="subtle">Las promociones comunican ofertas y condiciones; no cambian automáticamente los precios de la agenda.</p>
        {posts.map(post => <article key={post.id} className="directory-row"><div><strong>{post.title}</strong><span>{post.kind === "gallery" ? "Galería" : "Promoción"} · {status(post)} · Orden {post.sort_order}</span></div><button className="view-appointment" disabled={busy} onClick={() => open(post)}>Editar</button><button className="view-appointment" disabled={busy} onClick={() => remove(post)}>Eliminar</button></article>)}
        {!posts.length && <p className="empty">Agrega tus primeras fotos o una promoción. Puedes guardarlas como borrador antes de publicar.</p>}</section></>}
        {editor && <Modal title={editor.post.kind === "gallery" ? "Foto de trabajo" : "Promoción"} onClose={() => !busy && setEditor(null)}><form onSubmit={savePost}>
            <label>Título<input name="title" required maxLength={150} defaultValue={editor.post.title}/></label>
            <label>{editor.post.kind === "gallery" ? "Descripción del trabajo" : "Descripción y condiciones de la oferta"}<textarea name="description" rows={3} maxLength={3000} defaultValue={editor.post.description}/></label>
            <label>Foto {editor.post.kind === "promotion" ? "(opcional)" : ""}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)}/></label><p className="subtle">JPG, PNG o WebP · Hasta 8 MB. Publica fotos que tengas autorización para mostrar.</p>
            {preview && <img className="salon-image-preview" src={preview} alt="Vista previa de la foto seleccionada"/>}
            <label>Servicio relacionado<select name="service_id" defaultValue={editor.post.service_id ?? ""}><option value="">Sin servicio específico</option>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            {editor.post.kind === "promotion" && <div className="form-row"><label>Desde (opcional)<input name="starts_on" type="date" defaultValue={editor.post.starts_on ?? ""}/></label><label>Hasta (opcional)<input name="ends_on" type="date" defaultValue={editor.post.ends_on ?? ""}/></label></div>}
            <label>Orden en la portada<input name="sort_order" type="number" step={1} min={-10000} max={10000} required defaultValue={editor.post.sort_order}/></label>
            <label className="check-label"><input name="published" type="checkbox" defaultChecked={editor.post.published}/>Publicar en la página del salón</label>
            {message && <p className="form-error" role="alert">{message}</p>}<button className="primary full" disabled={busy}>{busy ? "Guardando…" : "Guardar contenido"}</button>
        </form></Modal>}
    </>;
}
