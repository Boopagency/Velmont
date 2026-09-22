import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArticleBlocks } from '../../lib/blog/render';
import { plainText, safeHref } from '../../lib/blog/inline';
import { contentSchema } from '../../lib/blog/schema';
import { readingMinutes } from '../../lib/blog/posts';
import type { Block } from '../../lib/blog/types';

const base = 'https://project.supabase.co';
const html = (blocks: unknown[]) => renderToStaticMarkup(<ArticleBlocks blocks={blocks as Block[]} mediaBase={base} />);

describe('article renderer (XSS)', () => {
  test('escapes HTML in every text field', () => {
    const payload = '<script>alert(1)</script><img src=x onerror=alert(1)><svg onload=alert(1)>';
    const out = html([
      { type: 'heading', level: 2, text: payload },
      { type: 'paragraph', text: payload },
      { type: 'list', style: 'bullet', items: [payload] },
      { type: 'quote', text: payload, cite: payload },
      { type: 'callout', title: payload, text: payload },
      { type: 'faq', question: payload, answer: payload },
      { type: 'table', header: [payload], rows: [[payload]], caption: payload },
    ]);
    assert.ok(!/<(script|img|svg)/i.test(out), out);
    assert.ok(!/<[^>]*\son\w+=/i.test(out), 'no event handler attributes inside tags');
    assert.ok(out.includes('&lt;script&gt;'));
  });

  test('drops unknown block types, including raw HTML blocks', () => {
    const out = html([{ type: 'html', html: '<iframe src="https://evil.test"></iframe>' }, { type: 'script', text: 'x' }, null, 42]);
    assert.equal(out, '');
  });

  test('neutralises dangerous link protocols', () => {
    for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', '//evil.test', '/\\evil.test', 'java\tscript:alert(1)', ' javascript:alert(1)']) {
      const out = html([{ type: 'paragraph', text: `[clique](${url})` }]);
      assert.ok(!/href=/.test(out), `${url} -> ${out}`);
      assert.equal(safeHref(url), null, url);
    }
  });

  test('keeps safe links; external ones open safely', () => {
    const out = html([{ type: 'paragraph', text: 'Veja [o guia](https://www.gov.br/inpi) e [serviços](/#marcas).' }]);
    assert.match(out, /<a href="https:\/\/www.gov.br\/inpi" target="_blank" rel="noopener noreferrer">o guia<\/a>/);
    assert.match(out, /<a href="\/#marcas">serviços<\/a>/);
  });

  test('attribute injection through link labels or URLs is impossible', () => {
    const out = html([{ type: 'paragraph', text: '[x" onmouseover="alert(1)](https://a.test/"onmouseover="alert(1))' }]);
    assert.ok(!/<[^>]*\sonmouseover=/i.test(out), out);
  });

  test('images only load from the media bucket with a safe path', () => {
    const good = html([{ type: 'image', mediaId: 'x', path: '0f8fad5b-d9cb-469f-a165-70867728950e.webp', alt: 'Alt "quoted"', width: 800, height: 600 }]);
    assert.match(good, /src="https:\/\/project.supabase.co\/storage\/v1\/object\/public\/media\/0f8fad5b-d9cb-469f-a165-70867728950e.webp"/);
    assert.match(good, /alt="Alt &quot;quoted&quot;"/);
    for (const path of ['https://evil.test/x.webp', '../../secret.webp', 'x.svg', '0f8fad5b-d9cb-469f-a165-70867728950e.svg']) {
      assert.equal(html([{ type: 'image', mediaId: 'x', path, alt: '', width: 1, height: 1 }]), '', path);
    }
  });

  test('groups sections by H2 like the launch articles', () => {
    const out = html([{ type: 'heading', level: 2, text: 'A' }, { type: 'paragraph', text: 'b' }, { type: 'heading', level: 3, text: 'C' }]);
    assert.equal(out, '<section><h2>A</h2><p>b</p><h3>C</h3></section>');
  });
});

describe('content schema', () => {
  test('rejects HTML blocks, unknown keys and oversize text', () => {
    assert.equal(contentSchema.safeParse({ version: 1, blocks: [{ type: 'html', html: '<b>' }] }).success, false);
    assert.equal(contentSchema.safeParse({ version: 1, blocks: [{ type: 'paragraph', text: 'x', onclick: 'y' }] }).success, false);
    assert.equal(contentSchema.safeParse({ version: 1, blocks: [{ type: 'paragraph', text: 'x'.repeat(5001) }] }).success, false);
    assert.equal(contentSchema.safeParse({ version: 1, blocks: [{ type: 'table', header: ['a', 'b'], rows: [['1']] }] }).success, false);
    assert.equal(contentSchema.safeParse({ version: 1, blocks: [{ type: 'paragraph', text: 'ok' }] }).success, true);
  });
});

describe('text helpers', () => {
  test('plainText strips inline marks', () => {
    assert.equal(plainText('**Marca** é *patrimônio*, veja [o guia](https://a.test).'), 'Marca é patrimônio, veja o guia.');
  });
  test('reading time counts visible words', () => {
    const words = Array.from({ length: 401 }, () => 'palavra').join(' ');
    assert.equal(readingMinutes({ version: 1, blocks: [{ type: 'paragraph', text: words }] }), 3);
    assert.equal(readingMinutes({ version: 1, blocks: [] }), 1);
  });
});
