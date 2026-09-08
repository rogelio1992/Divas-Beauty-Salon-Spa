import {createClient} from "@supabase/supabase-js";
// Deliberately anonymous: public content remains subject to RLS, even on the server.
export function getSupabasePublic() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return url && key ? createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}, global: {fetch: (input, init) => fetch(input, {...init, cache: "no-store"})}}) : null;
}
