import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

const opening = 9 * 60;
const closing = 18 * 60;
const professionals = ["Sofía", "Valentina", "Daniela"];
const toMinutes = (time: string) => { const [hours, minutes] = time.split(":").map(Number); return hours * 60 + minutes; };
const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: services, error } = await supabase.from("services").select("id,name,category,duration_minutes,price").eq("active", true).order("name");
    if (error) throw error;
    const date = request.nextUrl.searchParams.get("date");
    const serviceId = Number(request.nextUrl.searchParams.get("serviceId"));
    const professional = request.nextUrl.searchParams.get("professional");
    if (!date || !serviceId || !professional) return NextResponse.json({ services, professionals });
    const service = services?.find((item) => item.id === serviceId);
    if (!service || !professionals.includes(professional)) return NextResponse.json({ error: "Datos de reserva inválidos" }, { status: 400 });
    const start = `${date}T00:00:00-03:00`, end = `${date}T23:59:59-03:00`;
    const { data: appointments, error: appointmentError } = await supabase.from("appointments").select("starts_at,duration_minutes,status").eq("professional_name", professional).gte("starts_at", start).lte("starts_at", end).neq("status", "cancelled");
    if (appointmentError) throw appointmentError;
    const slots = Array.from({ length: (closing - opening) / 30 }, (_, index) => opening + index * 30).filter((slot) => slot + service.duration_minutes <= closing && !(appointments ?? []).some((appointment) => { const begins = toMinutes(new Date(appointment.starts_at).toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false })); const finishes = begins + appointment.duration_minutes; return slot < finishes && slot + service.duration_minutes > begins; })).map(toTime);
    return NextResponse.json({ services, professionals, slots });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo consultar disponibilidad" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.website || !body.clientName?.trim() || !body.phone?.trim() || !body.date || !/^\d{2}:\d{2}$/.test(body.time) || !professionals.includes(body.professional)) return NextResponse.json({ error: "Completa los datos requeridos." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data: service, error: serviceError } = await supabase.from("services").select("id,duration_minutes").eq("id", body.serviceId).eq("active", true).single();
    if (serviceError || !service) return NextResponse.json({ error: "Servicio no disponible." }, { status: 400 });
    const start = `${body.date}T00:00:00-03:00`, end = `${body.date}T23:59:59-03:00`;
    const { data: existing, error: existingError } = await supabase.from("appointments").select("starts_at,duration_minutes").eq("professional_name", body.professional).gte("starts_at", start).lte("starts_at", end).neq("status", "cancelled");
    if (existingError) throw existingError;
    const requested = toMinutes(body.time), conflict = (existing ?? []).some((appointment) => { const begins = toMinutes(new Date(appointment.starts_at).toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false })); return requested < begins + appointment.duration_minutes && requested + service.duration_minutes > begins; });
    if (conflict) return NextResponse.json({ error: "Ese horario acaba de ser reservado. Elige otro." }, { status: 409 });
    const { error } = await supabase.from("appointments").insert({ client_name: body.clientName.trim(), client_phone: body.phone.trim(), service_id: service.id, professional_name: body.professional, starts_at: `${body.date}T${body.time}:00-03:00`, duration_minutes: service.duration_minutes, status: "pending" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la reserva." }, { status: 500 }); }
}
