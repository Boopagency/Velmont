// Small helpers shared by the API functions.

const baseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex',
};

export function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { ...baseHeaders, ...headers } });
}

/** Generic error: never echo internals, SQL errors or stack traces to clients. */
export const fail = (status: number, error: string) => json(status, { error });

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

type LogValue = string | number | boolean | string[];

/**
 * One JSON line per event in the Vercel Runtime Logs. Callers pass codes,
 * routes, statuses and field names only: never form values, e-mails, names,
 * passwords, tokens or keys.
 */
export function logEvent(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, LogValue> = {}) {
  const line = JSON.stringify({ level, event, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/** Browsers always send Origin on POST; require it to match this deployment or the site. */
export function assertSameOrigin(request: Request, siteUrl: string) {
  const origin = request.headers.get('origin');
  const own = new URL(request.url).origin;
  const allowed = new Set([own, siteUrl].filter(Boolean));
  if (!origin || !allowed.has(origin)) throw new HttpError(403, 'forbidden_origin');
}

/** Reads a JSON body with a hard size cap (the Content-Length header is not trusted). */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'unsupported_media_type');
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new HttpError(413, 'payload_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'invalid_body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, 'payload_too_large');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

/** Client IP as seen by the Vercel edge. Only used hashed, for rate limiting. */
export function clientIp(request: Request) {
  return (request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim().slice(0, 64);
}

/**
 * The network a rate limit applies to: the IPv4 address itself, or the /64
 * of an IPv6 address (one subscriber usually controls a whole /64, so every
 * address in it shares one counter).
 */
export function rateLimitSubject(ip: string) {
  const address = ip.trim().toLowerCase().replace(/%.*$/, '');
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
  if (mapped) return mapped[1];
  if (!address.includes(':')) return address;
  const halves = address.split('::');
  if (halves.length > 2) return address;
  const groups = (part: string) => (part ? part.split(':').flatMap((g) => (g.includes('.') ? ['0', '0'] : [g])) : []);
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return address;
  const full = [...head, ...Array<string>(missing).fill('0'), ...tail];
  if (!full.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return address;
  return `${full.slice(0, 4).map((g) => g.padStart(4, '0')).join(':')}::/64`;
}

export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

/** Runs a handler; every refusal and failure leaves one structured line (route, status, code). */
export async function handle(request: Request, fn: () => Promise<Response>) {
  const route = new URL(request.url).pathname;
  let response: Response;
  try {
    response = await fn();
  } catch (error) {
    if (error instanceof HttpError) response = fail(error.status, error.code);
    else {
      logEvent('error', 'api_exception', { route, message: error instanceof Error ? error.message : 'unknown' });
      response = fail(500, 'internal_error');
    }
  }
  if (response.status >= 400) {
    const code = await response
      .clone()
      .json()
      .then((body: unknown) => {
        const error = (body as { error?: unknown } | null)?.error;
        return typeof error === 'string' ? error : '';
      })
      .catch(() => '');
    logEvent(response.status >= 500 ? 'error' : 'warn', 'api_refused', { route, method: request.method, status: response.status, error: code });
  }
  return response;
}
