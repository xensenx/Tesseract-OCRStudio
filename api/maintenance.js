/**
 * api/maintenance.js — Vercel Serverless Function
 *
 * Single-purpose endpoint used by edge middleware to decide whether to
 * hard-lock the entire site behind /maintenance.html.
 */

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const maintenanceMode = isTruthy(process.env.MAINTENANCE_MODE);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.status(200).json({ maintenanceMode });
}

function isTruthy(value) {
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
