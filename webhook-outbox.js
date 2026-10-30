'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

/**
 * Small persistent webhook outbox for a single Node.js process.
 * This protects against transient receiver/network failures and process restarts.
 * It is not a distributed queue: use a database-backed queue for multi-instance deployments.
 */
class WebhookOutbox {
  constructor({
    queueFile,
    url,
    fetchImpl = globalThis.fetch,
    timeoutMs = 5000,
    maxAttempts = 8,
    baseDelayMs = 1000,
    maxDelayMs = 5 * 60 * 1000,
    logger = console,
  }) {
    if (!queueFile) throw new TypeError('queueFile is required');
    this.queueFile = path.resolve(queueFile);
    this.url = url || '';
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.maxAttempts = maxAttempts;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.logger = logger;
    this.processing = false;
    this.writeChain = Promise.resolve();
  }

  async readQueue() {
    await fs.mkdir(path.dirname(this.queueFile), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.queueFile, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('Webhook outbox file is not an array');
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.writeFile(this.queueFile, '[]\n', { flag: 'wx', mode: 0o600 }).catch((writeError) => {
          if (writeError.code !== 'EEXIST') throw writeError;
        });
        return [];
      }
      throw error;
    }
  }

  async writeQueue(queue) {
    await fs.mkdir(path.dirname(this.queueFile), { recursive: true });
    const tmp = `${this.queueFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.writeFile(tmp, `${JSON.stringify(queue, null, 2)}\n`, { mode: 0o600 });
      await fs.rename(tmp, this.queueFile);
    } finally {
      await fs.rm(tmp, { force: true }).catch(() => {});
    }
  }

  async mutateQueue(mutator) {
    const operation = this.writeChain.then(async () => {
      const queue = await this.readQueue();
      const result = await mutator(queue);
      await this.writeQueue(queue);
      return result;
    });
    this.writeChain = operation.catch(() => {});
    return operation;
  }

  async enqueue(payload) {
    if (!this.url) return { queued: false, reason: 'not-configured' };
    const item = {
      id: crypto.randomUUID(),
      url: this.url,
      payload,
      attempts: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      nextAttemptAt: new Date().toISOString(),
      lastError: null,
    };
    await this.mutateQueue((queue) => queue.push(item));
    return { queued: true, id: item.id };
  }

  retryDelay(attempts) {
    const exponential = Math.min(this.maxDelayMs, this.baseDelayMs * (2 ** Math.max(0, attempts - 1)));
    // Add bounded jitter to avoid synchronised retry storms.
    return Math.round(exponential * (0.8 + Math.random() * 0.4));
  }

  async processOne(now = Date.now()) {
    if (!this.url || typeof this.fetchImpl !== 'function' || this.processing) return false;
    this.processing = true;
    try {
      const queue = await this.readQueue();
      const candidate = queue.find((entry) => entry.status === 'pending' && Date.parse(entry.nextAttemptAt) <= now);
      if (!candidate) return false;

      // Serialize the attempt-count update with enqueue/completion writes.
      // Persist it before the external request so restarts do not erase the attempt.
      const item = await this.mutateQueue((entries) => {
        const current = entries.find((entry) => entry.id === candidate.id && entry.status === 'pending');
        if (!current || Date.parse(current.nextAttemptAt) > now) return null;
        current.attempts += 1;
        return JSON.parse(JSON.stringify(current));
      });
      if (!item) return false;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      let response;
      let failure = null;
      try {
        response = await this.fetchImpl(item.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': item.id,
            'x-leadflow-event-id': item.id,
          },
          body: JSON.stringify(item.payload),
          signal: controller.signal,
        });
      } catch (error) {
        failure = error?.name === 'AbortError' ? 'timeout' : 'network-error';
      } finally {
        clearTimeout(timeout);
      }

      if (!failure && response.ok) {
        await this.mutateQueue((entries) => {
          const index = entries.findIndex((entry) => entry.id === item.id);
          if (index >= 0) entries.splice(index, 1);
        });
        return true;
      }

      const status = response?.status;
      const retryableStatus = status === 408 || status === 429 || status >= 500;
      const retryable = Boolean(failure) || retryableStatus;
      await this.mutateQueue((entries) => {
        const current = entries.find((entry) => entry.id === item.id);
        if (!current) return;
        current.lastError = failure || `http-${status}`;
        if (!retryable) {
          current.status = 'dead';
          current.completedAt = new Date().toISOString();
          return;
        }
        if (current.attempts >= this.maxAttempts) {
          current.status = 'dead';
          current.completedAt = new Date().toISOString();
          current.lastError = `${current.lastError}; max-attempts-exceeded`;
          return;
        }
        current.nextAttemptAt = new Date(Date.now() + this.retryDelay(current.attempts)).toISOString();
      });
      this.logger.warn?.('Webhook delivery attempt failed', { eventId: item.id, failure: failure || `http-${status}` });
      return true;
    } catch (error) {
      this.logger.error?.('Webhook outbox processing failed', { message: error.message });
      return false;
    } finally {
      this.processing = false;
    }
  }

  start({ intervalMs = 1000 } = {}) {
    if (this.timer || !this.url) return;
    // Recover persisted pending work after a process restart and continue polling.
    this.processOne().catch(() => {});
    this.timer = setInterval(() => { this.processOne().catch(() => {}); }, intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = { WebhookOutbox };
