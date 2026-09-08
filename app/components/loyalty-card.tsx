import SalonLogo from "./salon-logo";
import type {LoyaltyProgress} from "../../lib/loyalty";

export default function LoyaltyCardView({progress}: {progress: LoyaltyProgress}) {
    const ready = progress.visits >= progress.requiredVisits;
    return <section className="loyalty-card" aria-label="Tarjeta de fidelización Divas">
        <SalonLogo/>
        <p className="eyebrow">TUS MOMENTOS DIVAS</p>
        <h2>{ready ? "Tu beneficio está listo" : "Cada visita tiene su recompensa"}</h2>
        <p className="loyalty-benefit">{progress.discountPercent}% <span>de descuento</span></p>
        <p>Al completar {progress.requiredVisits} {progress.requiredVisits === 1 ? "visita" : "visitas"}, úsalo en una atención posterior.</p>
        <div className="loyalty-stamps" aria-hidden="true">{Array.from({length: progress.requiredVisits}, (_, index) => <span className={index < progress.visits ? "earned" : ""} key={index}>{index < progress.visits ? "✦" : index + 1}</span>)}</div>
        <p role="status"><strong>{progress.visits} de {progress.requiredVisits} visitas</strong>{ready ? " · Solicita tu canje en el salón." : ` · ${progress.requiredVisits - progress.visits} para tu beneficio.`}</p>
        <p className="subtle">Una cita completada = un sello. El canje no suma un sello. Al canjear, comienza una nueva tarjeta.</p>
    </section>;
}
