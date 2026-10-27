'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const target = path.resolve(process.env.DATA_FILE || './data/leads.json');
  const source = path.join(__dirname, 'data', 'sample-leads.json');
  await fs.mkdir(path.dirname(target), { recursive: true });
  try { await fs.access(target); console.error(`Refusing to overwrite existing data at ${target}. Back it up or remove it intentionally first.`); process.exitCode = 1; return; }
  catch {}
  await fs.copyFile(source, target, fs.constants.COPYFILE_EXCL);
  console.log(`Loaded fictional sample leads into ${target}`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
