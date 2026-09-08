"use client";
import {useEffect, useState} from "react";
import {getSupabaseClient} from "../../lib/supabase";
export default function AppointmentLoyalty({appointmentId}: {appointmentId: number}) {
    const [reward, setReward] = useState<{discount_percent: number; original_price: number; discount_amount: number} | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let active = true;
        setReward(null); setFailed(false);
        const db = getSupabaseClient();
        if (!db) {setFailed(true); return;}
        void db.from("loyalty_cards").select("discount_percent,original_price,discount_amount").eq("redemption_appointment_id", appointmentId).maybeSingle().then(({data,error}) => {
            if (active) {setReward(data); setFailed(Boolean(error));}
        });
        return () => {active = false;};
    }, [appointmentId]);
    const money = (n: number) => new Intl.NumberFormat("es-CL", {style: "currency", currency: "CLP", maximumFractionDigits: 0}).format(n);
    if (failed) return <p className="subtle">No se pudo consultar el descuento de fidelización. Revisa la ficha de la clienta antes de cobrar.</p>;
    return reward ? <p className="notice">Fidelización: {reward.discount_percent}% canjeado ({money(reward.discount_amount)}). <strong>Total con descuento: {money(reward.original_price - reward.discount_amount)}.</strong></p> : null;
}
