# Oura Analytics

Personal Oura dashboard.

**Site:** https://anirudhhkumarr.github.io/oura-analytics/

## Setup

1. Create an Oura OAuth application at <https://cloud.ouraring.com/oauth/applications>.
2. Copy `.env.example` to `.env`, then set the client ID and client secret.
3. Set the Oura Redirect URI to `http://localhost:8780/api/auth/callback`.
4. Start the local bridge:

   ```bash
   npm run start:bridge
   ```

5. Open the site or `http://localhost:8780`, then select **Connect Oura**.

Tokens are stored at `~/.config/oura-analytics/tokens.json`.

If you also use `oura-ring-mcp`, set the same `OURA_TOKEN_PATH` in both `.env` files.

## Deployment

Push to `main` publishes `web/`. Set **Pages → Source** to **GitHub Actions**.

## Never commit

`.env`, tokens, local data, caches, logs, and SQLite files are ignored. Check with:

```bash
git status --ignored
```
