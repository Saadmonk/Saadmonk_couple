# Couples Club Online Setup

This project is ready to deploy as a free prototype with Vercel for hosting and Supabase for room storage plus realtime sync.

## 1. Create a Supabase project

1. Create a free Supabase account and a new project.
2. Open the SQL editor and run [`supabase/schema.sql`](./supabase/schema.sql).
3. In Project Settings -> API, copy:
   - `Project URL`
   - `anon public key`

## 2. Add env vars locally

1. Copy [`.env.example`](./.env.example) to `.env.local`.
2. Fill in:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

3. Restart the Vite dev server after changing env vars.

## 3. Test locally

```bash
npm install
npm run dev
```

If the env vars are present, the home screen will show that the online foundation is configured.

## 4. Deploy to Vercel

1. Push the repo to GitHub, GitLab, or Bitbucket.
2. Import the repo into Vercel.
3. Vercel will detect Vite automatically.
4. In Project Settings -> Environment Variables, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy.

`vercel.json` is included so the app keeps working as a single-page app.

## 5. Current online foundation

The project now includes:

- `src/lib/supabase.ts`: client bootstrap
- `src/lib/online.ts`: room creation, join, state save, broadcast, presence subscription
- `supabase/schema.sql`: prototype room table and permissive prototype policies

This is intentionally a first foundation, not the final secure production backend.

## 6. How the race minigame should sync

Yes, Supabase can handle a 20-second button-mash race.

Recommended sync pattern:

- count every keypress locally for immediate responsiveness
- send progress updates every `250ms`
- or only when progress changes by at least `5%`
- send one final finish event when the race ends

That keeps the game feeling instant while staying well inside normal realtime limits for a two-player game.

## 7. Important prototype note

The included SQL policies are intentionally loose so you can get online quickly with room codes.

Before a public launch, tighten this by adding:

- authenticated users or temporary player identities
- stricter row-level security
- room ownership checks
- cleanup for stale rooms
