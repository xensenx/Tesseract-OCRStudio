/**
 * middleware.js — NOT USED
 *
 * Vercel Edge Middleware only executes for framework-based projects (Next.js, etc.)
 * This is a plain static site, so this file is never invoked by Vercel.
 *
 * Maintenance mode is handled by:
 *   1. api/gate.js     — serverless function that checks MAINTENANCE_MODE env var
 *                        and redirects to /maintenance.html or /index.html
 *   2. vercel.json     — routes / and /index.html through api/gate.js
 *   3. api/config.js   — also checks MAINTENANCE_MODE and returns it to the client
 *                        as a secondary safety net in script.js
 *
 * To enable maintenance mode: set MAINTENANCE_MODE=true in Vercel environment variables.
 */
