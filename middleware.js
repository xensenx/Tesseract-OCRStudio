/**
 * Vercel Edge Middleware (Standard Web APIs)
 * This runs before a request is processed and can intercept it.
 */

export default async function middleware(request) {
  const url = new URL(request.url);

  // Always allow maintenance assets and maintenance status endpoint itself.
  if (
    url.pathname === '/maintenance.html' ||
    url.pathname === '/wrench.svg' ||
    url.pathname === '/api/maintenance' ||
    url.pathname.startsWith('/_vercel')
  ) {
    return;
  }

  let isMaintenanceModeEnabled = true; // fail-closed: default to lock site

  try {
    const statusUrl = new URL('/api/maintenance', request.url);
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: { 'x-maintenance-check': '1' },
      cache: 'no-store',
    });

    if (statusResponse.ok) {
      const data = await statusResponse.json();
      isMaintenanceModeEnabled = data?.maintenanceMode === true;
    }
  } catch {
    isMaintenanceModeEnabled = true;
  }

  if (isMaintenanceModeEnabled) {
    const redirectUrl = new URL('/maintenance.html', request.url);
    return Response.redirect(redirectUrl, 307);
  }

  return;
}

export const config = {
  // Match all request paths to ensure direct URLs like /index.html are intercepted
  matcher: '/:path*',
};
