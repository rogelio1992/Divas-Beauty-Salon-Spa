export const BOOKING_CONFLICT_MESSAGE = "Ese horario acaba de ser reservado para esta profesional. Elige otra hora.";

export function isBookingConflict(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "23P01";
}
