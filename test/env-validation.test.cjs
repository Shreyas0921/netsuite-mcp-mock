const test = require('node:test');
const assert = require('node:assert/strict');

const { McpServerFactory } = require('../dist/shared/mcp-server-factory.js');

const mockLogger = {
  info() {},
  error() {},
};

test('validateEnvironment requires live credentials in live mode', () => {
  const valid = McpServerFactory.validateEnvironment(
    {
      NETSUITE_MODE: 'live',
      NETSUITE_REST_URL: 'https://example.suitetalk.api.netsuite.com/services/rest/',
      NETSUITE_SEARCH_REST_LET: 'https://example.restlets.api.netsuite.com/app/site/hosting/restlet.nl',
      NETSUITE_ACCESS_TOKEN: 'a.b.c',
    },
    mockLogger
  );

  assert.equal(valid, true);
});

test('validateEnvironment requires demo scenario in mock mode', () => {
  const valid = McpServerFactory.validateEnvironment(
    {
      NETSUITE_MODE: 'mock',
      DEMO_SCENARIO: 'ar_spike',
      DEMO_DATA_DIR: 'demo-data/scenarios',
    },
    mockLogger
  );

  assert.equal(valid, true);
});

test('validateEnvironment rejects invalid NETSUITE_MODE', () => {
  const valid = McpServerFactory.validateEnvironment(
    {
      NETSUITE_MODE: 'invalid',
    },
    mockLogger
  );

  assert.equal(valid, false);
});
