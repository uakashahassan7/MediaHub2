# MediaHub2

Bilingual Urdu/English media platform built with React, Vite, Supabase and Cloudflare Workers Static Assets.

## Supabase

The browser client uses the public Supabase URL and publishable key from (public defaults are supplied for this project):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The configured public defaults point to the MediaHub Supabase project. Never add a service-role or secret key to frontend variables.

New registrations are viewers by default. Promote the site owner's profile to `admin` only through trusted Supabase SQL after verifying the owner's account; never expose role promotion in the browser. Configure Supabase Auth email confirmation and password recovery templates before production use.

## Build and deploy

```sh
npm install
npm run lint
npm run build
npx wrangler deploy
```

Cloudflare Workers Builds:
- Build command: `npm install --no-audit --no-fund && npm run build`
- Deploy command: `npx wrangler deploy`
- Production branch: `main` (merge the verified integration branch before deploying)

The Wrangler config serves the Vite `dist` folder and uses SPA fallback for routes such as `/about`, `/studio`, and `/watch/:id`.

## Features backed by Supabase

Auth, profiles, content feed, reactions, comments, subscriptions, site settings, admin moderation and media uploads to Supabase Storage. AI editorial analysis needs a separately configured server-side provider and is intentionally not exposed with a browser API key.
