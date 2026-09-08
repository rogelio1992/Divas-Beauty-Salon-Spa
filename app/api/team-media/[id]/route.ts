import {NextResponse} from "next/server";
import {getSupabasePublic} from "../../../../lib/supabase-public";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, {params}: {params: {id: string}}) {
    if (!/^\d+$/.test(params.id) || !Number.isSafeInteger(Number(params.id))) return new NextResponse(null, {status: 404});
    const db = getSupabasePublic();
    if (!db) return new NextResponse(null, {status: 503});
    const {data, error} = await db.rpc("public_team");
    if (error) return new NextResponse(null, {status: 503});
    const member = data?.find((p: {id: number; photo_path: string | null}) => p.id === Number(params.id));
    if (!member?.photo_path) return new NextResponse(null, {status: 404});
    const signed = await db.storage.from("salon-media").createSignedUrl(member.photo_path, 60);
    if (signed.error || !signed.data) return new NextResponse(null, {status: 404});
    return new NextResponse(null, {status: 302, headers: {Location: signed.data.signedUrl, "Cache-Control": "private, no-store"}});
}
