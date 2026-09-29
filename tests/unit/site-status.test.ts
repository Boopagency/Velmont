import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { derive, failureReason, type LiveBuild } from '../../admin/site-status';

// The panel's reading of site_builds (the latest request) and of the live
// build-info.json. The production build is the authority; the live version's
// start time lets the panel recognize an update that is already on the air.

const NOW = Date.parse('2026-09-29T12:00:00Z');
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
type Row = Parameters<typeof derive>[0] & object;
const row = (over: Partial<Row>): Row => ({ id: 1, requested_at: at(1), status: 'pending', finished_at: null, detail: null, ...over });
const live = (startedMinutesAgo: number | null): LiveBuild => ({
  builtAt: startedMinutesAgo === null ? null : at(startedMinutesAgo - 0.5),
  startedAt: startedMinutesAgo === null ? null : at(startedMinutesAgo),
});
const older = live(30);

describe('site status on the dashboard', () => {
  test('a request Vercel accepted shows updating until its build confirms it, then updated', () => {
    const request = row({ requested_at: at(1) });
    assert.equal(derive(request, older, NOW), 'updating');
    // The production build ran finish_site_builds: success.
    assert.equal(derive({ ...request, status: 'success', finished_at: at(0) }, older, NOW), 'updated');
  });

  test('a request without Vercel’s answer is unconfirmed, never failed, until a build settles it', () => {
    const request = row({ requested_at: at(1), detail: 'deploy hook unconfirmed' });
    assert.equal(derive(request, older, NOW), 'unconfirmed');
    assert.equal(derive({ ...request, status: 'success', finished_at: at(0) }, older, NOW), 'updated', 'finish_site_builds confirmed it');
  });

  test('a live version that began after the request makes it updated, whatever the row still says', () => {
    const requested = at(2);
    const liveAfter = live(1.5);
    assert.equal(derive(row({ requested_at: requested }), liveAfter, NOW), 'updated');
    assert.equal(derive(row({ requested_at: requested, detail: 'deploy hook unconfirmed' }), liveAfter, NOW), 'updated');
    // Rows recorded as failed by the old timeout ("deploy hook unreachable") while the build went live.
    assert.equal(derive(row({ requested_at: requested, status: 'failed', detail: 'deploy hook unreachable', finished_at: requested }), liveAfter, NOW), 'updated');
    assert.equal(derive(row({ requested_at: at(0.5), status: 'failed', detail: 'deploy hook unreachable' }), liveAfter, NOW), 'failed', 'a live version older than the request proves nothing');
  });

  test('a real build failure stays a failure while no newer version is live', () => {
    const failed = row({ requested_at: at(3), status: 'failed', detail: 'build failed: Error: CMS unavailable', finished_at: at(2) });
    assert.equal(derive(failed, older, NOW), 'failed');
    assert.equal(failureReason(failed.detail), 'A geração do site falhou na Vercel.');
    assert.equal(failureReason('deploy hook answered 500'), 'A Vercel recusou o pedido de atualização.');
  });

  test('without confirmation for too long it becomes "Sem confirmação" (a retry is offered)', () => {
    assert.equal(derive(row({ requested_at: at(6), detail: 'deploy hook unconfirmed' }), older, NOW), 'stalled', 'unconfirmed: after 5 min');
    assert.equal(derive(row({ requested_at: at(14) }), older, NOW), 'updating');
    assert.equal(derive(row({ requested_at: at(16) }), older, NOW), 'stalled', 'accepted: after 15 min');
  });

  test('an older build-info.json without startedAt reconciles nothing; no request at all means updated', () => {
    assert.equal(derive(row({ requested_at: at(2), status: 'failed', detail: 'deploy hook unreachable' }), { builtAt: at(1), startedAt: null }, NOW), 'failed');
    assert.equal(derive(null, older, NOW), 'updated');
  });
});
