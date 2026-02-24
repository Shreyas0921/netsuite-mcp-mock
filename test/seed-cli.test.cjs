const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function runSeed(args, cwd = process.cwd()) {
  return spawnSync(process.execPath, ['dist/seed-cli.js', ...args], {
    cwd,
    encoding: 'utf-8',
  });
}

test('seed CLI create/list/validate workflow', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-cli-'));

  const create = runSeed([
    'create-scenario',
    '--name', 'demo_one',
    '--seed', '123',
    '--profile', 'baseline',
    '--root-dir', root,
  ]);

  assert.equal(create.status, 0, create.stderr || create.stdout);
  assert.match(create.stdout, /Created scenario 'demo_one'/);

  const list = runSeed(['list-scenarios', '--json', '--root-dir', root]);
  assert.equal(list.status, 0, list.stderr || list.stdout);
  const listed = JSON.parse(list.stdout);
  assert.equal(Array.isArray(listed), true);
  assert.equal(listed.some((r) => r.scenario === 'demo_one'), true);

  const validate = runSeed(['validate-scenario', '--name', 'demo_one', '--root-dir', root]);
  assert.equal(validate.status, 0, validate.stderr || validate.stdout);
  assert.match(validate.stdout, /is valid/);
});

test('seed CLI is deterministic for same seed + config', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-cli-'));

  const args = [
    'create-scenario',
    '--name', 'stable_case',
    '--seed', '77',
    '--scale', 'small',
    '--profile', 'ar_spike',
    '--root-dir', root,
  ];

  const first = runSeed(args);
  assert.equal(first.status, 0, first.stderr || first.stdout);

  const invoicePath = path.join(root, 'stable_case', 'datasets', 'invoice.json');
  const firstInvoice = fs.readFileSync(invoicePath, 'utf-8');

  const second = runSeed([...args, '--force']);
  assert.equal(second.status, 0, second.stderr || second.stdout);

  const secondInvoice = fs.readFileSync(invoicePath, 'utf-8');
  assert.equal(secondInvoice, firstInvoice);
});

test('update-scenario supports dry-run', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-cli-'));

  const create = runSeed(['create-scenario', '--name', 'demo_update', '--seed', '4', '--root-dir', root]);
  assert.equal(create.status, 0, create.stderr || create.stdout);

  const dryRun = runSeed([
    'update-scenario',
    '--name', 'demo_update',
    '--seed', '8',
    '--dry-run',
    '--root-dir', root,
  ]);

  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  assert.match(dryRun.stdout, /Dry-run successful/);
});
