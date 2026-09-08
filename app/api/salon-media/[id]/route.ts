import {NextResponse} from "next/server";
import {getSupabasePublic} from "../../../../lib/supabase-public";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, {params}: {params: {id: string}}) {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new NextResponse(null, {status: 404});
    const db = getSupabasePublic();
    if (!db) return new NextResponse(null, {status: 503});
    // RLS excludes drafts and expired/future promotions regardless of caller's session.
    const {data, error} = await db.from("salon_posts").select("image_path").eq("id", params.id).maybeSingle();
    if (error || !data?.image_path) return new NextResponse(null, {status: 404});
    const signed = await db.storage.from("salon-media").createSignedUrl(data.image_path, 60);
    if (signed.error || !signed.data?.signedUrl) return new NextResponse(null, {status: 404});
    return new NextResponse(null, {status: 302, headers: {Location: signed.data.signedUrl, "Cache-Control": "private, no-store"}});
}
