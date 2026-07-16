# Mind Enrichment — modular structure, real Supabase auth

This is the full prototype, restructured into separate files instead of one
giant HTML file — and with **real, working Supabase authentication** wired
directly into it. This replaces the need for the separate Next.js app from
earlier; everything now lives in one place.

## File structure

```
mind-enrichment/
├── index.html          ← page structure only
├── css/
│   └── style.css        ← all styling
├── js/
│   ├── config.js         ← Supabase connection (put your keys here)
│   ├── database.js       ← mock educator data + filter/subject taxonomy
│   ├── auth.js            ← real signup/login/logout logic
│   ├── ui.js               ← all rendering: cards, filters, dashboards, modal, theme
│   └── app.js               ← startup sequence, runs last
└── assets/
    └── logo.jpg
```

Scripts load in this order (see the bottom of `index.html`): the Supabase
CDN library, then `config.js`, `database.js`, `auth.js`, `ui.js`, `app.js`.
Order matters — each file depends on things defined in the ones before it.

## What's real now vs. what's still mock

- **Signup and login are real.** Creating a parent or educator account
  actually writes to your Supabase database (via the same signup trigger
  from `update_signup_trigger.sql`). Logging in checks real credentials.
  Signing out actually ends the session.
- **The dashboard greeting is real** — it shows the actual logged-in
  person's name, pulled from the database.
- **Everything else is still mock data** — the 8 educators, their reviews,
  qualifications, bookings, etc. still come from `database.js`, not
  Supabase. That's a separate, larger piece of work for later (loading real
  educator listings from the `educators` table instead of a hardcoded array).

## Setup

1. Open `js/config.js` and replace the two placeholder values with your real
   Supabase project URL and anon/public key (Supabase → Settings → API).
2. Make sure you've already run `update_signup_trigger.sql` in your Supabase
   SQL Editor (from earlier) — signup won't save profile data correctly
   without it.
3. That's it — **no build step, no npm install.** This is plain HTML/CSS/JS.
   Open `index.html` directly in a browser to test locally, or deploy the
   whole folder as-is.

## Deploying

Since there's no build process, this can go on Vercel as a **static site**:
1. Push this folder to GitHub (same steps as the earlier guide, just with
   this folder's contents instead of the Next.js project).
2. In Vercel, import the repo. Vercel will detect it as a static site — no
   build command needed, no environment variables needed either, since the
   Supabase keys are already directly in `config.js` (the anon key is safe
   to expose publicly; it's designed for this).
3. Deploy.

You can now retire the separate Next.js app from before — this single
project replaces it.

## A note on the anon key being visible in the code

This is expected and safe. The Supabase anon/public key is *meant* to be
visible in browser code — it's not a secret. What actually protects your
data is the Row Level Security (RLS) policies you already set up earlier
(`security_fixes.sql`, `security_fixes_2.sql`) — those control what each key
can actually read or write, regardless of who can see the key itself. Never
expose the *service_role* key this way, though — that one bypasses RLS
entirely.
