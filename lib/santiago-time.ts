const timeZone = "America/Santiago";

function offsetMinutesAt(instant: Date) {
    const offset = new Intl.DateTimeFormat("en-US", {timeZone, timeZoneName: "longOffset"})
        .formatToParts(instant)
        .find(part => part.type === "timeZoneName")?.value ?? "GMT-00:00";
    const match = offset.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
    if (!match) return 0;
    const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
    return match[1] === "+" ? minutes : -minutes;
}

/** Converts a wall-clock date and time in Santiago to the UTC instant stored by Supabase. */
export function santiagoInstant(date: string, time: string) {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute, second = 0] = time.split(":").map(Number);
    const localClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const offset = offsetMinutesAt(new Date(localClockAsUtc));
    return new Date(localClockAsUtc - offset * 60_000).toISOString();
}

export const santiagoDayStart = (date: string) => santiagoInstant(date, "00:00:00");
export const santiagoDayEnd = (date: string) => santiagoInstant(date, "23:59:59");
