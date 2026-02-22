const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadScenario } = require('../dist/providers/mock/scenario-loader.js');

test('loadScenario loads ar_spike fixture', () => {
  const data = loadScenario('demo-data/scenarios', 'ar_spike');

  assert.equal(data.manifest.scenario, 'ar_spike');
  assert.ok(Array.isArray(data.records.invoice));
  assert.ok(data.records.invoice.length > 0);
});

test('loadScenario fails fast on missing required datasets', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scenario-test-'));
  const scenario = 'broken';
  const scenarioDir = path.join(root, scenario);
  fs.mkdirSync(path.join(scenarioDir, 'datasets'), { recursive: true });

  fs.writeFileSync(
    path.join(scenarioDir, 'manifest.json'),
    JSON.stringify(
      {
        version: 1,
        scenario,
        datasets: {
          accounts: 'datasets/accounts.json',
        },
      },
      null,
      2
    )
  );

  fs.writeFileSync(path.join(scenarioDir, 'datasets', 'accounts.json'), JSON.stringify([]));

  assert.throws(
    () => loadScenario(root, scenario),
    /Missing required dataset entry 'accountingperiod'/
  );
});
