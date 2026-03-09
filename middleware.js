/**
 * Vercel Edge Middleware (Standard Web APIs)
 * This runs before a request is processed and can intercept it.
 */

export default function middleware(request) {
  const isMaintenanceModeEnabled = isTruthy(process.env.MAINTENANCE_MODE);

  // If maintenance mode is enabled, intercept all traffic
  if (isMaintenanceModeEnabled) {
    const url = new URL(request.url);
    
    // Allow the maintenance page itself to be served, as well as assets needed for it
    if (url.pathname === '/maintenance.html' || url.pathname === '/wrench.svg' || url.pathname.startsWith('/_vercel')) {
      return; // Proceed normally
    }

    // Serve the maintenance page while keeping the requested URL.
    const redirectUrl = new URL('/maintenance.html', request.url);
    return Response.redirect(redirectUrl, 307);
  }

  // If maintenance mode is off, proceed normally
  return;
}

function isTruthy(value) {
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export const config = {
  // Match all request paths to ensure direct URLs like /index.html are intercepted
  matcher: '/:path*',
};
