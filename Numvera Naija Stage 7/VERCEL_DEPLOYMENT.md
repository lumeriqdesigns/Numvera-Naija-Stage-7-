# Numvera Naija Vercel Deployment

## 1. Import the project
Upload this project to Vercel or connect its Git repository. Vercel can deploy the static frontend and `/api` functions together.

## 2. Add Production environment variables
Set these in Vercel Project Settings → Environment Variables:

- `SUPABASE_URL` = your Supabase project URL
- `SUPABASE_ANON_KEY` = your Supabase publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service role key

The service role key is server only and must never be placed in `js/config.js` or browser code.

You can use the public key as `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead, but keeping the three server variables above is simpler for this plain HTML Vercel build. Vercel environment variables are applied to new deployments, so redeploy after changing them.

## 3. Prepare Supabase
Run `schema.sql` in the Supabase SQL editor. Confirm Auth email settings and the `workspace-files` storage bucket.

## 4. Deploy a Preview first
Use a Preview deployment to test authentication, workspace creation, invitations, file uploads and realtime changes before promoting the same code to Production. Vercel provides separate Preview and Production environments.

## 5. Verify
Open `/api/health` and confirm `cloudConfigured: true` and `serverConfigured: true`. Do not expose or paste the service key into the browser.

## 6. Production
After Preview testing, deploy the Production branch.
