'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { WebhookOutbox } = require('../webhook-outbox');

async function fixture(options = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'leadflow-outbox-test-'));
  const outbox = new WebhookOutbox({
    queueFile: path.join(dir, 'outbox.json'),
    url: 'https://receiver.example.test/hooks/leads',
    baseDelayMs: 0,
    logger: { warn() {}, error() {} },
    ...options,
  });
  return { dir, outbox, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
}

test('durably queues an event and removes it after a successful delivery', async () => {
  let received;
  const f = await fixture({ fetchImpl: async (url, options) => {
    received = { url, options };
    return { ok: true, status: 200 };
  } });
  try {
    const queued = await f.outbox.enqueue({ event: 'lead.created', lead: { id: 'lead-1' } });
    assert.equal(queued.queued, true);
    assert.equal((await f.outbox.readQueue()).length, 1);
    await f.outbox.processOne();
    assert.equal((await f.outbox.readQueue()).length, 0);
    assert.equal(received.options.method, 'POST');
    assert.equal(received.options.headers['idempotency-key'], queued.id);
    assert.equal(JSON.parse(received.options.body).lead.id, 'lead-1');
  } finally { await f.cleanup(); }
});

test('retries a transient HTTP 503 and succeeds on the next attempt', async () => {
  let calls = 0;
  const f = await fixture({ fetchImpl: async () => {
    calls += 1;
    return calls === 1 ? { ok: false, status: 503 } : { ok: true, status: 204 };
  } });
  try {
    await f.outbox.enqueue({ event: 'lead.created', lead: { id: 'lead-2' } });
    await f.outbox.processOne();
    let queue = await f.outbox.readQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0].attempts, 1);
    assert.equal(queue[0].status, 'pending');
    await f.outbox.processOne(Date.now() + 1000);
    queue = await f.outbox.readQueue();
    assert.equal(calls, 2);
    assert.equal(queue.length, 0);
  } finally { await f.cleanup(); }
});

test('does not retry permanent HTTP 400 responses and preserves a dead-letter record', async () => {
  const f = await fixture({ fetchImpl: async () => ({ ok: false, status: 400 }) });
  try {
    await f.outbox.enqueue({ event: 'lead.created', lead: { id: 'lead-3' } });
    await f.outbox.processOne();
    const queue = await f.outbox.readQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0].status, 'dead');
    assert.equal(queue[0].lastError, 'http-400');
  } finally { await f.cleanup(); }
});

test('keeps queued work on disk so a new outbox instance can recover it', async () => {
  const f = await fixture({ fetchImpl: async () => ({ ok: true, status: 200 }) });
  try {
    await f.outbox.enqueue({ event: 'lead.created', lead: { id: 'lead-4' } });
    const restarted = new WebhookOutbox({
      queueFile: path.join(f.dir, 'outbox.json'),
      url: 'https://receiver.example.test/hooks/leads',
      fetchImpl: async () => ({ ok: true, status: 200 }),
      logger: { warn() {}, error() {} },
    });
    assert.equal((await restarted.readQueue()).length, 1);
    await restarted.processOne();
    assert.equal((await restarted.readQueue()).length, 0);
  } finally { await f.cleanup(); }
});

test('does not enqueue when no webhook endpoint is configured', async () => {
  const f = await fixture({ url: '' });
  try {
    const result = await f.outbox.enqueue({ event: 'lead.created', lead: { id: 'lead-5' } });
    assert.deepEqual(result, { queued: false, reason: 'not-configured' });
  } finally { await f.cleanup(); }
});
