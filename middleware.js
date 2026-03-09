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

  let isMaintenanceModeEnabled = true; // fail-closed while probing runtime status

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
    // Fail-closed when status endpoint is unavailable.
    isMaintenanceModeEnabled = true;
  }

  if (isMaintenanceModeEnabled) {
    return redirectToMaintenance(request.url);
  }

  return;
}

function redirectToMaintenance(requestUrl) {
  const redirectUrl = new URL('/maintenance.html', requestUrl);
  return new Response(null, {
    status: 307,
    headers: {
      Location: redirectUrl.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export const config = {
  // Match all request paths to ensure direct URLs like /index.html are intercepted
  matcher: '/:path*',
};
