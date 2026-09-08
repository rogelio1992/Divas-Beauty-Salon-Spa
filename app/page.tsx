import Image from "next/image";
import heroLogo from "../public/images/logo-divas-hero.png";
import SalonLogo from "./components/salon-logo";
import Link from "next/link";
import {getSupabasePublic} from "../lib/supabase-public";
import {DEFAULT_SALON, SalonPost, SalonSettings, instagramLink, whatsappLink} from "../lib/salon-content";
import styles from "./salon.module.css";
export const dynamic = "force-dynamic";
const money = (value: number) => new Intl.NumberFormat("es-CL", {style: "currency", currency: "CLP", maximumFractionDigits: 0}).format(value);
const booking = (id?: number | null) => id ? `/reservar?serviceId=${id}` : "/reservar";
export default async function Salon() {
    let settings: SalonSettings = DEFAULT_SALON;
    let posts: SalonPost[] = [];
    let services: {id: number; name: string; category: string; duration_minutes: number; price: number}[] = [];
    let team: {id: number; name: string; specialty: string; instagram: string; photo_path: string | null}[] = [];
    const db = getSupabasePublic();
    if (db) {
        const [info, content, catalog, publicTeam] = await Promise.all([
            db.from("salon_settings").select("id,headline,introduction,address,opening_hours,whatsapp,instagram").eq("id",1).maybeSingle(),
            db.from("salon_posts").select("id,kind,title,description,image_path,service_id,published,starts_on,ends_on,sort_order").eq("published",true).order("sort_order").order("created_at", {ascending:false}),
            db.from("services").select("id,name,category,duration_minutes,price").eq("active",true).order("category").order("name"),
            db.rpc("public_team")
        ]);
        if (!info.error && info.data) settings = info.data;
        if (!content.error && content.data) posts = content.data as SalonPost[];
        if (!catalog.error && catalog.data) services = catalog.data;
        if (!publicTeam.error && publicTeam.data) team = publicTeam.data;
    }
    const gallery = posts.filter(p => p.kind === "gallery");
    const promotions = posts.filter(p => p.kind === "promotion");
    const whatsapp = whatsappLink(settings.whatsapp);
    const instagram = instagramLink(settings.instagram);
    const serviceIds = new Set(services.map(s => s.id));
    const postBooking = (post: SalonPost) => booking(post.service_id && serviceIds.has(post.service_id) ? post.service_id : null);
    return <div className={styles.site}>
        <header className={styles.header}><Link href="/" className={styles.brand} aria-label="Divas Beauty Spa, inicio"><SalonLogo/></Link><nav className={styles.nav} aria-label="Navegación del salón"><a href="#servicios">Servicios</a>{gallery.length > 0 && <a href="#trabajos">Nuestros trabajos</a>}{promotions.length > 0 && <a href="#promociones">Promociones</a>}{team.length > 0 && <a href="#equipo">Nuestro equipo</a>}<a href="#contacto">Contacto</a></nav><Link className={styles.button} href="/reservar">Reservar hora ↗</Link></header>
        <main className={styles.main}>
            <section className={styles.hero}><div className={styles.heroCopy}><p className={styles.eyebrow}>BELLEZA · CUIDADO · TU MOMENTO</p><h1>{settings.headline.split(/(Un toque Divas\.)/g).map((part, index) => part === "Un toque Divas." ? <span className={styles.headlineAccent} key={index}>{part}</span> : part)}</h1><p className={styles.intro}>{settings.introduction}</p><div className={styles.actions}><Link className={styles.button} href="/reservar">Quiero reservar <span>↗</span></Link><a className={styles.textLink} href="#servicios">Explorar servicios ↓</a></div><p className={styles.heroNote}>Elige tu servicio y una hora disponible.<br/>Confirmaremos tu cita por WhatsApp.</p></div><div className={styles.art} aria-hidden="true"><Image src={heroLogo} alt="" className={styles.heroLogo} sizes="(max-width: 680px) 260px, (max-width: 1100px) 40vw, 460px" priority/></div></section>
            <div className={styles.ribbon}><span>Uñas</span><span aria-hidden="true">✦</span><span>Pestañas</span><span aria-hidden="true">✦</span><span>Depilación</span><span aria-hidden="true">✦</span><span>Cuidado personal</span></div>
            <section className={styles.section} id="servicios"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>ENCUENTRA TU PRÓXIMO FAVORITO</p><h2>Pequeños detalles.<br/><em>Tu propio estilo.</em></h2></div><p>Conoce nuestros servicios y encuentra un espacio en la agenda para dedicarte tiempo.</p></div>
                <div className={styles.services}>{services.map((s,index) => <article className={styles.service} key={s.id}><span className={styles.serviceNumber}>{String(index+1).padStart(2,"0")}</span><div><p className={styles.category}>{s.category}</p><h3>{s.name}</h3><p>{s.duration_minutes} minutos · {money(s.price)}</p></div><Link href={booking(s.id)} aria-label={`Reservar ${s.name}`} className={styles.roundLink}>↗</Link></article>)}</div>
                {!services.length && <div className={styles.empty}><p>Consulta los servicios y horarios disponibles en nuestra página de reservas.</p><Link className={styles.textLink} href="/reservar">Ver disponibilidad ↗</Link></div>}
            </section>
            {gallery.length > 0 && <section className={`${styles.section} ${styles.gallerySection}`} id="trabajos"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>HECHO EN DIVAS</p><h2>Detalles que<br/><em>hablan por ti.</em></h2></div>{instagram && <a className={styles.textLink} href={instagram} target="_blank" rel="noreferrer">Más en Instagram ↗</a>}</div><div className={styles.gallery}>{gallery.map(post => <article key={post.id}><img src={`/api/salon-media/${post.id}`} alt={post.title} loading="lazy"/><div><h3>{post.title}</h3>{post.description && <p>{post.description}</p>}<Link href={postBooking(post)} className={styles.textLink}>Ver horarios ↗</Link></div></article>)}</div></section>}
            {promotions.length > 0 && <section className={styles.section} id="promociones"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>ALGO ESPECIAL PARA TI</p><h2>Promociones<br/><em>del salón.</em></h2></div><p>Conoce las condiciones de cada oferta y consulta con nuestro equipo.</p></div><div className={styles.promotions}>{promotions.map(post => <article key={post.id} className={styles.promotion}>{post.image_path && <img src={`/api/salon-media/${post.id}`} alt={post.title} loading="lazy"/>}<div><p className={styles.eyebrow}>{post.ends_on ? `HASTA EL ${post.ends_on.split("-").reverse().join("/")}` : "PROMOCIÓN VIGENTE"}</p><h3>{post.title}</h3><p className={styles.description}>{post.description}</p>{whatsapp ? <a className={styles.textLink} href={whatsappLink(settings.whatsapp, `Hola, quisiera consultar las condiciones de la promoción «${post.title}».`) ?? whatsapp} target="_blank" rel="noreferrer">Consultar promoción ↗</a> : <Link className={styles.textLink} href={postBooking(post)}>Ver horarios ↗</Link>}</div></article>)}</div></section>}
            {team.length > 0 && <section className={styles.section} id="equipo">
                <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>LAS PERSONAS DETRÁS DE DIVAS</p><h2>Nuestro <em>equipo.</em></h2></div><p>Conoce a nuestras profesionales y síguelas en sus cuentas personales de Instagram.</p></div>
                <div className={styles.teamGrid}>{team.map(member => {
                    const href = instagramLink(member.instagram);
                    return <article className={styles.teamCard} key={member.id}>
                        {member.photo_path ? <img className={styles.teamPhoto} src={`/api/team-media/${member.id}`} alt={member.name} loading="lazy"/> : <div className={styles.teamInitials} aria-hidden="true">{member.name.trim().split(/\s+/).map(part => part[0]).slice(0,2).join("")}</div>}
                        <h3>{member.name}</h3><p>{member.specialty}</p>
                        {href && <a className={styles.textLink} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Ver Instagram de ${member.name}`}>@{member.instagram.replace(/^@/, "")} · Ver Instagram ↗</a>}
                    </article>;
                })}</div>
            </section>}
            <section className={styles.contact} id="contacto"><div><p className={styles.eyebrow}>TE ESPERAMOS EN DIVAS</p><h2>Haz espacio<br/>para <em>ti.</em></h2><Link className={styles.lightButton} href="/reservar">Reservar mi hora ↗</Link></div><div className={styles.contactDetails}>{settings.address && <div><h3>Dónde encontrarnos</h3><p>{settings.address}</p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`} target="_blank" rel="noreferrer">Cómo llegar ↗</a></div>}{settings.opening_hours && <div><h3>Horarios de atención</h3><p>{settings.opening_hours}</p></div>}<div><h3>Conversemos</h3>{whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer">Escríbenos por WhatsApp ↗</a>}{instagram && <a href={instagram} target="_blank" rel="noreferrer">Encuéntranos en Instagram ↗</a>}{!whatsapp && !instagram && <p>Reserva online y recibe la confirmación de tu cita por WhatsApp.</p>}</div></div></section>
        </main><footer className={styles.footer}><Link href="/" className={styles.brand}><SalonLogo/></Link><p>Un momento para ti.</p><Link href="/admin/login">Acceso del equipo ↗</Link></footer>
    </div>;
}
