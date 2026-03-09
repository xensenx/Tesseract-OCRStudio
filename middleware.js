/**
 * Vercel Edge Middleware (Standard Web APIs)
 * This runs before a request is processed and can intercept it.
 *
 * Environment variable:
 *   MAINTENANCE_MODE  — set to "true", "1", "yes", or "on" to enable maintenance mode
 */

export default function middleware(request) {
  const isMaintenanceModeEnabled = isTruthy(process.env.MAINTENANCE_MODE);

  if (isMaintenanceModeEnabled) {
    const url = new URL(request.url);

    // Allow the maintenance page itself and any assets it needs to load normally
    const allowedPaths = ['/maintenance.html', '/wrench.svg'];
    const isAllowed =
      allowedPaths.includes(url.pathname) ||
      url.pathname.startsWith('/_vercel') ||
      url.pathname.startsWith('/assets/') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.ico');

    if (isAllowed) {
      return; // Proceed normally
    }

    // Redirect all other traffic to the maintenance page (307 = Temporary Redirect)
    const redirectUrl = new URL('/maintenance.html', request.url);
    return Response.redirect(redirectUrl, 307);
  }

  // Maintenance mode is off — proceed normally
  return;
}

function isTruthy(value) {
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export const config = {
  // Match all request paths
  matcher: '/:path*',
};
