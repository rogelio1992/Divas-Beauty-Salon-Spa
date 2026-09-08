import type {Metadata} from "next";
import Link from "next/link";
import {getSupabasePublic} from "../../../lib/supabase-public";
import type {LoyaltyProgress} from "../../../lib/loyalty";
import LoyaltyCardView from "../../components/loyalty-card";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {title: "Tu tarjeta Divas", robots: {index: false, follow: false}, referrer: "no-referrer"};
export default async function PublicCard({params}: {params: {token: string}}) {
    const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.token);
    let progress: LoyaltyProgress | null = null;
    let unavailable = false;
    if (valid) {
        try {
            const db = getSupabasePublic();
            if (!db) throw new Error("Sin conexión");
            const {data, error} = await db.rpc("public_loyalty_card", {p_token: params.token});
            if (error) throw error;
            progress = data;
        } catch { unavailable = true; }
    }
    return <main className="loyalty-page"><div className="loyalty-public">
        {progress ? <><LoyaltyCardView progress={progress}/><p className="subtle">Beneficios canjeados: {progress.rewardsRedeemed}. Las condiciones de esta tarjeta se mantienen hasta su canje. Los cambios del programa se aplican a la siguiente.</p><Link className="primary loyalty-book" href="/reservar">Reservar mi próxima visita</Link><p className="subtle">Guarda este enlace para consultar tu tarjeta. Recarga la página después de tu atención para ver los nuevos sellos.</p></> : <section className="loyalty-card"><h1>{unavailable ? "No pudimos cargar tu tarjeta" : "Tarjeta no disponible"}</h1><p>{unavailable ? "Intenta recargar la página en unos momentos." : "Pide al salón que te comparta tu enlace actualizado."}</p></section>}
        <Link className="text-button" href="/">Volver a Divas Beauty Spa</Link>
    </div></main>;
}
