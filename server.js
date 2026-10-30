'use strict';
const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { WebhookOutbox } = require('./webhook-outbox');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.resolve(process.env.DATA_FILE || './data/leads.json');
const ADMIN_USER = process.env.ADMIN_USER || 'demo';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-this-to-a-long-unique-password';
const WEBHOOK_URL = process.env.LEAD_WEBHOOK_URL || '';
const WEBHOOK_QUEUE_FILE = path.resolve(process.env.WEBHOOK_QUEUE_FILE || './data/webhook-outbox.json');
const webhookOutbox = new WebhookOutbox({ queueFile: WEBHOOK_QUEUE_FILE, url: WEBHOOK_URL });
const MAX_BODY = '20kb';
const validStatuses = new Set(['new', 'contacted', 'qualified', 'closed']);
const attempts = new Map();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  next();
});
app.use(express.json({ limit: MAX_BODY, strict: true }));
// Protect the admin page itself so browser navigation can trigger the Basic Auth prompt.
app.use((req, res, next) => {
  if (req.path !== '/admin.html' && req.path !== '/admin.js' && req.path !== '/admin.css') return next();
  if (req.path === '/admin.html' && !isAdmin(req)) {
    res.setHeader('WWW-Authenticate', 'Basic realm=\"LeadFlow Admin\", charset=\"UTF-8\"');
    return res.status(401).type('text').send('Admin authentication required.');
  }
  if ((req.path === '/admin.js' || req.path === '/admin.css') && !isAdmin(req)) return res.status(401).end();
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

async function ensureStore() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try { await fs.access(DATA_FILE); }
  catch { await fs.writeFile(DATA_FILE, '[]\n', { flag: 'wx' }).catch(() => {}); }
}
async function readLeads() {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Lead store is not an array');
  return parsed;
}
async function writeLeads(leads) {
  await ensureStore();
  const tmp = `${DATA_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(leads, null, 2) + '\n', { mode: 0o600 });
  await fs.rename(tmp, DATA_FILE);
}
function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001F\u007F]/g, '').slice(0, max) : '';
}
function validateLead(body) {
  const lead = {
    name: cleanText(body.name, 100),
    email: cleanText(body.email, 254).toLowerCase(),
    phone: cleanText(body.phone, 40),
    service: cleanText(body.service, 100),
    message: cleanText(body.message, 2000),
    consent: body.consent === true,
  };
  const errors = {};
  if (lead.name.length < 2) errors.name = 'Enter your name (at least 2 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) errors.email = 'Enter a valid email address.';
  if (lead.phone.length > 0 && lead.phone.length < 7) errors.phone = 'Enter a complete phone number or leave it blank.';
  if (!lead.service) errors.service = 'Choose the service you need.';
  if (lead.message.length < 10) errors.message = 'Add a little more detail (at least 10 characters).';
  if (!lead.consent) errors.consent = 'Please confirm that we may use these details to respond to your enquiry.';
  return { lead, errors };
}
function isAdmin(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded;
  try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); } catch { return false; }
  const separator = decoded.indexOf(':');
  if (separator < 0) return false;
  const user = decoded.slice(0, separator);
  const pass = decoded.slice(separator + 1);
  const safeEqual = (a, b) => {
    const aa = Buffer.from(a); const bb = Buffer.from(b);
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  };
  return safeEqual(user, ADMIN_USER) && safeEqual(pass, ADMIN_PASSWORD);
}
function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.setHeader('WWW-Authenticate', 'Basic realm="LeadFlow Admin", charset="UTF-8"');
  return res.status(401).json({ error: 'Admin authentication required.' });
}
function rateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter(time => now - time < 60_000);
  if (recent.length >= 10) return res.status(429).json({ error: 'Too many submissions. Please wait a minute and try again.' });
  recent.push(now); attempts.set(key, recent);
  next();
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'LeadFlow Studio', persistence: 'local-json' }));
app.post('/api/leads', rateLimit, async (req, res, next) => {
  try {
    // Honeypot: bots fill this hidden field; return a neutral response without storing it.
    if (cleanText(req.body?.website, 200)) return res.status(201).json({ ok: true, message: 'Thanks — your enquiry has been received.' });
    const { lead, errors } = validateLead(req.body || {});
    if (Object.keys(errors).length) return res.status(422).json({ error: 'Please check the highlighted fields.', fields: errors });
    const leads = await readLeads();
    const duplicate = leads.find(item => item.email === lead.email && Date.now() - new Date(item.createdAt).getTime() < 24 * 60 * 60 * 1000);
    if (duplicate) return res.status(409).json({ error: 'An enquiry from this email was already received in the last 24 hours. If you need to add details, please reply to your confirmation.' });
    const record = {
      id: crypto.randomUUID(), ...lead, status: 'new', source: 'website-form',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    leads.unshift(record);
    await writeLeads(leads);
    let webhook = 'not-configured';
    if (WEBHOOK_URL) {
      try {
        const result = await webhookOutbox.enqueue({ event: 'lead.created', lead: record });
        webhook = result.queued ? 'queued' : result.reason;
      } catch (error) {
        // The lead itself is already safely stored. Do not make the visitor resubmit
        // and risk a duplicate just because the separate webhook outbox is unavailable.
        webhook = 'queue-failed';
        console.error('Webhook event could not be queued', { leadId: record.id, message: error.message });
      }
    }
    return res.status(201).json({ ok: true, message: 'Thanks — your enquiry has been received. We will review it shortly.', leadId: record.id, workflow: webhook });
  } catch (error) { next(error); }
});
app.get('/api/leads', requireAdmin, async (_req, res, next) => {
  try { const leads = await readLeads(); res.json({ leads }); }
  catch (error) { next(error); }
});
app.patch('/api/leads/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const status = cleanText(req.body?.status, 30);
    if (!validStatuses.has(status)) return res.status(422).json({ error: 'Status must be new, contacted, qualified, or closed.' });
    const leads = await readLeads();
    const index = leads.findIndex(item => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Lead not found.' });
    leads[index].status = status;
    leads[index].updatedAt = new Date().toISOString();
    await writeLeads(leads);
    res.json({ lead: leads[index] });
  } catch (error) { next(error); }
});
app.delete('/api/leads/:id', requireAdmin, async (req, res, next) => {
  try {
    const leads = await readLeads();
    const remaining = leads.filter(item => item.id !== req.params.id);
    if (remaining.length === leads.length) return res.status(404).json({ error: 'Lead not found.' });
    await writeLeads(remaining);
    res.status(204).end();
  } catch (error) { next(error); }
});
app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'Invalid JSON request body.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  console.error('Request failed:', err.message);
  res.status(500).json({ error: 'Something went wrong. Please try again later.' });
});

if (require.main === module) {
  webhookOutbox.start();
  app.listen(PORT, () => console.log(`LeadFlow Studio running at http://localhost:${PORT}`));
}
module.exports = { app, validateLead, readLeads, writeLeads, webhookOutbox };
