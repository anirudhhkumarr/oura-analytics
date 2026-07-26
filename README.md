# Oura Analytics

Personal Oura dashboard.

**Site:** https://anirudhhkumarr.github.io/oura-analytics/

## Setup

1. Create an Oura OAuth application at <https://cloud.ouraring.com/oauth/applications>.
2. Copy `.env.example` to `.env`, then set the client ID and client secret.
3. Set the Oura Redirect URI to `http://localhost:8780/api/auth/callback`.
4. Install and build:

   ```bash
   npm install
   npm run build
   ```

5. Start the local bridge:

   ```bash
   npm run start:bridge
   ```

6. Open the site or `http://localhost:8780`, then select **Connect Oura**.

For local UI development with hot reload:

```bash
npm run start:bridge
npm run dev
```

Tokens are stored at `~/.config/oura-analytics/tokens.json`.

If you also use `oura-ring-mcp`, set the same `OURA_TOKEN_PATH` in both `.env` files.

## Git hooks

`npm install` sets `core.hooksPath` to `.githooks`. Pre-commit runs lint + build; pre-push runs build.

## Deployment

Push to `main` builds the Vite bundle and publishes `dist/`. Set **Pages → Source** to **GitHub Actions**.

## Never commit

`.env`, tokens, local data, caches, logs, and SQLite files are ignored. Check with:

```bash
git status --ignored
```
