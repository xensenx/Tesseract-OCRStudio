/**
 * api/config.js — Vercel Serverless Function
 *
 * Exposes the two Gemma API keys from Vercel environment variables
 * to the frontend without embedding them in client-side source code.
 *
 * Environment variables to set in Vercel dashboard:
 *   GEMMA_API_KEY_ONE   — First Google API key
 *   GEMMA_API_KEY_TWO   — Second Google API key
 *   MAINTENANCE_MODE    — "true" or "false"
 *
 * Endpoint: GET /api/config
 * Returns:  { keyOne: "AIza...", keyTwo: "AIza...", maintenanceMode: false }
 */

export default function handler(req, res) {
  // Never cache this response — it contains live env var state
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keyOne = process.env.GEMMA_API_KEY_ONE || '';
  const keyTwo = process.env.GEMMA_API_KEY_TWO || '';
  const maintenanceMode = isTruthy(process.env.MAINTENANCE_MODE);

  // During maintenance mode, avoid failing this endpoint when keys are unavailable.
  if (maintenanceMode) {
    return res.status(200).json({ maintenanceMode: true, keyOne: '', keyTwo: '' });
  }

  if (!keyOne || !keyTwo) {
    return res.status(500).json({
      error: 'API keys not configured. Set GEMMA_API_KEY_ONE and GEMMA_API_KEY_TWO in Vercel environment variables.'
    });
  }

  // Return keys — this endpoint is only reachable server-side on Vercel,
  // never exposed in static source files.
  res.status(200).json({ keyOne, keyTwo, maintenanceMode });
}

function isTruthy(value) {
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
