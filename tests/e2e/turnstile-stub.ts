// Test only (loaded with --import by the end-to-end server): answers
// Cloudflare Turnstile's siteverify locally, so the real /api/leads code runs
// its mandatory server-side check without network access. The production
// code is unchanged; only this process's fetch is wrapped.

export const TURNSTILE_PASS = 'e2e-turnstile-pass';
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const realFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url !== SITEVERIFY) return realFetch(input, init);
  const form = new URLSearchParams(init?.body instanceof URLSearchParams ? init.body : typeof init?.body === 'string' ? init.body : '');
  const success = form.get('secret') === process.env.TURNSTILE_SECRET_KEY && form.get('response') === TURNSTILE_PASS;
  return new Response(JSON.stringify({ success }), { headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

/** The browser side: Cloudflare's widget script, replaced by one that issues the passing token. */
export const turnstileScript = `(() => {
  let issue = () => {};
  window.turnstile = {
    render(el, options) { issue = () => setTimeout(() => options.callback(${JSON.stringify(TURNSTILE_PASS)}), 50); issue(); return 'e2e-widget'; },
    reset() { issue(); },
  };
})();`;
