// ============================================================================
// CONFIG.JS — Supabase connection setup
// Fill in your own project's URL and anon/public key below (Supabase →
// Settings → API). Never put your service_role key here — only the
// anon/public one, which is safe to expose in browser code.
// ============================================================================

const SUPABASE_URL = "https://your-project-ref.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-public-key";

// `supabase` here refers to the global object created by the Supabase CDN
// script tag loaded in index.html — this creates our actual client instance.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
