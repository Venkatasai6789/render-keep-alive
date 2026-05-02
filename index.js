/**
 * render-keep-alive — index.js
 *
 * A lightweight Express service that prevents Render free-tier instances from
 * going to sleep by pinging itself and an external URL every 14 minutes.
 *
 * Render free-tier spins down after 15 minutes of inactivity. By sending an
 * HTTP GET to its own /ping endpoint (and an optional external URL) every 14
 * minutes, the service stays awake 24/7 without any external cron job.
 *
 * Render dashboard settings:
 *   Build Command : npm install
 *   Start Command : node index.js
 */

'use strict';

const express = require('express');

const app = express();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;

// Render injects RENDER_EXTERNAL_URL with the public HTTPS URL of the service.
// Fall back to localhost for local development.
const SELF_URL = process.env.RENDER_EXTERNAL_URL
  ? process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '') // strip trailing slash
  : `http://localhost:${PORT}`;

// External service to keep alive (cache-bust query param added per request).
// Override via the EXTERNAL_URL environment variable if you need a different target.
const EXTERNAL_URL =
  process.env.EXTERNAL_URL || 'https://radio.kalasalingam.ac.in/';

// Interval between pings: 14 minutes in milliseconds.
const PING_INTERVAL_MS = 14 * 60 * 1000;

// Maximum time to wait for a response before aborting the request.
const FETCH_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** Root health-check endpoint. */
app.get('/', (_req, res) => {
  res.status(200).send('Service is running');
});

/** Dedicated ping endpoint used by the self-ping loop. */
app.get('/ping', (_req, res) => {
  res.status(200).send('Pong');
});

// ---------------------------------------------------------------------------
// Ping helper
// ---------------------------------------------------------------------------

/**
 * Fetch a URL with a strict timeout enforced via AbortSignal.timeout.
 *
 * Render free-tier cold-starts can take 2–5 minutes, so the external target
 * may not respond within the timeout window. Aborting the request cleanly
 * prevents the event loop from hanging.
 *
 * @param {string} url - The URL to GET.
 * @param {string} label - A short label used in log messages.
 */
async function pingUrl(url, label) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    console.log(`[ping] ${label} → HTTP ${response.status}`);
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      // Expected during cold-starts — not a critical failure.
      console.log(
        `[ping] ${label} → request timed out after ${FETCH_TIMEOUT_MS / 1000}s ` +
          '(normal behavior during cold start)'
      );
    } else {
      console.error(`[ping] ${label} → unexpected error: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Keep-alive loop
// ---------------------------------------------------------------------------

/**
 * Run one full ping cycle:
 *  1. Self-ping  — hits /ping on this very instance.
 *  2. External ping — hits the external URL with a cache-busting timestamp so
 *     CDN/Cloudflare layers do not serve a cached response and the request
 *     actually reaches the origin container.
 */
async function runPingCycle() {
  console.log(`[ping] Cycle started at ${new Date().toISOString()}`);

  const timestamp = Date.now();

  await Promise.allSettled([
    pingUrl(`${SELF_URL}/ping?bust=${timestamp}`, 'self'),
    pingUrl(`${EXTERNAL_URL}?ping=${timestamp}`, 'external')
  ]);
}

// Fire immediately on startup, then schedule the next cycle only after the
// current one completes (recursive setTimeout) to prevent overlapping cycles
// when a cold-start or slow network causes a cycle to exceed PING_INTERVAL_MS.
async function schedulePingCycle() {
  await runPingCycle();
  setTimeout(schedulePingCycle, PING_INTERVAL_MS);
}

schedulePingCycle();

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`[server] render-keep-alive listening on port ${PORT}`);
  console.log(`[server] Self URL : ${SELF_URL}`);
  console.log(`[server] Ping interval : ${PING_INTERVAL_MS / 1000}s`);
});
