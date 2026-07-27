# Oura Analytics

Personal recovery analytics for Oura.

**Site:** https://anirudhhkumarr.github.io/oura-analytics/

Connect your Oura account to explore timeseries trends, correlations, regression, and clustering.

## Caching

Older days are treated as immutable and kept in browser SQLite (`localStorage`). After the first full load, refreshes only pull the last two days (still mutable) and merge them into cache.

## Webhooks (near-realtime)

GitHub Pages cannot receive Oura callbacks. Point Oura at the Cloudflare Worker instead:

1. Deploy the worker (`cloudflare/`) with secrets:
   - `OURA_CLIENT_ID`
   - `OURA_CLIENT_SECRET`
   - `OURA_WEBHOOK_VERIFICATION_TOKEN`
2. Create a KV namespace, bind it as `SYNC` in `wrangler.toml`, redeploy.
3. Register subscriptions once:
   ```bash
   curl -X POST https://oura-analytics-proxy.anirudhkumar.workers.dev/webhook/setup
   ```
   Or call `POST /v2/webhook/subscription` yourself for each `data_type` × `event_type` (`create` / `update`) with `callback_url` = `https://<worker>/webhook`.
4. Renew subscriptions before they expire (`PUT /v2/webhook/subscription/renew/{id}`).

When Oura pushes an event, the worker stores `last_event_at`. The site checks `/sync-status` about once a minute and refreshes only the recent mutable window.

## Local development

```bash
npm install
npm run dev
```

## Deployment

Push to `main` publishes the site via GitHub Actions. Production Client ID and API proxy are defined in `.env.production`.
