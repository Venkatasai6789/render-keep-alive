# render-keep-alive

A lightweight Express.js service that prevents Render free-tier instances from
going to sleep by pinging itself and an external URL every **14 minutes**.

## How it works

Render free-tier web services are spun down after 15 minutes of inactivity.
This service runs two HTTP GET requests every 14 minutes while it is awake:

1. **Self-ping** — hits its own `/ping` endpoint (with a cache-busting timestamp)
   to keep itself awake.
2. **External ping** — hits `https://radio.kalasalingam.ac.in/` (with a
   cache-busting timestamp) to keep a second service awake.

> **Important:** Render free-tier instances still require **external inbound
> traffic** to wake up after they have slept. Self-ping only keeps the service
> alive once it is already running.

Cold-start timeouts (2–5 minutes) are handled gracefully via
`AbortSignal.timeout()` and logged as expected behaviour.

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

## Keep it alive on the free tier

1. Deploy the service and confirm it is reachable at
   `https://<your-app>.onrender.com/`.
2. Set up an **external monitor** (UptimeRobot, cron on another host, etc.) to
   hit `https://<your-app>.onrender.com/ping` every **10–14 minutes**.
3. Check the Render logs and verify `/ping` requests are arriving on schedule
   and cold-starts stop occurring.
4. If you want to keep another service awake, set `EXTERNAL_URL`. Otherwise,
   leave it unset.

## Requirements

- Node.js ≥ 18 (uses the native `fetch` API and `AbortSignal.timeout()`)
