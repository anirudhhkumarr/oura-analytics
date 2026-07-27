# Oura Analytics

Personal Oura dashboard.

**Site:** https://anirudhhkumarr.github.io/oura-analytics/

## Setup

1. Create an Oura OAuth application at <https://cloud.ouraring.com/oauth/applications>.
2. Set the Oura Redirect URI to your dashboard URL (shown on the page), for example:
   - `https://anirudhhkumarr.github.io/oura-analytics/`
   - `http://localhost:5173/` for local development
3. Open the site, paste the **Client ID**, then select **Connect Oura**.

Auth runs entirely in the browser (implicit grant). The OAuth access token is saved in `localStorage` and used for API calls. Dashboard snapshots are stored in SQLite via sql.js, also persisted in `localStorage`.

### API proxy (needed on the published site)

Oura’s API rejects most browser origins (`Disallowed CORS origin`). Local `npm run dev` proxies through Vite automatically. For GitHub Pages, deploy the optional Cloudflare Worker once:

```bash
npx wrangler deploy cloudflare/oura-proxy.js --name oura-analytics-proxy
```

Paste the worker URL into **API base** on the dashboard (stored in `localStorage`).

Optional build-time defaults (`.env`):

```bash
VITE_OURA_CLIENT_ID=
VITE_OURA_API_BASE=
```

## Local development

```bash
npm install
npm run dev
```

## Git hooks

`npm install` sets `core.hooksPath` to `.githooks`. Pre-commit runs lint + build; pre-push runs build.

## Deployment

Push to `main` builds the Vite bundle and publishes `dist/`. Set **Pages → Source** to **GitHub Actions**.

## Never commit

`.env`, tokens, local data, caches, logs, and SQLite files are ignored. Check with:

```bash
git status --ignored
```
