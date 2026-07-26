# Oura Analytics

A static GitHub Pages dashboard with a deliberately local Oura bridge. The
published site contains only HTML, CSS, and JavaScript; Oura credentials,
tokens, and health data remain on the computer running the bridge.

## Publish to GitHub Pages

The included workflow deploys `web/` when `main` is pushed. In the repository
settings, set **Pages → Source** to **GitHub Actions**. The site will be at:

`https://anirudhhkumarr.github.io/oura-analytics/`

## One-time local setup

1. Create an Oura OAuth application at <https://cloud.ouraring.com/oauth/applications>.
2. Copy `.env.example` to `.env`, then set the client ID and client secret.
3. In the Oura application, set the Redirect URI to exactly
   `http://127.0.0.1:8780/api/auth/callback`.
4. Start the local bridge:

   ```bash
   npm run start:bridge
   ```

5. Open the Pages site and select **Connect Oura**. The OAuth flow and token
   exchange run through `127.0.0.1`; the token is written with owner-only
   permissions to `~/.config/oura-analytics/tokens.json`.

## MCP boundary

A browser cannot connect directly to a stdio MCP server: that transport is
local-process-only, and exposing it on the public internet would expose private
health data. The bridge is the safe browser-facing adapter: it stays bound to
`127.0.0.1`, holds the Oura token locally, and returns only dashboard data to
the Page.

If you run `oura-ring-mcp`, point both tools at the same local Oura OAuth app
and token location (set `OURA_TOKEN_PATH` in each `.env`). They then share the
same local authorization without putting any token in GitHub Pages.

## Never commit

`.env`, tokens, local data, caches, logs, and SQLite files are ignored. Before
pushing, confirm with:

```bash
git status --ignored
```
