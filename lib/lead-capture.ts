import type { CtaSource } from './cta-sources';
import { publicEnv } from './public-env';
import { whatsappUrl } from './site';

// Records a contact request as a lead, then continues to WhatsApp. WhatsApp
// opens only after /api/leads confirms the lead is stored (201): a refusal or
// a failure keeps the visitor on the form with a message, never a hand-off
// that skipped the record.

const KEY = 'vm-attribution';
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
type Attribution = Partial<Record<(typeof UTM)[number] | 'landing_page' | 'referrer', string>>;

/** Remembers where the visit started. Only the path, the referrer origin and UTM tags. */
export function captureAttribution() {
  if (!publicEnv.leadCapture) return;
  try {
    if (sessionStorage.getItem(KEY)) return;
    const params = new URLSearchParams(location.search);
    const data: Attribution = { landing_page: location.pathname.slice(0, 500) };
    for (const key of UTM) {
      const value = params.get(key);
      if (value) data[key] = value.slice(0, 150);
    }
    if (document.referrer) {
      const origin = new URL(document.referrer).origin;
      if (origin !== location.origin) data.referrer = origin;
    }
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private mode); attribution is optional.
  }
}

function readAttribution(): Attribution {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '{}') as Attribution;
  } catch {
    return {};
  }
}

type Turnstile = { render: (el: HTMLElement, options: Record<string, unknown>) => string; reset: (widget?: string) => void; remove?: (widget?: string) => void };
const turnstileApi = () => (window as unknown as { turnstile?: Turnstile }).turnstile;

// Cloudflare Turnstile loads once; every form gets its own widget, so a
// challenge shows where the visitor is (the dialog or the page form) and each
// token is sent by the form it was issued to.
type Protection = { widget?: string; token: string; waiters: ((token: string) => void)[] };
const protections = new WeakMap<HTMLFormElement, Protection>();
let script: Promise<void> | null = null;

function loadTurnstile() {
  script ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      script = null;
      el.remove();
      reject(new Error('turnstile unavailable'));
    };
    document.head.appendChild(el);
  });
  return script;
}

/** Starts the bot check of a form on its first interaction (one widget per form). */
export function prepareLeadProtection(form: HTMLFormElement) {
  if (!publicEnv.leadCapture || !publicEnv.turnstileSiteKey || protections.has(form)) return;
  const protection: Protection = { token: '', waiters: [] };
  protections.set(form, protection);
  const container = document.createElement('div');
  container.className = 'form-turnstile';
  form.appendChild(container);
  loadTurnstile()
    .then(() => {
      if (!container.isConnected) return;
      protection.widget = turnstileApi()?.render(container, {
        sitekey: publicEnv.turnstileSiteKey,
        appearance: 'interaction-only',
        callback: (token: string) => {
          protection.token = token;
          protection.waiters.splice(0).forEach((resolve) => resolve(token));
        },
        'expired-callback': () => {
          protection.token = '';
        },
      });
    })
    .catch(() => {
      // Offline or blocked: the next attempt tries again.
      protections.delete(form);
      container.remove();
    });
}

/** Removes a form's widget when the form leaves the page (a closed dialog). */
export function releaseLeadProtection(form: HTMLFormElement) {
  const protection = protections.get(form);
  if (protection?.widget !== undefined) turnstileApi()?.remove?.(protection.widget);
  protections.delete(form);
}

/** The form's Turnstile token, waiting while the check runs (or the visitor answers a challenge). */
function tokenFor(protection: Protection | undefined, maxWait: number) {
  if (!protection || protection.token) return Promise.resolve(protection?.token || '');
  return new Promise<string>((resolve) => {
    protection.waiters.push(resolve);
    setTimeout(() => resolve(protection.token), maxWait);
  });
}

/** A token is valid once: the widget issues a new one before the next attempt. */
function renew(protection: Protection | undefined) {
  if (!protection) return;
  protection.token = '';
  if (protection.widget !== undefined) turnstileApi()?.reset(protection.widget);
}

export type LeadFields = { name: string; company: string; interest: string; website: string; cta_source: CtaSource };
export type LeadFailure = 'invalid' | 'verification' | 'limited' | 'unavailable';
export type LeadResult = { ok: true } | { ok: false; reason: LeadFailure };

/** What the visitor reads when the lead was not stored; they stay on the form. */
export function leadError(reason: LeadFailure) {
  return {
    invalid: 'Revise os campos e tente novamente.',
    verification: 'Não conseguimos confirmar o envio. Aguarde a verificação e tente novamente.',
    limited: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos ou escreva para o nosso e-mail.',
    unavailable: 'Não foi possível enviar agora. Tente novamente em instantes ou escreva para o nosso e-mail.',
  }[reason];
}

const inFlight = new WeakMap<HTMLFormElement, Promise<LeadResult>>();

/**
 * Sends the lead to /api/leads (validation, Turnstile and storage happen on
 * the server) and waits for the answer: only 201, the lead stored, is a
 * success. A form sends one request at a time; a second submit while it is on
 * its way gets the same answer. Refusals are logged by the server, without the
 * visitor's data.
 */
export function submitLead(form: HTMLFormElement, fields: LeadFields): Promise<LeadResult> {
  const pending = inFlight.get(form);
  if (pending) return pending;
  const request = send(form, fields).finally(() => inFlight.delete(form));
  inFlight.set(form, request);
  return request;
}

async function send(form: HTMLFormElement, fields: LeadFields): Promise<LeadResult> {
  prepareLeadProtection(form);
  const protection = protections.get(form);
  const token = await tokenFor(protection, 10000);
  // No token yet: the check is still running or waits for the visitor; keep the widget as it is.
  if (publicEnv.turnstileSiteKey && !token) return { ok: false, reason: 'verification' };
  try {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'omit',
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ ...fields, turnstileToken: token, ...readAttribution() }),
    });
    if (response.status === 201) return { ok: true };
    return { ok: false, reason: response.status === 400 ? 'invalid' : response.status === 403 ? 'verification' : response.status === 429 ? 'limited' : 'unavailable' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  } finally {
    renew(protection);
  }
}

/** The message WhatsApp opens with, from what the visitor typed. */
export function whatsappMessage(fields: Pick<LeadFields, 'name' | 'company' | 'interest'>) {
  return `Olá, Velmont! Gostaria de solicitar uma análise estratégica.\nNome: ${fields.name.trim()}\nEmpresa ou projeto: ${fields.company.trim() || 'Ainda em estruturação'}\nInteresse: ${fields.interest || 'Preciso de orientação'}`;
}

/**
 * Records the lead and, only once it is stored, continues to WhatsApp with the
 * prepared message (same tab: never blocked as a pop-up). Without lead capture
 * (a site configured not to store contacts, as its privacy page then says)
 * there is nothing to wait for.
 */
export async function contactVelmont(form: HTMLFormElement, fields: LeadFields): Promise<LeadResult> {
  const result: LeadResult = publicEnv.leadCapture ? await submitLead(form, fields) : { ok: true };
  if (result.ok) window.location.assign(whatsappUrl(whatsappMessage(fields)));
  return result;
}
