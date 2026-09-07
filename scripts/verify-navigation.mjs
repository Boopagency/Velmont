import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const html = await fs.readFile('dist/index.html', 'utf8');
const startup = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function visit(type = 'navigate', hash = '') {
  const events = new Map();
  const frames = [];
  const state = { y: 120, url: null };
  const history = { scrollRestoration: 'auto', state: {}, replaceState: (_, __, url) => { state.url = url; } };
  vm.runInNewContext(startup, {
    history,
    location: { hash, pathname: '/', search: '?source=test' },
    performance: { getEntriesByType: () => [{ type }] },
    addEventListener: (name, fn) => events.set(name, fn),
    requestAnimationFrame: fn => frames.push(fn),
    scrollTo: options => { assert.equal(options.behavior, 'instant'); state.y = options.top; },
  });
  return { state, history, fire: name => events.get(name)?.(), frame: () => frames.splice(0).forEach(fn => fn()) };
}
for (const type of ['navigate', 'reload', 'back_forward']) {
  const page = visit(type);
  assert.equal(page.history.scrollRestoration, 'manual');
  page.state.y = 120; // Simulate a late browser restoration.
  page.fire('pageshow'); page.frame();
  assert.equal(page.state.y, 0, type);
  page.fire('touchstart'); page.state.y = 250; page.fire('pageshow'); page.frame();
  assert.equal(page.state.y, 250, 'Do not interrupt someone already scrolling');
  page.fire('pagehide'); page.fire('pageshow'); page.frame();
  assert.equal(page.state.y, 0, 'Return from the browser cache');
}
const reload = visit('reload', '#processo');
reload.fire('pageshow'); reload.frame();
assert.equal(reload.state.y, 0);
assert.equal(reload.state.url, '/?source=test');
const section = visit('navigate', '#marcas');
assert.equal(section.state.y, 120, 'Keep deliberately linked sections accessible');
const commercial = [...html.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/g)].filter(([, attrs, body]) => /class="(?:cta|header-contact)|Conversar sobre outras|Converse sobre sua criação|Proteja seu ativo digital|Vamos conversar sobre seu negócio/.test(attrs + body));
assert.ok(commercial.length >= 8);
for (const [, attrs] of commercial) assert.match(attrs, /href="https:\/\/wa\.me\/5541985084026\?text=/);
assert.ok(!/href="\/?#contato"/.test(html));
assert.ok(!html.includes('Continuar no WhatsApp'), 'No intermediate form confirmation');
console.log('PASS: initial entry, reload, history return, touch interaction, section links and commercial CTAs.');
