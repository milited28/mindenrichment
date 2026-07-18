// ============================================================================
// CONFIG.JS — Supabase connection setup
// Fill in your own project's URL and anon/public key below (Supabase →
// Settings → API). Never put your service_role key here — only the
// anon/public one, which is safe to expose in browser code.
// ============================================================================

const SUPABASE_URL = "https://hignbhrtyknjdrbwdvnl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-3hnHh5lGuQirAfLMBq-dA_FPbfJ91E";

// `supabase` here refers to the global object created by the Supabase CDN
// script tag loaded in index.html — this creates our actual client instance.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
