export type SalonSettings = {id: number; headline: string; introduction: string; address: string; opening_hours: string; whatsapp: string; instagram: string};
export type SalonPost = {id: string; kind: "gallery" | "promotion"; title: string; description: string; image_path: string | null; service_id: number | null; published: boolean; starts_on: string | null; ends_on: string | null; sort_order: number};
export const DEFAULT_SALON: SalonSettings = {id: 1, headline: "Un momento para ti. Un toque Divas.", introduction: "Uñas, pestañas y cuidado personal. Encuentra tu próximo servicio y reserva el momento que mereces.", address: "", opening_hours: "", whatsapp: "", instagram: ""};
export function whatsappLink(value: string, message = "Hola, quisiera información sobre Divas Beauty Spa.") {
    let phone = value.replace(/\D/g, "");
    if (phone.length === 9 && phone.startsWith("9")) phone = `56${phone}`;
    return /^\d{10,15}$/.test(phone) ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;
}
export function instagramLink(value: string) {
    const handle = value.trim().replace(/^@/, "");
    return /^[a-zA-Z0-9._]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : null;
}
