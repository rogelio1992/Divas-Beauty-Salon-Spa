import {NextRequest, NextResponse} from "next/server";
import {getSupabaseAdmin} from "../../../lib/supabase-admin";
import {santiagoDayEnd, santiagoDayStart, santiagoInstant} from "../../../lib/santiago-time";

const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};
const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();
        const {
            data: services,
            error
        } = await supabase.from("services").select("id,name,category,duration_minutes,price").eq("active", true).order("name");
        if (error) throw error;
        const {data: professionalRows, error: professionalError} = await supabase.from("professionals").select("name,work_days,work_start_time,work_end_time").eq("active", true).order("name");
        if (professionalError) throw professionalError;
        const professionals = professionalRows ?? [];
        const date = request.nextUrl.searchParams.get("date");
        const serviceId = Number(request.nextUrl.searchParams.get("serviceId"));
        const professional = request.nextUrl.searchParams.get("professional");
        if (!date || !serviceId || !professional) return NextResponse.json({services, professionals: professionals.map(item => item.name)});
        const service = services?.find((item) => item.id === serviceId);
        const professionalConfig = professionals.find(item => item.name === professional);
        if (!service || !professionalConfig) return NextResponse.json({error: "Datos de reserva inválidos"}, {status: 400});
        const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
        if (!professionalConfig.work_days.includes(dayOfWeek)) return NextResponse.json({services, professionals: professionals.map(item => item.name), slots: []});
        const start = santiagoDayStart(date), end = santiagoDayEnd(date);
        const excludeAppointmentId = Number(request.nextUrl.searchParams.get("excludeAppointmentId"));
        let appointmentsQuery = supabase.from("appointments").select("starts_at,duration_minutes,status").eq("professional_name", professional).gte("starts_at", start).lte("starts_at", end).neq("status", "cancelled");
        if (Number.isInteger(excludeAppointmentId) && excludeAppointmentId > 0) appointmentsQuery = appointmentsQuery.neq("id", excludeAppointmentId);
        const {data: appointments, error: appointmentError} = await appointmentsQuery;
        if (appointmentError) throw appointmentError;
        const opening = toMinutes(professionalConfig.work_start_time.slice(0, 5));
        const closing = toMinutes(professionalConfig.work_end_time.slice(0, 5));
        const slots = Array.from({length: Math.floor((closing - opening) / 30)}, (_, index) => opening + index * 30).filter((slot) => slot + service.duration_minutes <= closing && !(appointments ?? []).some((appointment) => {
            const begins = toMinutes(new Date(appointment.starts_at).toLocaleTimeString("es-CL", {
                timeZone: "America/Santiago",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }));
            const finishes = begins + appointment.duration_minutes;
            return slot < finishes && slot + service.duration_minutes > begins;
        })).map(toTime);
        return NextResponse.json({services, professionals: professionals.map(item => item.name), slots});
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : (error as {
                message?: string
            }).message ?? "No se pudo consultar disponibilidad"
        }, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        if (body.website || !body.clientName?.trim() || !body.phone?.trim() || !body.date || !/^\d{2}:\d{2}$/.test(body.time)) return NextResponse.json({error: "Completa los datos requeridos."}, {status: 400});
        const supabase = getSupabaseAdmin();
        const {data: professionalConfig} = await supabase.from("professionals").select("work_days,work_start_time,work_end_time").eq("name", body.professional).eq("active", true).maybeSingle();
        if (!professionalConfig || !professionalConfig.work_days.includes(new Date(`${body.date}T12:00:00`).getDay())) return NextResponse.json({error: "Esta profesional no atiende ese día."}, {status: 400});
        const {
            data: service,
            error: serviceError
        } = await supabase.from("services").select("id,duration_minutes").eq("id", body.serviceId).eq("active", true).single();
        if (serviceError || !service) return NextResponse.json({error: "Servicio no disponible."}, {status: 400});
        const start = santiagoDayStart(body.date), end = santiagoDayEnd(body.date);
        const {
            data: existing,
            error: existingError
        } = await supabase.from("appointments").select("starts_at,duration_minutes").eq("professional_name", body.professional).gte("starts_at", start).lte("starts_at", end).neq("status", "cancelled");
        if (existingError) throw existingError;
        const requested = toMinutes(body.time), conflict = (existing ?? []).some((appointment) => {
            const begins = toMinutes(new Date(appointment.starts_at).toLocaleTimeString("es-CL", {
                timeZone: "America/Santiago",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }));
            return requested < begins + appointment.duration_minutes && requested + service.duration_minutes > begins;
        });
        if (requested < toMinutes(professionalConfig.work_start_time.slice(0, 5)) || requested + service.duration_minutes > toMinutes(professionalConfig.work_end_time.slice(0, 5))) return NextResponse.json({error: "Ese horario está fuera de la jornada de la profesional."}, {status: 400});
        if (conflict) return NextResponse.json({error: "Ese horario acaba de ser reservado. Elige otro."}, {status: 409});
        const {error} = await supabase.from("appointments").insert({
            client_name: body.clientName.trim(),
            client_phone: body.phone.trim(),
            service_id: service.id,
            professional_name: body.professional,
            starts_at: santiagoInstant(body.date, body.time),
            duration_minutes: service.duration_minutes,
            status: "pending"
        });
        if (error) throw error;
        return NextResponse.json({ok: true});
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : (error as {
                message?: string
            }).message ?? "No se pudo crear la reserva."
        }, {status: 500});
    }
}
