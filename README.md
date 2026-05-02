# render-keep-alive

A lightweight Express.js service that prevents Render free-tier instances from
going to sleep by pinging itself and an external URL every **14 minutes**.

## How it works

Render free-tier web services are spun down after 15 minutes of inactivity.
This service runs two HTTP GET requests every 14 minutes:

1. **Self-ping** — hits its own `/ping` endpoint to keep itself awake.
2. **External ping** — hits `https://radio.kalasalingam.ac.in/` (with a
   cache-busting timestamp) to keep a second service awake.

Cold-start timeouts (2–5 minutes) are handled gracefully via `AbortController`
and logged as expected behaviour.

## Endpoints

| Method | Path    | Response                 |
|--------|---------|--------------------------|
| GET    | `/`     | `200 Service is running` |
| GET    | `/ping` | `200 Pong`               |

## Local development

```bash
npm install
node index.js
```

## Render deployment

| Setting       | Value           |
|---------------|-----------------|
| Build Command | `npm install`   |
| Start Command | `node index.js` |

Set the **Environment Variable** `RENDER_EXTERNAL_URL` to your Render service
URL (Render injects this automatically).

Optionally set `EXTERNAL_URL` to override the default external ping target
(`https://radio.kalasalingam.ac.in/`).

## Requirements

- Node.js ≥ 18 (uses the native `fetch` API and `AbortController`)