// Tiny first-party analytics helper. Sends an event to /api/track on the same
// origin via sendBeacon (preferred — survives navigation away, e.g. when the
// user clicks an outbound link) with a fetch+keepalive fallback.
//
// No cookies, no IDs, no PII. Just event name + page path + (optional)
// document.referrer, all anonymous.

export function track(event: string, props?: { page?: string }) {
  if (typeof window === 'undefined') return;

  const payload = JSON.stringify({
    event,
    page: props?.page ?? window.location.pathname,
    referrer: document.referrer || '',
  });

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/track', blob);
      return;
    } catch {
      // fall through to fetch
    }
  }

  // sendBeacon unavailable — fetch with keepalive so the request survives unload.
  fetch('/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    keepalive: true,
    credentials: 'omit',
  }).catch(() => {});
}
