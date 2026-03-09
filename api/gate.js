/**
 * api/gate.js — Maintenance mode gatekeeper
 *
 * This serverless function is the entry point for ALL page requests
 * when the site might be in maintenance mode. It checks MAINTENANCE_MODE
 * and either:
 *   - Redirects to /maintenance.html  (maintenance on)
 *   - Redirects to the actual page    (maintenance off)
 *
 * vercel.json routes / and /index.html here so static file serving
 * cannot be accessed directly, bypassing the check.
 */

export default function handler(req, res) {
  const isMaintenanceMode = isTruthy(process.env.MAINTENANCE_MODE);

  if (isMaintenanceMode) {
    // 307 Temporary Redirect to maintenance page
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(307, '/maintenance.html');
    return;
  }

  // Not in maintenance — redirect to the real index.html
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(307, '/index.html');
}

function isTruthy(value) {
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
