// Cloudflare Turnstile verification. Fixed endpoint: no user-controlled URLs.
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(secret: string, token: string | undefined, ip: string, fetcher: typeof fetch = fetch) {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  try {
    const response = await fetcher(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
