'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const tempDir = path.join(os.tmpdir(), `leadflow-test-${process.pid}-${Date.now()}`);
process.env.DATA_FILE = path.join(tempDir, 'leads.json');
process.env.ADMIN_USER = 'test-admin';
process.env.ADMIN_PASSWORD = 'test-password-long-enough';
const { app } = require('../server');
let server; let baseUrl;
test.before(async () => {
  await fs.mkdir(tempDir, {recursive:true});
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(tempDir, {recursive:true,force:true}); });
function auth() { return 'Basic ' + Buffer.from('test-admin:test-password-long-enough').toString('base64'); }
function validLead(overrides={}) { return {name:'Test Visitor',email:'visitor@example.com',phone:'+1 555 0100',service:'Website design',message:'I need help improving my service website.',consent:true,...overrides}; }

test('health endpoint returns ok', async () => {
  const res = await fetch(`${baseUrl}/api/health`); const data = await res.json();
  assert.equal(res.status, 200); assert.equal(data.status, 'ok');
});
test('rejects invalid submissions and identifies fields', async () => {
  const res = await fetch(`${baseUrl}/api/leads`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(validLead({email:'bad',consent:false}))});
  const data = await res.json(); assert.equal(res.status,422); assert.ok(data.fields.email); assert.ok(data.fields.consent);
});
test('stores a valid lead and protects admin endpoint', async () => {
  const create = await fetch(`${baseUrl}/api/leads`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(validLead())});
  const created = await create.json(); assert.equal(create.status,201); assert.ok(created.leadId);
  const denied = await fetch(`${baseUrl}/api/leads`); assert.equal(denied.status,401);
  const list = await fetch(`${baseUrl}/api/leads`, {headers:{authorization:auth()}}); const data = await list.json();
  assert.equal(list.status,200); assert.equal(data.leads.length,1); assert.equal(data.leads[0].email,'visitor@example.com');
});
test('prevents duplicate email submissions within 24 hours', async () => {
  const res = await fetch(`${baseUrl}/api/leads`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(validLead())});
  assert.equal(res.status,409);
});
test('allows status changes and deletion for authenticated admin', async () => {
  const list = await fetch(`${baseUrl}/api/leads`, {headers:{authorization:auth()}}); const data = await list.json(); const id = data.leads[0].id;
  const patch = await fetch(`${baseUrl}/api/leads/${id}/status`, {method:'PATCH',headers:{authorization:auth(),'content-type':'application/json'},body:JSON.stringify({status:'qualified'})});
  assert.equal(patch.status,200); assert.equal((await patch.json()).lead.status,'qualified');
  const del = await fetch(`${baseUrl}/api/leads/${id}`, {method:'DELETE',headers:{authorization:auth()}}); assert.equal(del.status,204);
  const empty = await fetch(`${baseUrl}/api/leads`, {headers:{authorization:auth()}}); assert.equal((await (await empty.json()).leads).length,0);
});
test('rejects invalid status values', async () => {
  const res = await fetch(`${baseUrl}/api/leads/unknown/status`, {method:'PATCH',headers:{authorization:auth(),'content-type':'application/json'},body:JSON.stringify({status:'magic'})});
  assert.equal(res.status,422);
});
