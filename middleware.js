/**
 * Vercel Edge Middleware (Standard Web APIs)
 * This runs before a request is processed and can intercept it.
 */

export default function middleware(request) {
  // If maintenance mode is enabled, intercept all traffic
  if (process.env.MAINTENANCE_MODE === 'true') {
    const url = new URL(request.url);

    // Allow the maintenance page itself to be served, as well as assets needed for it
    if (url.pathname === '/maintenance.html' || url.pathname === '/wrench.svg' || url.pathname.startsWith('/_vercel')) {
      return; // Proceed normally
    }

    // Redirect everything else to the maintenance page
    url.pathname = '/maintenance.html';
    return Response.redirect(url, 302);
  }

  // If maintenance mode is off, proceed normally
  return;
}

export const config = {
  // Match all request paths to ensure direct URLs like /index.html are intercepted
  matcher: '/:path*',
};