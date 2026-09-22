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

export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) return fail(error.status, error.code);
    console.error('api_error', error instanceof Error ? error.message : 'unknown');
    return fail(500, 'internal_error');
  }
}
