/**
 * Vercel Edge Middleware (Standard Web APIs)
 * Runs at the edge before any request is processed.
 *
 * Environment variable:
 *   MAINTENANCE_MODE  — set to "true", "1", "yes", or "on" to enable
 *
 * When enabled, ALL requests are redirected to /maintenance.html
 * except for /maintenance.html itself (to avoid an infinite redirect loop).
 * The maintenance page is fully self-contained (inline CSS, no external assets)
 * so nothing else needs to be allowed through.
 */

export default function middleware(request) {
  const isMaintenanceModeEnabled = isTruthy(process.env.MAINTENANCE_MODE);

  if (isMaintenanceModeEnabled) {
    const { pathname } = new URL(request.url);

    // Only allow the maintenance page itself through — it is fully self-contained.
    // Block everything else: /, /index.html, /script.js, /api/config, etc.
    if (pathname === '/maintenance.html') {
      return; // serve it normally
    }

    // 307 Temporary Redirect — preserves method, signals "come back later"
    return Response.redirect(new URL('/maintenance.html', request.url), 307);
  }

  // Maintenance mode off — proceed normally
  return;
}

function isTruthy(value) {
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export const config = {
  matcher: '/:path*',
};
