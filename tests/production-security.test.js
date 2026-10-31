'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const serverPath = path.join(__dirname, '..', 'server.js');

function runWithEnv(overrides = {}) {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    ADMIN_USER: '',
    ADMIN_PASSWORD: '',
    ...overrides,
  };

  return spawnSync(
    process.execPath,
    ['-e', `require(${JSON.stringify(serverPath)})`],
    {
      env,
      encoding: 'utf8',
      timeout: 5000,
    }
  );
}

test('production rejects default admin credentials', () => {
  const result = runWithEnv();

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Production startup refused/
  );
});

test('production rejects passwords shorter than 16 characters', () => {
  const result = runWithEnv({
    ADMIN_USER: 'portfolio-admin',
    ADMIN_PASSWORD: 'short',
  });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Production startup refused/
  );
});

test('production accepts explicitly configured credentials', () => {
  const result = runWithEnv({
    ADMIN_USER: 'portfolio-admin',
    ADMIN_PASSWORD: 'a-long-test-password-12345',
  });

  assert.equal(result.status, 0, result.stderr);
});
