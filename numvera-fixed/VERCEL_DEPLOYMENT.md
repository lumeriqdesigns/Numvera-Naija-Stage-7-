# Numvera Naija — Vercel Deployment

## Root cause of the "static site" behaviour (fixed in this build)

1. **Sign-in button was `type="button"`** so the auth form never submitted and Supabase Auth was never called.
2. **Sign-in silently fell back to sign-up** on any error (production-unsafe).
3. **Workspace create did not persist the new plan to Supabase** — `persist()` only upserted `active`, and manual create never set `active` before persist. Data stayed in localStorage only.
4. **Missing member insert RLS** could block owner membership rows (schema updated).
5. **Invalid Vercel runtime** (`nodejs20.x`) in older `vercel.json` — removed.

## Deploy steps

1. Push this project to GitHub with **repository root = application root** (contains `index.html`, `api/`, `js/`, `vercel.json`).
2. In Vercel: Root Directory = **`.`** (repository root). Do **not** set it to `Numvera Naija Stage 7`.
3. Environment variables (Production + Preview):

| Name | Required |
|------|----------|
| `SUPABASE_URL` | yes |
| `SUPABASE_ANON_KEY` | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (server only) |

4. Run `schema.sql` in the Supabase SQL editor (adds member insert/update/delete policies).
5. Confirm Auth → Email settings (disable confirmation for faster testing, or keep it and handle the message in UI).
6. Confirm Storage bucket `workspace-files` exists (created by schema).
7. Redeploy after env vars change.
8. Verify:
   - `GET /api/health` → `cloudConfigured: true`, `serverConfigured: true`
   - `GET /api/config` → `configured: true` and public URL/anon key only

## After deploy checklist

- Create account
- Sign in / Sign out / Refresh (session persists)
- Create workspace → refresh → still present
- Add task, expense, comment → refresh → still present
- Wrong password shows error (does **not** create account)
