import { Elysia } from 'elysia'

/**
 * CORS plugin for Elysia that actually works with Railway.
 *
 * Sets Access-Control-Allow-Origin on every response and handles
 * OPTIONS preflight requests. Handles empty-string env vars that
 * bypass Zod defaults.
 *
 * Usage:
 *   new Elysia().use(corsHeaders())              // allows all origins
 *   new Elysia().use(corsHeaders('https://x.y')) // single origin
 */
export function corsHeaders(origin?: string) {
  const allowOrigin = origin && origin.trim() !== '' ? origin.trim() : '*'

  return new Elysia({ name: '@zyneth/cors' }).onRequest(({ set, request }) => {
    // Set CORS header on ALL requests upfront
    set.headers['Access-Control-Allow-Origin'] = allowOrigin

    // Handle preflight
    if (request.method === 'OPTIONS') {
      set.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
      set.headers['Access-Control-Allow-Headers'] = 'Content-Type'
      set.headers['Access-Control-Max-Age'] = '86400'
      set.status = 204
      return ''
    }
  })
}
