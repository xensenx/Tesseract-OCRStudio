/**
 * status.js
 *
 * Checks the maintenance mode from the backend.
 * If the site is in maintenance mode, it redirects to maintenance.html.
 */

async function checkMaintenanceStatus() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) {
      console.warn('Failed to fetch config for maintenance check', res.status);
      return;
    }

    const data = await res.json();

    if (data.maintenanceMode === true) {
      // Redirect to maintenance page
      window.location.href = '/maintenance.html';
    } else {
      console.log('Site status active normally');
    }
  } catch (err) {
    console.error('Error checking maintenance status:', err);
  }
}

// Run immediately
checkMaintenanceStatus();
