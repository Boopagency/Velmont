import { publicEnv } from './public-env';

// Records a contact-form submission as a lead. It never blocks or delays the
// WhatsApp hand-off: failures are silent for the visitor.

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

type Turnstile = { render: (el: HTMLElement, options: Record<string, unknown>) => string };
let turnstileToken = '';
let turnstileLoading = false;

/** Loads Cloudflare Turnstile on first interaction with the form, when configured. */
export function prepareLeadProtection(form: HTMLFormElement) {
  if (!publicEnv.leadCapture || !publicEnv.turnstileSiteKey || turnstileLoading) return;
  turnstileLoading = true;
  const container = document.createElement('div');
  container.className = 'form-turnstile';
  form.appendChild(container);
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.onload = () => {
    const turnstile = (window as unknown as { turnstile?: Turnstile }).turnstile;
    turnstile?.render(container, {
      sitekey: publicEnv.turnstileSiteKey,
      appearance: 'interaction-only',
      callback: (token: string) => {
        turnstileToken = token;
      },
    });
  };
  document.head.appendChild(script);
}

const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '');

export function submitLead(fields: { name: FormDataEntryValue | null; company: FormDataEntryValue | null; interest: string | null; website: FormDataEntryValue | null }) {
  try {
    const body = JSON.stringify({
      name: text(fields.name),
      company: text(fields.company),
      interest: fields.interest || 'Preciso de orientação',
      website: text(fields.website),
      turnstileToken,
      ...readAttribution(),
    });
    void fetch('/api/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true, credentials: 'omit' }).catch(() => {});
  } catch {
    // Never interfere with the WhatsApp conversation.
  }
}
